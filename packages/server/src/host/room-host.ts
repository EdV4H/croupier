/**
 * RoomHost runs the room logic the same way on every runtime:
 * per room, one input at a time, load → logic → save → side effects.
 * Runtimes differ only in the ports below.
 */
import type { PlayerId } from "@edv4h/croupier-core";
import {
  CLOSE_ROOM_GONE,
  clientMessage,
  createRoomBody,
  playerBody,
  type RoomSummary,
  type ServerMessage,
} from "../protocol.js";
import { RoomLogic, nextWakeup, summarize } from "../room/logic.js";
import type { GameRegistry, HttpResult, Outcome, RoomSettings, RoomState } from "../room/types.js";

export interface RoomStore {
  load(roomId: string): Promise<RoomState | null>;
  save(roomId: string, state: RoomState): Promise<void>;
  remove(roomId: string): Promise<void>;
}

/** Wakes the host (host.wake) at `at`; null cancels. One pending wakeup per room. */
export interface Scheduler {
  schedule(roomId: string, at: number | null): Promise<void> | void;
}

export interface Connection {
  playerId: PlayerId;
  send(message: ServerMessage): void;
  close(code: number, reason: string): void;
}

export interface Transport {
  connections(roomId: string): Connection[];
}

export interface Lobby {
  /** Reserve a fresh room id */
  allocateId(): Promise<string>;
  upsert(summary: RoomSummary): Promise<void>;
  remove(roomId: string): Promise<void>;
  list(): Promise<RoomSummary[]>;
}

export interface Clock {
  now(): number;
}

export interface Logger {
  info(event: string, ctx?: Record<string, unknown>): void;
  warn(event: string, ctx?: Record<string, unknown>): void;
  error(event: string, ctx?: Record<string, unknown>): void;
}

export interface RoomHostOptions {
  registry: GameRegistry;
  store: RoomStore;
  scheduler: Scheduler;
  transport: Transport;
  lobby: Lobby;
  clock?: Clock;
  settings?: Partial<RoomSettings>;
  logger?: Logger;
}

const silent: Logger = { info() {}, warn() {}, error() {} };

function send(conn: Connection, message: ServerMessage): void {
  try {
    conn.send(message);
  } catch {
    // Connection is closing
  }
}

function badRequest(error: string): HttpResult {
  return { status: 400, body: { error } };
}

export class RoomHost {
  readonly logic: RoomLogic;
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly clock: Clock;
  private readonly log: Logger;

  constructor(private readonly opts: RoomHostOptions) {
    this.logic = new RoomLogic(opts.registry, opts.settings);
    this.clock = opts.clock ?? { now: () => Date.now() };
    this.log = opts.logger ?? silent;
  }

  // ============================================================
  // REST
  // ============================================================

  /** Allocate an id from the lobby and create the room */
  async createRoom(rawBody: unknown): Promise<HttpResult> {
    const roomId = await this.opts.lobby.allocateId();
    const result = await this.createRoomWithId(roomId, rawBody);
    if (result.status >= 400) await this.opts.lobby.remove(roomId);
    return result;
  }

  /** Create a room under an id the caller already reserved in the lobby */
  async createRoomWithId(roomId: string, rawBody: unknown): Promise<HttpResult> {
    const body = createRoomBody.safeParse(rawBody);
    if (!body.success) return badRequest(body.error.issues[0]?.message ?? "Invalid body");
    const result = await this.run(roomId, async (state) => this.logic.create(state, roomId, body.data, this.clock.now()));
    this.log.info("room.create", { roomId, gameId: body.data.gameId, creatorId: body.data.playerId, status: result.status });
    return result;
  }

  joinRoom(roomId: string, rawBody: unknown): Promise<HttpResult> {
    return this.withPlayer(roomId, rawBody, "room.join", (state, body) => this.logic.join(state, body, this.clock.now()));
  }

  leaveRoom(roomId: string, rawBody: unknown): Promise<HttpResult> {
    return this.withPlayer(roomId, rawBody, "room.leave", (state, body) => this.logic.leave(state, body, this.clock.now()));
  }

  startGame(roomId: string, rawBody: unknown): Promise<HttpResult> {
    return this.withPlayer(roomId, rawBody, "game.start", (state, body) => this.logic.start(state, body, this.clock.now()));
  }

  deleteRoom(roomId: string, rawBody: unknown): Promise<HttpResult> {
    return this.withPlayer(roomId, rawBody, "room.delete", (state, body) => this.logic.delete(state, body));
  }

  async getRoom(roomId: string): Promise<HttpResult> {
    const state = await this.opts.store.load(roomId);
    return state ? { status: 200, body: summarize(state) } : { status: 404, body: { error: "Room not found" } };
  }

  listRooms(): Promise<RoomSummary[]> {
    return this.opts.lobby.list();
  }

  private async withPlayer(
    roomId: string,
    rawBody: unknown,
    event: string,
    fn: (state: RoomState | null, body: { playerId: string; secret: string }) => Outcome<HttpResult>,
  ): Promise<HttpResult> {
    const body = playerBody.safeParse(rawBody);
    if (!body.success) return badRequest(body.error.issues[0]?.message ?? "Invalid body");
    const result = await this.run(roomId, async (state) => fn(state, body.data));
    this.log.info(event, { roomId, playerId: body.data.playerId, status: result.status });
    return result;
  }

  // ============================================================
  // WebSocket
  // ============================================================

  /** Whether a socket for this player may be opened. 404 if the room is gone, 403 if not a member. */
  async authorize(roomId: string, playerId: string, secret: string): Promise<200 | 403 | 404> {
    const state = await this.opts.store.load(roomId);
    if (!state) return 404;
    return this.logic.isMember(state, playerId, secret) ? 200 : 403;
  }

  /** Call after the transport has registered `conn` */
  async onConnect(roomId: string, conn: Connection): Promise<void> {
    await this.run(roomId, async (state) => {
      if (!state) {
        conn.close(CLOSE_ROOM_GONE, "Room not found");
        return { state, changed: false, effects: [], reply: [], result: undefined };
      }
      for (const message of this.logic.onConnect(state, conn.playerId)) send(conn, message);
      return { state, changed: false, effects: [], reply: [], result: undefined };
    });
    this.log.info("ws.connect", { roomId, playerId: conn.playerId });
  }

  async onMessage(roomId: string, conn: Connection, raw: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      send(conn, { type: "error", error: "Invalid JSON" });
      return;
    }
    const msg = clientMessage.safeParse(parsed);
    if (!msg.success) {
      send(conn, { type: "error", error: "Unknown message" });
      return;
    }
    const outcome = await this.runOutcome(roomId, async (state) => this.logic.message(state, conn.playerId, msg.data, this.clock.now()));
    if (!outcome) {
      send(conn, { type: "error", error: "Internal error" });
      return;
    }
    for (const message of outcome.reply) send(conn, message);
    if (msg.data.type === "action") {
      const result = outcome.reply.find((m) => m.type === "actionResult");
      this.log.info("action", {
        roomId,
        playerId: conn.playerId,
        action: msg.data.action,
        ok: result?.type === "actionResult" ? result.data.ok : undefined,
      });
    }
  }

  /** Called by the scheduler when the room's wakeup time has come */
  async wake(roomId: string): Promise<void> {
    await this.runOutcome(roomId, (state) => this.logic.wake(state, this.clock.now()));
  }

  // ============================================================
  // Core loop
  // ============================================================

  private async run(roomId: string, fn: (state: RoomState | null) => Promise<Outcome<HttpResult>>): Promise<HttpResult>;
  private async run(roomId: string, fn: (state: RoomState | null) => Promise<Outcome<void>>): Promise<void>;
  private async run<T>(roomId: string, fn: (state: RoomState | null) => Promise<Outcome<T>>): Promise<T | HttpResult> {
    const outcome = await this.runOutcome(roomId, fn);
    return outcome ? outcome.result : { status: 500, body: { error: "Internal error" } };
  }

  /** Serialize per room; returns null if the logic threw (nothing is saved then) */
  private runOutcome<T>(roomId: string, fn: (state: RoomState | null) => Promise<Outcome<T>>): Promise<Outcome<T> | null> {
    const prev = this.queues.get(roomId) ?? Promise.resolve();
    const task = prev.then(() => this.step(roomId, fn));
    const tail = task.catch(() => undefined);
    this.queues.set(roomId, tail);
    tail.then(() => {
      if (this.queues.get(roomId) === tail) this.queues.delete(roomId);
    });
    return task;
  }

  private async step<T>(roomId: string, fn: (state: RoomState | null) => Promise<Outcome<T>>): Promise<Outcome<T> | null> {
    const { store, scheduler, lobby } = this.opts;
    const before = await store.load(roomId);
    let outcome: Outcome<T>;
    try {
      outcome = await fn(before);
    } catch (e) {
      this.log.error("room.error", { roomId, error: e instanceof Error ? e.stack ?? e.message : String(e) });
      return null;
    }
    if (!outcome.changed) return outcome;

    const after = outcome.state;
    if (after) {
      await store.save(roomId, after);
      await scheduler.schedule(roomId, nextWakeup(after));
      const summary = summarize(after);
      if (!before || JSON.stringify(summarize(before)) !== JSON.stringify(summary)) await lobby.upsert(summary);
    } else if (before) {
      await store.remove(roomId);
      await scheduler.schedule(roomId, null);
      await lobby.remove(roomId);
      this.log.info("room.remove", { roomId });
    }

    this.applyEffects(roomId, after, outcome);
    return outcome;
  }

  private applyEffects(roomId: string, state: RoomState | null, outcome: Outcome<unknown>): void {
    const conns = this.opts.transport.connections(roomId);
    for (const effect of outcome.effects) {
      switch (effect.type) {
        case "broadcastRoom":
          if (state) for (const c of conns) send(c, { type: "room", data: summarize(state) });
          break;
        case "broadcastState": {
          const engine = state && this.logic.restoreEngine(state);
          if (!state || !engine) break;
          for (const c of conns) {
            try {
              send(c, { type: "gameState", data: this.logic.gameStateFor(state, engine, c.playerId) });
            } catch (e) {
              this.log.warn("view.error", { roomId, playerId: c.playerId, error: String(e) });
            }
          }
          break;
        }
        case "closeAll":
          for (const c of conns) {
            send(c, { type: "roomDeleted", reason: effect.reason });
            try {
              c.close(CLOSE_ROOM_GONE, effect.reason === "deleted" ? "Room deleted" : "Room expired");
            } catch {
              // Already closed
            }
          }
          break;
      }
    }
  }
}
