/**
 * Wire protocol shared by the server and its clients.
 * Types only depend on zod at runtime for parsing what clients send.
 */
import { z } from "zod";
import type { ActionLogEntry, EngineState, PlayerId } from "@edv4h/croupier-core";

// ============================================================
// REST
// ============================================================

export interface GameInfo {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

export type RoomStatus = "waiting" | "playing" | "finished";

/** Public view of a room. Never contains player secrets. */
export interface RoomSummary {
  id: string;
  gameId: string;
  creatorId: PlayerId;
  players: PlayerId[];
  status: RoomStatus;
  /** Kept for older clients: true once the game has started */
  started: boolean;
  createdAt: number;
}

const playerId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((id) => !id.startsWith("bot:"), "playerId must not start with bot:");

/** Per-browser secret that proves a request comes from the player who first used a playerId in a room */
const secret = z.string().min(16).max(128);

export const createRoomBody = z.object({
  gameId: z.string().min(1),
  playerId,
  secret,
  botCount: z.number().int().min(0).max(16).optional(),
  gameOptions: z.record(z.unknown()).optional(),
});
export type CreateRoomBody = z.infer<typeof createRoomBody>;

export const playerBody = z.object({ playerId, secret });
export type PlayerBody = z.infer<typeof playerBody>;

export interface ErrorBody {
  error: string;
}

// ============================================================
// WebSocket
// ============================================================

export const clientMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("action"), action: z.string().min(1), payload: z.unknown().optional() }),
  z.object({ type: z.literal("getState") }),
]);
export type ClientMessage = z.infer<typeof clientMessage>;

export interface GameStateData {
  playerView: unknown;
  engineState: EngineState;
  actionLog: ActionLogEntry[];
  playerId: PlayerId;
  /** Epoch ms when the current turn times out, or null */
  turnDeadline: number | null;
  /** Increases with every state change. Clients drop states older than the one they hold. */
  revision: number;
}

export type ServerMessage =
  | { type: "connected"; data: { roomId: string; playerId: PlayerId } }
  | { type: "room"; data: RoomSummary }
  | { type: "gameState"; data: GameStateData }
  | { type: "actionResult"; data: { ok: boolean; error?: string } }
  | { type: "error"; error: string }
  | { type: "roomDeleted"; reason: "deleted" | "expired" };

/** WebSocket close codes used by the server */
export const CLOSE_ROOM_GONE = 4004;
