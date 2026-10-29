import { ROUND_ROBIN, type CroupierConfig, type GameState } from "@edv4h/croupier-core";
import type { GameRegistry } from "../src/index.js";

export interface RaceState extends GameState {
  count: number;
  target: number;
}

/** Players take turns calling "step"; the game ends when count reaches target. */
export function createRaceConfig(options?: Record<string, unknown>): CroupierConfig<RaceState> {
  const target = typeof options?.target === "number" ? options.target : 6;
  return {
    name: "race",
    setup: () => ({ count: 0, target }),
    actions: {
      step: {
        execute: (game) => {
          game.count++;
        },
      },
      cheer: {
        unrestricted: true,
        execute: () => {},
      },
    },
    phases: {
      main: { turnOrder: ROUND_ROBIN, allowedActions: ["step", "cheer"], turnTimeoutMs: 30_000 },
    },
    endConditions: [
      {
        guard: (ctx) => ctx.game.count >= ctx.game.target,
        result: (ctx) => ({ winner: ctx.lastPlayer, reason: "target reached" }),
      },
    ],
    onPlayerJoin: () => {},
    bot: { decide: () => ({ action: "step" }) },
  };
}

export const registry: GameRegistry = {
  games: [{ id: "race", name: "Race", description: "Count to the target", minPlayers: 2, maxPlayers: 4 }],
  createConfig: (gameId, _players, options) => {
    if (gameId !== "race") throw new Error(`Unknown game: ${gameId}`);
    return createRaceConfig(options);
  },
};

export const SECRET_A = "secret-alice-0123456789";
export const SECRET_B = "secret-bob-0123456789ab";
export const SECRET_C = "secret-carol-0123456789";
