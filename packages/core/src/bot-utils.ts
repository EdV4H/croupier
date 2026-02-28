import type { PlayerId } from "./types.js";

/** Prefix for bot player IDs */
export const BOT_PREFIX = "bot:";

/** Default bot display names */
export const BOT_NAMES = [
  "Alice",
  "Bob",
  "Charlie",
  "Diana",
  "Eve",
  "Frank",
  "Grace",
  "Hank",
];

/** Check if a player ID belongs to a bot */
export function isBotPlayer(playerId: PlayerId): boolean {
  return playerId.startsWith(BOT_PREFIX);
}

/** Create a bot player ID from a display name */
export function createBotId(name: string): PlayerId {
  return `${BOT_PREFIX}${name}`;
}

/** Extract display name from a bot player ID */
export function getBotDisplayName(playerId: PlayerId): string {
  return playerId.startsWith(BOT_PREFIX)
    ? playerId.slice(BOT_PREFIX.length)
    : playerId;
}
