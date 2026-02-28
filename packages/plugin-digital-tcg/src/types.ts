import type { GameState, PlayerId } from "@croupier/core";

export interface Card {
  id: string;
  name: string;
  cost: number;
  attack: number;
  health: number;
  type: "creature" | "spell";
  effect?: string;
}

export interface Entity {
  card: Card;
  currentHealth: number;
  hasAttacked: boolean;
  summoningSickness: boolean;
}

export interface PlayerState {
  life: number;
  maxMana: number;
  currentMana: number;
  deck: Card[];
  hand: Card[];
  board: Entity[];
  graveyard: Card[];
}

export interface TCGState extends GameState {
  turnCount: number;
  activePlayer: PlayerId;
  players: Record<PlayerId, PlayerState>;
  playerOrder: PlayerId[];
}
