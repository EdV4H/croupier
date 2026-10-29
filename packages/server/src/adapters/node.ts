import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { ServerMessage } from "../protocol.js";
import { RoomHost, type Clock, type Connection, type Logger } from "../host/room-host.js";
import { mountRoutes, type RoomGateway } from "../http/app.js";
import type { GameRegistry, RoomSettings } from "../room/types.js";
import { ConnectionRegistry, MemoryLobby, MemoryRoomStore, TimerScheduler } from "./memory.js";

export interface NodeServerOptions {
  registry: GameRegistry;
  settings?: Partial<RoomSettings>;
  logger?: Logger;
  clock?: Clock;
}

/** Build a Hono app backed by in-memory storage, plus the hook to attach WebSockets to a Node server */
export function createNodeApp(opts: NodeServerOptions) {
  const app = new Hono();
  const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });
  const transport = new ConnectionRegistry();
  const scheduler = new TimerScheduler((roomId) => void host.wake(roomId), opts.clock);
  const host: RoomHost = new RoomHost({
    registry: opts.registry,
    store: new MemoryRoomStore(),
    scheduler,
    transport,
    lobby: new MemoryLobby(),
    clock: opts.clock,
    settings: opts.settings,
    logger: opts.logger,
  });

  const gateway: RoomGateway = {
    createRoom: (body) => host.createRoom(body),
    joinRoom: (roomId, body) => host.joinRoom(roomId, body),
    leaveRoom: (roomId, body) => host.leaveRoom(roomId, body),
    startGame: (roomId, body) => host.startGame(roomId, body),
    deleteRoom: (roomId, body) => host.deleteRoom(roomId, body),
    getRoom: (roomId) => host.getRoom(roomId),
    listRooms: () => host.listRooms(),
    async connect(c, roomId, playerId, secret) {
      const status = await host.authorize(roomId, playerId, secret);
      if (status === 404) return c.json({ error: "Room not found" }, 404);
      if (status === 403) return c.json({ error: "Not a member of this room" }, 403);

      let conn: Connection | null = null;
      const upgrade = upgradeWebSocket(() => ({
        onOpen(_evt, ws: WSContext) {
          conn = {
            playerId,
            send: (message: ServerMessage) => ws.send(JSON.stringify(message)),
            close: (code, reason) => ws.close(code, reason),
          };
          transport.add(roomId, conn);
          void host.onConnect(roomId, conn);
        },
        onMessage(evt) {
          if (conn && typeof evt.data === "string") void host.onMessage(roomId, conn, evt.data);
        },
        onClose() {
          if (conn) transport.remove(roomId, conn);
          opts.logger?.info("ws.disconnect", { roomId, playerId });
        },
      }));
      return (await upgrade(c, async () => {})) ?? c.body(null);
    },
  };

  mountRoutes(app, gateway, opts.registry);
  return { app, host, injectWebSocket, dispose: () => scheduler.dispose() };
}

/** Start a Node HTTP + WebSocket server */
export function startNodeServer(opts: NodeServerOptions & { port: number; onListen?: (port: number) => void }) {
  const { app, injectWebSocket } = createNodeApp(opts);
  const server = serve({ fetch: app.fetch, port: opts.port }, (info) => opts.onListen?.(info.port));
  injectWebSocket(server);
  return server;
}
