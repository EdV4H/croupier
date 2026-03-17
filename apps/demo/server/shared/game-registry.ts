import type { CroupierConfig, PlayerId } from "@croupier/core";
import { createTexasHoldemConfig } from "@croupier/plugin-texas-holdem";
import { createPlanningPokerConfig } from "@croupier/plugin-planning-poker";
import { createValuesCardConfig } from "@croupier/plugin-values-card";
import { createDigitalTCGConfig } from "@croupier/plugin-digital-tcg";
import { createTrustBankConfig } from "@croupier/plugin-trust-bank";
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
  {
    id: "trust-bank",
    name: "Trust Bank",
    description: "信頼貯金カードゲーム — 信頼ポイントを貯めて生き残れ",
    minPlayers: 4,
    maxPlayers: 4,
  },
];

function validateCardArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.length <= 200;
}

export function createGameConfig(
  gameId: string,
  players: PlayerId[],
  gameOptions?: Record<string, unknown>,
): CroupierConfig<any> {
  switch (gameId) {
    case "texas-holdem":
      return createTexasHoldemConfig({ turnTimeoutMs: 30_000 });
    case "planning-poker":
      return createPlanningPokerConfig({
        facilitators: [players[0]],
        facilitatorCanVote: true,
      });
    case "values-card":
      return createValuesCardConfig({
        turnTimeoutMs: 60_000,
        ...(validateCardArray(gameOptions?.cards) ? { cards: gameOptions!.cards as any } : {}),
      });
    case "digital-tcg":
      return createDigitalTCGConfig({
        turnTimeoutMs: 90_000,
        ...(validateCardArray(gameOptions?.deck1) ? { deck1: gameOptions!.deck1 as any } : {}),
        ...(validateCardArray(gameOptions?.deck2) ? { deck2: gameOptions!.deck2 as any } : {}),
      });
    case "trust-bank":
      return createTrustBankConfig({
        turnTimeoutMs: 60_000,
        ...(validateCardArray(gameOptions?.cards) ? { cards: gameOptions!.cards as any } : {}),
      });
    default:
      throw new Error(`Unknown game: ${gameId}`);
  }
}
