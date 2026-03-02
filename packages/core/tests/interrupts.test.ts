import { describe, expect, it, vi } from "vitest";
import { CroupierCore } from "../src/croupier-core.js";
import { ROUND_ROBIN } from "../src/turn-orders.js";
import type { CroupierConfig, GameState } from "../src/types.js";

interface LifeState extends GameState {
  lives: Record<string, number>;
}

function interruptConfig(): CroupierConfig<LifeState> {
  return {
    name: "interrupt-game",
    setup: (ctx) => {
      const lives: Record<string, number> = {};
      for (const p of ctx.players) lives[p] = 3;
      return { lives };
    },
    actions: {
      attack: {
        execute: (game, playerId, payload) => {
          const target = payload as string;
          game.lives[target]--;
        },
        validate: (game, _pid, payload) => {
          const target = payload as string;
          if (!game.lives[target]) return "Invalid target";
          return true;
        },
      },
    },
    phases: {
      battle: {
        allowedActions: ["attack"],
        turnOrder: ROUND_ROBIN,
      },
    },
    endConditions: [
      {
        guard: (ctx) => {
          for (const [_pid, life] of Object.entries(ctx.game.lives)) {
            if (life <= 0) return true;
          }
          return false;
        },
        result: (ctx) => {
          for (const [pid, life] of Object.entries(ctx.game.lives)) {
            if (life <= 0) {
              const winner = Object.keys(ctx.game.lives).find((p) => p !== pid);
              return { winner, reason: `${pid} defeated` };
            }
          }
          return { reason: "Unknown" };
        },
        priority: 0, // interrupt-like, checked first
      },
    ],
  };
}

describe("End Conditions (interrupts)", () => {
  it("does not trigger when condition is not met", () => {
    const engine = new CroupierCore(interruptConfig(), ["P1", "P2"]);
    engine.dispatch("P1", "attack", "P2");
    expect(engine.getEngineState().finished).toBe(false);
  });

  it("triggers when life reaches 0", () => {
    const engine = new CroupierCore(interruptConfig(), ["P1", "P2"]);
    engine.dispatch("P1", "attack", "P2"); // P2: 2
    engine.dispatch("P2", "attack", "P1"); // P1: 2
    engine.dispatch("P1", "attack", "P2"); // P2: 1
    engine.dispatch("P2", "attack", "P1"); // P1: 1
    engine.dispatch("P1", "attack", "P2"); // P2: 0 → end condition!
    expect(engine.getEngineState().finished).toBe(true);
    expect(engine.getEngineState().result?.winner).toBe("P1");
  });

  it("emits gameEnd event on end condition", () => {
    const engine = new CroupierCore(interruptConfig(), ["P1", "P2"]);
    const listener = vi.fn();
    engine.on("gameEnd", listener);
    engine.dispatch("P1", "attack", "P2");
    engine.dispatch("P2", "attack", "P1");
    engine.dispatch("P1", "attack", "P2");
    engine.dispatch("P2", "attack", "P1");
    engine.dispatch("P1", "attack", "P2");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("prevents further actions after end condition", () => {
    const engine = new CroupierCore(interruptConfig(), ["P1", "P2"]);
    engine.dispatch("P1", "attack", "P2");
    engine.dispatch("P2", "attack", "P1");
    engine.dispatch("P1", "attack", "P2");
    engine.dispatch("P2", "attack", "P1");
    engine.dispatch("P1", "attack", "P2"); // game over
    const result = engine.dispatch("P2", "attack", "P1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("already finished");
  });
});

describe("endConditions (endIf-like)", () => {
  it("ends game when endCondition returns a result", () => {
    const config: CroupierConfig<{ score: number }> = {
      name: "score-game",
      setup: () => ({ score: 0 }),
      actions: {
        score: { execute: (game) => { game.score += 10; } },
      },
      phases: {
        main: {
          allowedActions: ["score"],
          turnOrder: ROUND_ROBIN,
        },
      },
      endConditions: [
        {
          guard: (ctx) => ctx.game.score >= 20,
          result: () => ({ winner: "P1", reason: "Score limit" }),
        },
      ],
    };
    const engine = new CroupierCore(config, ["P1", "P2"]);
    engine.dispatch("P1", "score");
    expect(engine.getEngineState().finished).toBe(false);
    engine.dispatch("P2", "score");
    expect(engine.getEngineState().finished).toBe(true);
    expect(engine.getEngineState().result?.reason).toBe("Score limit");
  });
});
