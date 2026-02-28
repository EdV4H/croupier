import type { GameState, PlayerId } from "@croupier/core";

export interface Card {
  id: string;
  name: string;
}

export interface DiscardEntry {
  card: Card;
  discardedBy: PlayerId;
}

export interface PlayerState {
  hand: Card[];
}

export interface ValuesCardState extends GameState {
  theme: string;
  deck: Card[];
  discardPool: DiscardEntry[];
  currentPlayerIndex: number;
  players: Record<PlayerId, PlayerState>;
  playerOrder: PlayerId[];
  turnCount: number;
}
