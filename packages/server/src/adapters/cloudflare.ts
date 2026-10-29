/**
 * Cloudflare Workers + Durable Objects adapter.
 * One GameRoomDO per room holds that room's state; LobbyDO keeps the room list.
 * The DOs only wire ports to a RoomHost: all room rules live in RoomLogic.
 */
import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import type { RoomSummary, ServerMessage } from "../protocol.js";
import { RoomHost, type Clock, type Connection, type Lobby, type Logger } from "../host/room-host.js";
import { mountRoutes, type RoomGateway } from "../http/app.js";
import type { GameRegistry, HttpResult, RoomSettings, RoomState } from "../room/types.js";
import { createRoomIdGenerator } from "./memory.js";

export interface CroupierEnv {
  GAME_ROOM: DurableObjectNamespace<GameRoomObject>;
  LOBBY: DurableObjectNamespace<LobbyObject>;
}

export interface CloudflareOptions {
  registry: GameRegistry;
  settings?: Partial<RoomSettings>;
  logger?: Logger;
  /** Override the clock (tests) */
  clock?: Clock;
}

/** RPC surface of a room object, called by the Worker */
export interface GameRoomObject extends DurableObject {
  createRoom(roomId: string, body: unknown): Promise<HttpResult>;
  joinRoom(roomId: string, body: unknown): Promise<HttpResult>;
  leaveRoom(roomId: string, body: unknown): Promise<HttpResult>;
  startGame(roomId: string, body: unknown): Promise<HttpResult>;
  deleteRoom(roomId: string, body: unknown): Promise<HttpResult>;
  getRoom(roomId: string): Promise<HttpResult>;
}

/** RPC surface of the lobby object */
export interface LobbyObject extends DurableObject {
  allocateId(): Promise<string>;
  upsert(summary: RoomSummary): Promise<void>;
  remove(roomId: string): Promise<void>;
  list(): Promise<RoomSummary[]>;
}

const STATE_KEY = "room";
const LOBBY_NAME = "singleton";

interface SocketAttachment {
  roomId: string;
  playerId: string;
}

function lobbyStub(env: CroupierEnv) {
  return env.LOBBY.get(env.LOBBY.idFromName(LOBBY_NAME));
}

/** Lobby port backed by the LobbyDO */
function lobbyPort(env: CroupierEnv): Lobby {
  return {
    allocateId: () => lobbyStub(env).allocateId(),
    upsert: (summary) => lobbyStub(env).upsert(summary),
    remove: (roomId) => lobbyStub(env).remove(roomId),
    list: () => lobbyStub(env).list(),
  };
}

/** Build the Durable Object classes and Worker for a game registry */
export function createCloudflareServer(opts: CloudflareOptions) {
  class GameRoomDO extends DurableObject<CroupierEnv> implements GameRoomObject {
    readonly host: RoomHost;

    constructor(ctx: DurableObjectState, env: CroupierEnv) {
      super(ctx, env);
      const storage = ctx.storage;
      this.host = new RoomHost({
        registry: opts.registry,
        settings: opts.settings,
        logger: opts.logger,
        clock: opts.clock,
        lobby: lobbyPort(env),
        // A DO holds exactly one room, so roomId arguments are not needed for keys
        store: {
          load: async () => (await storage.get<RoomState>(STATE_KEY)) ?? null,
          save: (_roomId, state) => storage.put(STATE_KEY, state),
          remove: () => storage.deleteAll(),
        },
        scheduler: {
          schedule: (_roomId, at) => (at === null ? storage.deleteAlarm() : storage.setAlarm(at)),
        },
        transport: {
          connections: () =>
            ctx.getWebSockets().flatMap((ws) => {
              const att = ws.deserializeAttachment() as SocketAttachment | null;
              return att ? [socketConnection(ws, att.playerId)] : [];
            }),
        },
      });
    }

    createRoom(roomId: string, body: unknown) {
      return this.host.createRoomWithId(roomId, body);
    }
    joinRoom(roomId: string, body: unknown) {
      return this.host.joinRoom(roomId, body);
    }
    leaveRoom(roomId: string, body: unknown) {
      return this.host.leaveRoom(roomId, body);
    }
    startGame(roomId: string, body: unknown) {
      return this.host.startGame(roomId, body);
    }
    deleteRoom(roomId: string, body: unknown) {
      return this.host.deleteRoom(roomId, body);
    }
    getRoom(roomId: string) {
      return this.host.getRoom(roomId);
    }

    /** WebSocket upgrade, forwarded by the Worker */
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const roomId = url.searchParams.get("roomId") ?? "";
      const playerId = url.searchParams.get("playerId") ?? "";
      const secret = url.searchParams.get("secret") ?? "";
      const status = await this.host.authorize(roomId, playerId, secret);
      if (status !== 200) {
        return Response.json({ error: status === 404 ? "Room not found" : "Not a member of this room" }, { status });
      }

      const pair = new WebSocketPair();
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ roomId, playerId } satisfies SocketAttachment);
      await this.host.onConnect(roomId, socketConnection(server, playerId));
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (!att) return;
      const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
      await this.host.onMessage(att.roomId, socketConnection(ws, att.playerId), raw);
    }

    async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
      try {
        ws.close(code, reason);
      } catch {
        // Already closed
      }
    }

    async alarm(): Promise<void> {
      const state = await this.ctx.storage.get<RoomState>(STATE_KEY);
      if (!state) return;
      await this.host.wake(state.id);
    }
  }

  class LobbyDO extends DurableObject<CroupierEnv> implements LobbyObject {
    private nextId = createRoomIdGenerator();

    async allocateId(): Promise<string> {
      const taken = new Set((await this.ctx.storage.list({ prefix: "room:" })).keys());
      const id = this.nextId((id) => taken.has(`room:${id}`));
      // Reserved until the room reports its summary (or removes itself on failure)
      await this.ctx.storage.put(`room:${id}`, null);
      return id;
    }

    async upsert(summary: RoomSummary): Promise<void> {
      await this.ctx.storage.put(`room:${summary.id}`, summary);
    }

    async remove(roomId: string): Promise<void> {
      await this.ctx.storage.delete(`room:${roomId}`);
    }

    async list(): Promise<RoomSummary[]> {
      const entries = await this.ctx.storage.list<RoomSummary | null>({ prefix: "room:" });
      const rooms: RoomSummary[] = [];
      const stale: string[] = [];
      for (const [key, room] of entries) {
        if (room === null) continue;
        // Entries written by the previous server have no status: their rooms no longer exist
        if (typeof room.status !== "string") stale.push(key);
        else rooms.push(room);
      }
      if (stale.length > 0) await this.ctx.storage.delete(stale);
      return rooms;
    }
  }

  function roomStub(env: CroupierEnv, roomId: string) {
    return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomId));
  }

  function createWorkerApp(env: CroupierEnv) {
    const gateway: RoomGateway = {
      async createRoom(body) {
        const roomId = await lobbyStub(env).allocateId();
        const result = (await roomStub(env, roomId).createRoom(roomId, body)) as HttpResult;
        if (result.status >= 400) await lobbyStub(env).remove(roomId);
        return result;
      },
      joinRoom: (roomId, body) => roomStub(env, roomId).joinRoom(roomId, body),
      leaveRoom: (roomId, body) => roomStub(env, roomId).leaveRoom(roomId, body),
      startGame: (roomId, body) => roomStub(env, roomId).startGame(roomId, body),
      deleteRoom: (roomId, body) => roomStub(env, roomId).deleteRoom(roomId, body),
      getRoom: (roomId) => roomStub(env, roomId).getRoom(roomId),
      listRooms: () => lobbyStub(env).list(),
      connect(c, roomId, playerId, secret) {
        const url = new URL("https://room/ws");
        url.searchParams.set("roomId", roomId);
        url.searchParams.set("playerId", playerId);
        url.searchParams.set("secret", secret);
        return roomStub(env, roomId).fetch(new Request(url, { headers: c.req.raw.headers }));
      },
    };
    return mountRoutes(new Hono(), gateway, opts.registry);
  }

  const worker = {
    fetch(request: Request, env: CroupierEnv, ctx: ExecutionContext) {
      return createWorkerApp(env).fetch(request, env, ctx);
    },
  } satisfies ExportedHandler<CroupierEnv>;

  return { GameRoomDO, LobbyDO, worker };
}

function socketConnection(ws: WebSocket, playerId: string): Connection {
  return {
    playerId,
    send: (message: ServerMessage) => ws.send(JSON.stringify(message)),
    close: (code, reason) => ws.close(code, reason),
  };
}
