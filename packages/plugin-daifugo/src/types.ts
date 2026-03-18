import type { GameState, PlayerId } from "@croupier/core";

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";

/** Card rank: 3-10, J=11, Q=12, K=13, A=14, 2=15, Joker=0 */
export type CardRank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export interface Card {
  suit: Suit | "joker";
  rank: CardRank | 0;
  id: string; // "S3", "H10", "D14", "JK1", "JK2"
}

export type PlayType = "single" | "pair" | "triple" | "quad" | "sequence";

export interface PlayedCards {
  cards: Card[];
  type: PlayType;
  rank: CardRank | 0; // set rank (sequence: lowest rank), 0 for joker
  sequenceLength?: number;
  sequenceSuit?: Suit;
}

export type DaifugoRank = "daifugo" | "fugo" | "heimin" | "hinmin" | "daihinmin";

export interface PlayerState {
  hand: Card[];
  rank: DaifugoRank | null;
  finishOrder: number | null;
  score: number;
}

export interface DaifugoRules {
  revolution: boolean;
  eightCut: boolean;
  capitalFall: boolean;
  sequence: boolean;
  suitLock: boolean;
  elevenBack: boolean;
  spadeThreeReturn: boolean;
  sevenPass: boolean;
  tenDiscard: boolean;
  fiveSkip: boolean;
  nineReverse: boolean;
  restrictedFinish: boolean;
}

export const DEFAULT_RULES: DaifugoRules = {
  revolution: true,
  eightCut: true,
  capitalFall: true,
  sequence: true,
  suitLock: true,
  elevenBack: false,
  spadeThreeReturn: false,
  sevenPass: false,
  tenDiscard: false,
  fiveSkip: false,
  nineReverse: false,
  restrictedFinish: false,
};

export interface DaifugoState extends GameState {
  rules: DaifugoRules;
  players: Record<PlayerId, PlayerState>;
  playerOrder: PlayerId[];
  currentPlayerIndex: number;
  playDirection: 1 | -1;
  // Trick
  currentPile: PlayedCards | null;
  lastPlayedBy: PlayerId | null;
  passedPlayers: PlayerId[];
  trickSuitLock: Suit | null;
  trickElevenBack: boolean;
  // Round
  roundNumber: number;
  maxRounds: number;
  isRevolution: boolean;
  finishCount: number;
  finishedPlayers: PlayerId[];
  extraCards: Card[];
  // Card exchange
  exchangeGiven: Record<PlayerId, Card[]>;
  exchangePending: boolean;
  // Previous round
  previousRanks: Record<PlayerId, DaifugoRank> | null;
  // Pending special actions
  pendingAction: null | { type: "sevenPass"; count: number; playerId: PlayerId } | { type: "tenDiscard"; count: number; playerId: PlayerId };
  // Internal: signals next() to keep same player (8-cut, etc.)
  samePlayerNext: boolean;
  // Internal: number of players to skip (5-skip)
  skipCount: number;
}
