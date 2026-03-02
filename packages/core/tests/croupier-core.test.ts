import { describe, expect, it, vi } from "vitest";
import { CroupierCore } from "../src/croupier-core.js";
import { ROUND_ROBIN, SIMULTANEOUS } from "../src/turn-orders.js";
import type { CroupierConfig, GameState } from "../src/types.js";

// ====================
// Simple counter game for basic tests
// ====================

interface CounterState extends GameState {
  count: number;
  lastActor: string | null;
}

function counterConfig(
  overrides: Partial<CroupierConfig<CounterState>> = {},
): CroupierConfig<CounterState> {
  return {
    name: "counter",
    setup: () => ({ count: 0, lastActor: null }),
    actions: {
      increment: {
        execute: (game, playerId) => {
          game.count++;
          game.lastActor = playerId;
        },
      },
    },
    phases: {
      main: {
        allowedActions: ["increment"],
        turnOrder: ROUND_ROBIN,
      },
    },
    ...overrides,
  };
}

describe("CroupierCore", () => {
  describe("construction", () => {
    it("creates an instance with initial state", () => {
      const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
      const state = engine.getState();
      expect(state.count).toBe(0);
      expect(state.lastActor).toBeNull();
    });

    it("sets engine state to initial phase", () => {
      const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
      const es = engine.getEngineState();
      expect(es.phase).toBe("main");
      expect(es.finished).toBe(false);
    });

    it("sets first player from turn order", () => {
      const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
      const es = engine.getEngineState();
      expect(es.currentPlayers).toBe("P1");
    });

    it("uses initialPhase when specified", () => {
      const config = counterConfig({
        initialPhase: "main",
        phases: {
          setup: { allowedActions: [] },
          main: { allowedActions: ["increment"], turnOrder: ROUND_ROBIN },
        },
      });
      const engine = new CroupierCore(config, ["P1"]);
      expect(engine.getEngineState().phase).toBe("main");
    });
  });

  describe("dispatch", () => {
    it("executes an action and updates state", () => {
      const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
      const result = engine.dispatch("P1", "increment");
      expect(result.ok).toBe(true);
      expect(engine.getState().count).toBe(1);
      expect(engine.getState().lastActor).toBe("P1");
    });

    it("rejects action from wrong player", () => {
      const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
      const result = engine.dispatch("P2", "increment");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("not player");
    });

    it("rejects unknown action", () => {
      const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
      const result = engine.dispatch("P1", "unknown");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Unknown action");
    });

    it("rejects action when game is finished", () => {
      const config = counterConfig({
        endConditions: [
          {
            guard: (ctx) => ctx.game.count >= 1,
            result: (ctx) => ({ winner: ctx.game.lastActor }),
          },
        ],
      });
      const engine = new CroupierCore(config, ["P1", "P2"]);
      engine.dispatch("P1", "increment");
      const result = engine.dispatch("P2", "increment");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("already finished");
    });

    it("advances turn after action", () => {
      const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
      engine.dispatch("P1", "increment");
      expect(engine.getEngineState().currentPlayers).toBe("P2");
    });

    it("records action in log", () => {
      const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
      engine.dispatch("P1", "increment", { extra: "data" });
      const log = engine.getLog();
      expect(log).toHaveLength(1);
      expect(log[0].playerId).toBe("P1");
      expect(log[0].action).toBe("increment");
      expect(log[0].payload).toEqual({ extra: "data" });
    });
  });

  describe("action validation", () => {
    it("rejects action not in allowedActions", () => {
      const config = counterConfig({
        actions: {
          increment: { execute: (g) => { g.count++; } },
          decrement: { execute: (g) => { g.count--; } },
        },
        phases: {
          main: {
            allowedActions: ["increment"],
            turnOrder: ROUND_ROBIN,
          },
        },
      });
      const engine = new CroupierCore(config, ["P1"]);
      const result = engine.dispatch("P1", "decrement");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("runs custom validate function", () => {
      const config = counterConfig({
        actions: {
          increment: {
            execute: (game) => {
              game.count++;
            },
            validate: (_game, _pid, payload) => {
              if (payload === "bad") return "bad payload";
              return true;
            },
          },
        },
      });
      const engine = new CroupierCore(config, ["P1"]);
      const result = engine.dispatch("P1", "increment", "bad");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("bad payload");
    });
  });

  describe("unrestricted actions", () => {
    it("allows unrestricted action from any player", () => {
      const config = counterConfig({
        actions: {
          increment: { execute: (g) => { g.count++; } },
          reset: {
            execute: (game) => {
              game.count = 0;
            },
            unrestricted: true,
          },
        },
        phases: {
          main: {
            allowedActions: ["increment", "reset"],
            turnOrder: ROUND_ROBIN,
          },
        },
      });
      const engine = new CroupierCore(config, ["P1", "P2"]);
      // P2 is not the current player, but reset is unrestricted
      const result = engine.dispatch("P2", "reset");
      expect(result.ok).toBe(true);
    });
  });

  describe("events", () => {
    it("emits action event", () => {
      const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
      const listener = vi.fn();
      engine.on("action", listener);
      engine.dispatch("P1", "increment");
      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][0].action).toBe("increment");
    });

    it("emits stateChange event", () => {
      const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
      const listener = vi.fn();
      engine.on("stateChange", listener);
      engine.dispatch("P1", "increment");
      expect(listener).toHaveBeenCalled();
    });

    it("emits gameEnd event", () => {
      const config = counterConfig({
        endConditions: [
          {
            guard: (ctx) => ctx.game.count >= 1,
            result: (ctx) => ({ winner: ctx.game.lastActor }),
          },
        ],
      });
      const engine = new CroupierCore(config, ["P1", "P2"]);
      const listener = vi.fn();
      engine.on("gameEnd", listener);
      engine.dispatch("P1", "increment");
      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][0].result.winner).toBe("P1");
    });
  });

  describe("setup context", () => {
    it("passes correct numPlayers and players", () => {
      let receivedCtx: any;
      const config = counterConfig({
        setup: (ctx) => {
          receivedCtx = ctx;
          return { count: 0, lastActor: null };
        },
      });
      new CroupierCore(config, ["Alice", "Bob", "Charlie"]);
      expect(receivedCtx.numPlayers).toBe(3);
      expect(receivedCtx.players).toEqual(["Alice", "Bob", "Charlie"]);
    });

    it("provides random utility with seed", () => {
      let receivedCtx: any;
      const config = counterConfig({
        setup: (ctx) => {
          receivedCtx = ctx;
          return { count: 0, lastActor: null };
        },
      });
      new CroupierCore(config, ["P1"], { seed: 42 });
      expect(receivedCtx.random).toBeDefined();
      expect(typeof receivedCtx.random.shuffle).toBe("function");
      expect(typeof receivedCtx.random.integer).toBe("function");
      expect(typeof receivedCtx.random.pick).toBe("function");
    });
  });
});
