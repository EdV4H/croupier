import type { PlayerId } from "@croupier/core";

export interface GameInfo {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

export interface RoomSummary {
  id: string;
  gameId: string;
  players: PlayerId[];
  started: boolean;
  createdAt: number;
  creatorId: string;
}
