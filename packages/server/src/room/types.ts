import type { CroupierConfig, CroupierSnapshot, PlayerId } from "@edv4h/croupier-core";
import type { GameInfo, RoomStatus, ServerMessage } from "../protocol.js";

/** The games a server can host. Supplied by the app (e.g. the demo's plugin list). */
export interface GameRegistry {
  games: GameInfo[];
  /** Build the engine config. Must be deterministic for the same arguments:
   *  it is called again every time a room is restored from storage. */
  createConfig(
    gameId: string,
    players: PlayerId[],
    gameOptions?: Record<string, unknown>,
  ): CroupierConfig<any>;
}

export interface RoomTimers {
  /** When the current human players' turn times out and the bot strategy takes over */
  turnDeadline: number | null;
  /** When the next bot gets a chance to act */
  botAt: number | null;
  /** When the room is deleted (idle, abandoned or finished) */
  cleanupAt: number | null;
}

/** Everything about a room. JSON-serializable: this is what gets persisted. */
export interface RoomState {
  version: 1;
  id: string;
  gameId: string;
  creatorId: PlayerId;
  createdAt: number;
  players: PlayerId[];
  /** playerId → secret of the browser that first used that id in this room */
  secrets: Record<PlayerId, string>;
  gameOptions?: Record<string, unknown>;
  status: RoomStatus;
  /** Players passed to createConfig at start, so the config can be rebuilt on restore */
  configPlayers: PlayerId[] | null;
  engine: CroupierSnapshot | null;
  timers: RoomTimers;
}

export interface RoomSettings {
  /** Delay before each bot action */
  botDelayMs: number;
  /** Max time a bot's decide() may take before falling back */
  botDecideTimeoutMs: number;
  /** A room that has not started is deleted after this long without activity */
  waitingTtlMs: number;
  /** A started room is deleted after this long without any state change */
  idleTtlMs: number;
  /** A finished room is kept this long so clients can show the result */
  finishedTtlMs: number;
  /** Max action log entries persisted per room */
  logLimit: number;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  botDelayMs: 1000,
  botDecideTimeoutMs: 5000,
  waitingTtlMs: 30 * 60_000,
  idleTtlMs: 60 * 60_000,
  finishedTtlMs: 30_000,
  logLimit: 500,
};

export interface HttpResult {
  status: number;
  body: unknown;
}

/** Side effects the host carries out after the new state is saved */
export type Effect =
  | { type: "broadcastRoom" }
  | { type: "broadcastState" }
  | { type: "closeAll"; reason: "deleted" | "expired" };

export interface Outcome<T> {
  /** New state; null deletes the room. Ignored when `changed` is false. */
  state: RoomState | null;
  changed: boolean;
  effects: Effect[];
  /** Messages for the connection that sent the command */
  reply: ServerMessage[];
  result: T;
}
