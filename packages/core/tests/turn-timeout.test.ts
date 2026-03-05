import { describe, expect, it, vi } from "vitest";
import { getActiveTimeoutMs, executeBotTakeover } from "../src/turn-timeout.js";
import type {
  BotStrategy,
  CroupierConfig,
  EngineState,
  GameState,
} from "../src/types.js";
import type { TimeoutEngine } from "../src/turn-timeout.js";
import { ROUND_ROBIN, SIMULTANEOUS } from "../src/turn-orders.js";
import { CroupierCore } from "../src/croupier-core.js";

// ====================
// Test game config
// ====================

interface CounterState extends GameState {
  count: number;
  lastActor: string | null;
}

function createTestConfig(
  overrides: Partial<CroupierConfig<CounterState>> = {},
): CroupierConfig<CounterState> {
  return {
    name: "timeout-test",
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
    bot: {
      decide: () => ({ action: "increment" }),
    },
    ...overrides,
  };
}

// ====================
// getActiveTimeoutMs Tests
// ====================

describe("getActiveTimeoutMs", () => {
  it("returns undefined when no timeout is configured", () => {
    const config = createTestConfig();
    const engineState: EngineState = {
      phase: "main",
      currentPlayers: "p1",
      finished: false,
    };

    expect(getActiveTimeoutMs(config, engineState)).toBeUndefined();
  });

  it("returns phase-level turnTimeoutMs", () => {
    const config = createTestConfig({
      phases: {
        main: {
          allowedActions: ["increment"],
          turnOrder: ROUND_ROBIN,
          turnTimeoutMs: 30_000,
        },
      },
    });
    const engineState: EngineState = {
      phase: "main",
      currentPlayers: "p1",
      finished: false,
    };

    expect(getActiveTimeoutMs(config, engineState)).toBe(30_000);
  });

  it("returns stage-level turnTimeoutMs overriding phase-level", () => {
    const config = createTestConfig({
      phases: {
        main: {
          turnTimeoutMs: 30_000,
          stages: {
            draw: {
              allowedActions: ["increment"],
              turnTimeoutMs: 10_000,
            },
            discard: {
              allowedActions: ["increment"],
            },
          },
          initialStage: "draw",
        },
      },
    });

    // Stage with its own timeout
    expect(
      getActiveTimeoutMs(config, {
        phase: "main",
        stage: "draw",
        currentPlayers: "p1",
        finished: false,
      }),
    ).toBe(10_000);

    // Stage without timeout falls through to phase
    expect(
      getActiveTimeoutMs(config, {
        phase: "main",
        stage: "discard",
        currentPlayers: "p1",
        finished: false,
      }),
    ).toBe(30_000);
  });

  it("returns undefined for unknown phase", () => {
    const config = createTestConfig();
    const engineState: EngineState = {
      phase: "nonexistent",
      currentPlayers: "p1",
      finished: false,
    };

    expect(getActiveTimeoutMs(config, engineState)).toBeUndefined();
  });
});

// ====================
// executeBotTakeover Tests
// ====================

describe("executeBotTakeover", () => {
  it("executes bot strategy for human players", async () => {
    const config = createTestConfig({
      phases: {
        main: {
          allowedActions: ["increment"],
          turnOrder: ROUND_ROBIN,
          turnTimeoutMs: 30_000,
        },
      },
    });
    const engine = new CroupierCore<CounterState>(config, [
      "human1",
      "bot:Alice",
    ]);

    // human1 is first player (ROUND_ROBIN)
    expect(engine.getEngineState().currentPlayers).toBe("human1");
    expect(engine.getState().count).toBe(0);

    const results = await executeBotTakeover(engine, config.bot!);

    expect(results).toHaveLength(1);
    expect(results[0].playerId).toBe("human1");
    expect(results[0].decision).toEqual({ action: "increment" });
    expect(engine.getState().count).toBe(1);
  });

  it("skips bot players (only takes over for humans)", async () => {
    const config = createTestConfig({
      phases: {
        main: {
          allowedActions: ["increment"],
          turnOrder: ROUND_ROBIN,
          turnTimeoutMs: 30_000,
        },
      },
    });
    const engine = new CroupierCore<CounterState>(config, [
      "bot:Alice",
      "human1",
    ]);

    // bot:Alice is first — executeBotTakeover should NOT act for bots
    expect(engine.getEngineState().currentPlayers).toBe("bot:Alice");

    const results = await executeBotTakeover(engine, config.bot!);
    expect(results).toHaveLength(0);
    expect(engine.getState().count).toBe(0);
  });

  it("handles decide() returning null (skip)", async () => {
    const skipStrategy: BotStrategy<CounterState> = {
      decide: () => null,
    };
    const config = createTestConfig({
      phases: {
        main: {
          allowedActions: ["increment"],
          turnOrder: ROUND_ROBIN,
          turnTimeoutMs: 30_000,
        },
      },
    });
    const engine = new CroupierCore<CounterState>(config, [
      "human1",
      "bot:Alice",
    ]);

    const results = await executeBotTakeover(engine, skipStrategy);

    expect(results).toHaveLength(1);
    expect(results[0].playerId).toBe("human1");
    expect(results[0].decision).toBeNull();
    expect(engine.getState().count).toBe(0); // No action dispatched
  });

  it("does nothing when game is finished", async () => {
    const config = createTestConfig({
      phases: {
        main: {
          allowedActions: ["increment"],
          turnOrder: ROUND_ROBIN,
          turnTimeoutMs: 30_000,
        },
      },
      endConditions: [
        {
          guard: (ctx) => ctx.game.count >= 1,
          result: () => ({ reason: "Done" }),
        },
      ],
    });
    const engine = new CroupierCore<CounterState>(config, [
      "human1",
      "bot:Alice",
    ]);

    // End the game
    engine.dispatch("human1", "increment");
    expect(engine.getEngineState().finished).toBe(true);

    const results = await executeBotTakeover(engine, config.bot!);
    expect(results).toHaveLength(0);
  });

  it("uses fallback when decide() throws", async () => {
    const errorStrategy: BotStrategy<CounterState> = {
      decide: () => {
        throw new Error("decide failed");
      },
      fallback: () => ({ action: "increment" }),
    };
    const config = createTestConfig({
      phases: {
        main: {
          allowedActions: ["increment"],
          turnOrder: ROUND_ROBIN,
          turnTimeoutMs: 30_000,
        },
      },
    });
    const engine = new CroupierCore<CounterState>(config, [
      "human1",
      "bot:Alice",
    ]);

    const results = await executeBotTakeover(engine, errorStrategy);

    expect(results).toHaveLength(1);
    expect(results[0].decision).toEqual({ action: "increment" });
    expect(engine.getState().count).toBe(1);
  });

  it("handles SIMULTANEOUS phase with multiple human players", async () => {
    const config = createTestConfig({
      phases: {
        main: {
          allowedActions: ["increment"],
          turnOrder: SIMULTANEOUS,
          turnTimeoutMs: 60_000,
        },
      },
    });
    const engine = new CroupierCore<CounterState>(config, [
      "human1",
      "human2",
      "bot:Alice",
    ]);

    // SIMULTANEOUS: all players are current
    const currentPlayers = engine.getEngineState().currentPlayers;
    expect(currentPlayers).toEqual(["human1", "human2", "bot:Alice"]);

    const results = await executeBotTakeover(engine, config.bot!);

    // Should only act for human1 and human2, not bot:Alice
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.playerId)).toEqual(["human1", "human2"]);
  });

  it("handles async decide()", async () => {
    const asyncStrategy: BotStrategy<CounterState> = {
      decide: async () => ({ action: "increment" }),
    };
    const config = createTestConfig({
      phases: {
        main: {
          allowedActions: ["increment"],
          turnOrder: ROUND_ROBIN,
          turnTimeoutMs: 30_000,
        },
      },
    });
    const engine = new CroupierCore<CounterState>(config, [
      "human1",
      "bot:Alice",
    ]);

    const results = await executeBotTakeover(engine, asyncStrategy);

    expect(results).toHaveLength(1);
    expect(engine.getState().count).toBe(1);
  });
});
