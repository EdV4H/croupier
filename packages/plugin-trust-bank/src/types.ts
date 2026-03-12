import type { GameState, PlayerId } from "@croupier/core";

/** Card categories */
export type CardCategory =
  | "trust"
  | "crisis"
  | "attack"
  | "repair"
  | "relationship";

/** Effect target */
export interface TrustEffect {
  target: "self" | "target" | "all";
  points: number;
  /** If true, coin flip determines +/- */
  coinFlip?: boolean;
}

/** Static card definition */
export interface CardDefinition {
  id: number;
  name: string;
  category: CardCategory;
  effects: TrustEffect[];
  requiresTarget: boolean;
  /** Special card behavior identifier */
  special?: string;
  description: string;
}

/** Lightweight card instance in deck/hand */
export interface Card {
  id: string;
  definitionId: number;
}

/** Mission difficulty levels */
export type MissionDifficulty = "easy" | "normal" | "hard";

/** Static mission definition */
export interface MissionDefinition {
  id: string;
  name: string;
  description: string;
  difficulty: MissionDifficulty;
  bonus: number;
}

/** Per-player mission progress tracking */
export interface MissionProgress {
  missionId: string;
  completed: boolean;
  // Action counters
  attackCount: number;
  consecutiveWithdrawals: number;
  targetAttackCount: Record<string, number>;
  repairCount: number;
  // State flags
  wasBelow5: boolean;
  wasBelow3: boolean;
  // Survival counters
  turnsWithoutAttack: number;
  attacksReceived: number;
}

/** Turn event for history tracking */
export interface TurnEvent {
  turn: number;
  playerId: PlayerId;
  cardDefinitionId: number;
  category: CardCategory;
  targetPlayerId?: PlayerId;
}

/** Per-player state */
export interface PlayerState {
  hand: Card[];
  trustPoints: number;
  eliminated: boolean;
  mission: string;
  missionProgress: MissionProgress;
}

/** Main game state */
export interface TrustBankState extends GameState {
  deck: Card[];
  players: Record<PlayerId, PlayerState>;
  playerOrder: PlayerId[];
  currentPlayerIndex: number;
  turnCount: number;
  /** Card drawn in the draw stage */
  drawnCard: Card | null;
  /** Card selected to play */
  selectedCard: Card | null;
  /** Selected target player */
  selectedTarget: PlayerId | null;
  /** Turn history for special card checks */
  turnHistory: TurnEvent[];
  /** Last coin flip result (for view) */
  lastCoinFlipResult: boolean | null;
  /** Random seed for reproducibility */
  randomSeed: number;
  /** Remaining mission cards not dealt */
  missionDeck: string[];
  /** Missions that have been opened (completed and revealed) */
  openedMissions: Record<PlayerId, { missionId: string; name: string; description: string; bonus: number }>;
}
