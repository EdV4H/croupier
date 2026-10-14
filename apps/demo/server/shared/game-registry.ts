import type { CroupierConfig, PlayerId } from "@edv4h/croupier-core";
import { createTexasHoldemConfig } from "@edv4h/croupier-plugin-texas-holdem";
import { createPlanningPokerConfig } from "@edv4h/croupier-plugin-planning-poker";
import { createValuesCardConfig } from "@edv4h/croupier-plugin-values-card";
import { createDigitalTCGConfig } from "@edv4h/croupier-plugin-digital-tcg";
import { createDaifugoConfig } from "@edv4h/croupier-plugin-daifugo";
import { createTrustBankConfig } from "@edv4h/croupier-plugin-trust-bank";
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
    id: "daifugo",
    name: "大富豪",
    description: "手札を最速で使い切れ！日本の定番カードゲーム",
    minPlayers: 3,
    maxPlayers: 6,
  },
  {
    id: "trust-bank",
    name: "Trust Bank",
    description: "信頼貯金カードゲーム — 信頼ポイントを貯めて生き残れ",
    minPlayers: 4,
    maxPlayers: 4,
  },
];

function validateCardArray(value: unknown, minLength: number, requiredFields: string[]): boolean {
  if (!Array.isArray(value) || value.length < minLength || value.length > 200) return false;
  return value.every(
    (item) => item != null && typeof item === "object" && requiredFields.every((f) => f in item),
  );
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
        ...(validateCardArray(gameOptions?.cards, 5 * players.length, ["id", "name"])
          ? { cards: gameOptions!.cards as any } : {}),
      });
    case "digital-tcg":
      return createDigitalTCGConfig({
        turnTimeoutMs: 90_000,
        ...(validateCardArray(gameOptions?.deck1, 5, ["id", "name", "cost", "attack", "health"])
          ? { deck1: gameOptions!.deck1 as any } : {}),
        ...(validateCardArray(gameOptions?.deck2, 5, ["id", "name", "cost", "attack", "health"])
          ? { deck2: gameOptions!.deck2 as any } : {}),
      });
    case "daifugo": {
      const KNOWN_RULES = new Set([
        "revolution", "eightCut", "capitalFall", "sequence", "suitLock",
        "elevenBack", "spadeThreeReturn", "sevenPass", "tenDiscard",
        "fiveSkip", "nineReverse", "restrictedFinish",
      ]);
      const rulesOpt = gameOptions?.rules;
      const validRules = rulesOpt && typeof rulesOpt === "object" && !Array.isArray(rulesOpt)
        ? Object.fromEntries(
            Object.entries(rulesOpt).filter(([k, v]) => KNOWN_RULES.has(k) && typeof v === "boolean"),
          )
        : undefined;
      return createDaifugoConfig({
        turnTimeoutMs: 30_000,
        ...(validRules && Object.keys(validRules).length > 0 ? { rules: validRules } : {}),
      });
    }
    case "trust-bank":
      return createTrustBankConfig({
        turnTimeoutMs: 60_000,
        ...(validateCardArray(gameOptions?.cards, 3 * players.length, ["id", "name", "category", "effects"])
          ? { cards: gameOptions!.cards as any } : {}),
      });
    default:
      throw new Error(`Unknown game: ${gameId}`);
  }
}
