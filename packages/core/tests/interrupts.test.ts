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
        execute: (state, playerId, payload) => {
          const target = payload as string;
          state.lives[target]--;
        },
        validate: (state, _pid, payload) => {
          const target = payload as string;
          if (!state.lives[target]) return "Invalid target";
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
    interrupts: [
      {
        condition: (state) => {
          for (const [pid, life] of Object.entries(state.lives)) {
            if (life <= 0) {
              const winner = Object.keys(state.lives).find((p) => p !== pid);
              return { winner, reason: `${pid} defeated` };
            }
          }
          return null;
        },
      },
    ],
  };
}

describe("Interrupts", () => {
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
    engine.dispatch("P1", "attack", "P2"); // P2: 0 → interrupt!
    expect(engine.getEngineState().finished).toBe(true);
    expect(engine.getEngineState().result?.winner).toBe("P1");
  });

  it("emits gameEnd event on interrupt", () => {
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

  it("prevents further actions after interrupt", () => {
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

describe("endIf", () => {
  it("ends game when endIf returns a result", () => {
    const config: CroupierConfig<{ score: number }> = {
      name: "score-game",
      setup: () => ({ score: 0 }),
      actions: {
        score: { execute: (state) => { state.score += 10; } },
      },
      phases: {
        main: {
          allowedActions: ["score"],
          turnOrder: ROUND_ROBIN,
        },
      },
      endIf: (state) =>
        state.score >= 20 ? { winner: "P1", reason: "Score limit" } : null,
    };
    const engine = new CroupierCore(config, ["P1", "P2"]);
    engine.dispatch("P1", "score");
    expect(engine.getEngineState().finished).toBe(false);
    engine.dispatch("P2", "score");
    expect(engine.getEngineState().finished).toBe(true);
    expect(engine.getEngineState().result?.reason).toBe("Score limit");
  });
});
