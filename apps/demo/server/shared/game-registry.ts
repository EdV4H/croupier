import type { CroupierConfig, PlayerId } from "@croupier/core";
import { createTexasHoldemConfig } from "@croupier/plugin-texas-holdem";
import { createPlanningPokerConfig } from "@croupier/plugin-planning-poker";
import { createValuesCardConfig } from "@croupier/plugin-values-card";
import { createDigitalTCGConfig } from "@croupier/plugin-digital-tcg";
import type { GameInfo } from "./types.js";

export const AVAILABLE_GAMES: GameInfo[] = [
  {
    id: "texas-holdem",
    name: "Texas Hold'em",
    description: "Classic poker game with community cards",
    minPlayers: 2,
    maxPlayers: 8,
  },
  {
    id: "planning-poker",
    name: "Planning Poker",
    description: "Agile estimation tool for teams",
    minPlayers: 2,
    maxPlayers: 10,
  },
  {
    id: "values-card",
    name: "Values Card",
    description: "Discover and share your values with your team",
    minPlayers: 2,
    maxPlayers: 6,
  },
  {
    id: "digital-tcg",
    name: "Digital TCG",
    description: "Turn-based trading card game",
    minPlayers: 2,
    maxPlayers: 2,
  },
];

export function createGameConfig(
  gameId: string,
  players: PlayerId[],
): CroupierConfig<any> {
  switch (gameId) {
    case "texas-holdem":
      return createTexasHoldemConfig({ turnTimeoutMs: 30_000 });
    case "planning-poker":
      return createPlanningPokerConfig({
        facilitators: [players[0]],
        votingTimeoutMs: 60_000,
      });
    case "values-card":
      return createValuesCardConfig({ turnTimeoutMs: 60_000 });
    case "digital-tcg":
      return createDigitalTCGConfig({ turnTimeoutMs: 90_000 });
    default:
      throw new Error(`Unknown game: ${gameId}`);
  }
}
