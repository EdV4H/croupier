import type { GameState, PlayerId } from "@croupier/core";

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
// 1=A, 2-10, 11=J, 12=Q, 13=K

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type PlayerStatus = "active" | "folded" | "allIn" | "busted";

export interface PlayerState {
  stack: number;
  holeCards: Card[];
  currentBet: number;
  status: PlayerStatus;
  hasActed: boolean;
}

export type HandRank =
  | "royal-flush"
  | "straight-flush"
  | "four-of-a-kind"
  | "full-house"
  | "flush"
  | "straight"
  | "three-of-a-kind"
  | "two-pair"
  | "one-pair"
  | "high-card";

export interface HandEvaluation {
  rank: HandRank;
  rankValue: number; // 10=royal flush, 1=high card
  cards: Card[]; // best 5 cards
  kickers: number[]; // rank values for tie-breaking
}

export interface HoldemState extends GameState {
  pot: number;
  currentHighestBet: number;
  communityCards: Card[];
  deck: Card[];
  dealerPosition: number;
  currentPlayerIndex: number;
  players: Record<PlayerId, PlayerState>;
  playerOrder: PlayerId[];
  smallBlind: number;
  bigBlind: number;
  lastRaiserIndex: number | null;
}
