import type { GameState, PlayerId } from "@edv4h/croupier-core";

/** Card identifier. Master data from a DB typically uses numeric ids. */
export type CardId = string | number;

/** Minimum shape of a card. Extra attributes (image, effect type, ...) are carried through untouched. */
export interface BaseCard {
  id: CardId;
}

/** Default card shape used by the demo card list */
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

/**
 * How the game ends.
 * - "deckEmpty": the game ends on the discard of the turn in which the deck ran out (renew-values-card spec)
 * - "lastRound": after the deck runs out, every player gets one more turn
 */
export type ValuesCardEndRule = "deckEmpty" | "lastRound";

/** Why the game ended */
export type ValuesCardEndReason = "deckEmpty" | "lastRound" | "maxTurns" | "custom";

export interface ValuesCardState<C extends BaseCard = Card> extends GameState {
  theme: string;
  deck: C[];
  discardPool: DiscardEntry<C>[];
  currentPlayerIndex: number;
  players: Record<PlayerId, PlayerState<C>>;
  playerOrder: PlayerId[];
  turnCount: number;
  /** Remaining turns in the last round ("lastRound" rule only). null if the last round hasn't started. */
  lastRoundTurnsLeft: number | null;
  /** Card drawn in the current turn (cleared on discard). Used by auto-play to discard the same card. */
  drawnCardId: CardId | null;
  /** Set when the game is over */
  endReason: ValuesCardEndReason | null;
}

/** Result returned when the game ends */
export interface ValuesCardResult<C extends BaseCard = Card> {
  reason: string;
  endReason: ValuesCardEndReason;
  theme: string;
  /** Final hand of each player, in hand order */
  finalHands: Record<PlayerId, C[]>;
  playerResults: Record<PlayerId, { stats: { finalHand: C[] } }>;
  turnCount: number;
  /** Card names (or ids when cards have no name) per player — kept for backward compatibility */
  summary: Record<PlayerId, unknown[]>;
  [key: string]: unknown;
}
