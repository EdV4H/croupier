import type { GameState, PlayerId } from "@edv4h/croupier-core";

/** Card identifier. Strings for the demo deck, numbers for DB-backed masters. */
export type CardId = string | number;

/** Minimum shape of a card. Extra attributes (image, effect type, …) are preserved as-is. */
export interface BaseCard {
  id: CardId;
  name: string;
}

/** Default demo card */
export interface Card extends BaseCard {
  id: string;
  name: string;
}

export interface DiscardEntry<C extends BaseCard = Card> {
  card: C;
  discardedBy: PlayerId;
}

export interface PlayerState<C extends BaseCard = Card> {
  hand: C[];
}

/** The card drawn in the current turn */
export interface DrawnCard {
  cardId: CardId;
  source: "deck" | "discard";
}

/**
 * How the game ends.
 * - `deckEmpty`: the discard of the turn in which the deck ran out ends the game (renew spec)
 * - `lastRound`: after the deck runs out, every player gets one more turn
 */
export type ValuesCardEndMode = "deckEmpty" | "lastRound";

/** Why the game ended */
export type ValuesCardEndReason = ValuesCardEndMode | "maxTurns" | "custom";

export interface ValuesCardState<C extends BaseCard = Card> extends GameState {
  theme: string;
  deck: C[];
  discardPool: DiscardEntry<C>[];
  currentPlayerIndex: number;
  players: Record<PlayerId, PlayerState<C>>;
  playerOrder: PlayerId[];
  /** Number of completed turns */
  turnCount: number;
  endMode: ValuesCardEndMode;
  /** Turn limit (null = unlimited) */
  maxTurns: number | null;
  /** Card drawn by the current player this turn. null until they draw. */
  drawnCard: DrawnCard | null;
  /** Remaining turns in the last round (`lastRound` mode only). null if it hasn't started. */
  lastRoundTurnsLeft: number | null;
}

/** Result returned when a Values Card game ends */
export interface ValuesCardResult<C extends BaseCard = Card> {
  reason: string;
  endReason: ValuesCardEndReason;
  theme: string;
  /** Final hand of each player, in hand order */
  finalHands: Record<PlayerId, C[]>;
  turnCount: number;
  playerResults: Record<
    PlayerId,
    { stats: { finalHand: string[]; finalHandCardIds: CardId[] } }
  >;
  /** Card names per player (kept for backward compatibility) */
  summary: Record<PlayerId, string[]>;
  [key: string]: unknown;
}
