import type { GameState, PlayerId } from "@croupier/core";

export type Role = "facilitator" | "voter";

export interface Task {
  id: string;
  title: string;
  description?: string;
}

export interface PlayerState {
  role: Role;
  selectedCard: string | null;
}

export interface RoundHistory {
  taskId: string;
  round: number;
  votes: Record<PlayerId, string>;
}

export interface PlanningPokerState extends GameState {
  currentTask: Task | null;
  deck: string[];
  players: Record<PlayerId, PlayerState>;
  playerOrder: PlayerId[];
  revealedCards: Record<PlayerId, string> | null;
  finalEstimate: string | null;
  roundHistory: RoundHistory[];
  roundNumber: number;
}
