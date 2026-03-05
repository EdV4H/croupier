import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CroupierCore } from "../src/croupier-core.js";
import { BotManager } from "../src/bot-manager.js";
import {
  isBotPlayer,
  createBotId,
  getBotDisplayName,
  BOT_PREFIX,
  BOT_NAMES,
} from "../src/bot-utils.js";
import { ROUND_ROBIN } from "../src/turn-orders.js";
import type {
  BotStrategy,
  CroupierConfig,
  GameState,
} from "../src/types.js";

// ====================
// Test game config
// ====================

interface CounterState extends GameState {
  count: number;
  lastActor: string | null;
}

function createTestConfig(
  botStrategy: BotStrategy<CounterState>,
  overrides: Partial<CroupierConfig<CounterState>> = {},
): CroupierConfig<CounterState> {
  return {
    name: "bot-test",
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
    endConditions: [
      {
        guard: (ctx) => ctx.game.count >= 4,
        result: (ctx) => ({ winner: ctx.game.lastActor, reason: "Reached 4" }),
      },
    ],
    bot: botStrategy,
    ...overrides,
  };
}

// ====================
// Bot Utils Tests
// ====================

describe("Bot Utils", () => {
  it("isBotPlayer detects bot prefix", () => {
    expect(isBotPlayer("bot:Alice")).toBe(true);
    expect(isBotPlayer("human-player")).toBe(false);
    expect(isBotPlayer("")).toBe(false);
  });

  it("createBotId creates prefixed ID", () => {
    expect(createBotId("Alice")).toBe("bot:Alice");
    expect(createBotId("Bob")).toBe("bot:Bob");
  });

  it("getBotDisplayName extracts name from bot ID", () => {
    expect(getBotDisplayName("bot:Alice")).toBe("Alice");
    expect(getBotDisplayName("bot:Charlie")).toBe("Charlie");
    // Non-bot IDs return as-is
    expect(getBotDisplayName("human-player")).toBe("human-player");
  });

  it("BOT_PREFIX is correct", () => {
    expect(BOT_PREFIX).toBe("bot:");
  });

  it("BOT_NAMES has expected entries", () => {
    expect(BOT_NAMES.length).toBe(8);
    expect(BOT_NAMES).toContain("Alice");
    expect(BOT_NAMES).toContain("Bob");
  });
});

// ====================
// BotManager Tests
// ====================

describe("BotManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws if no bot strategy is provided", () => {
    const config: CroupierConfig<CounterState> = {
      name: "no-bot",
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
        main: { allowedActions: ["increment"], turnOrder: ROUND_ROBIN },
      },
    };

    const engine = new CroupierCore(config, ["p1", "bot:Alice"]);

    expect(() => new BotManager(engine, ["bot:Alice"])).toThrow(
      "No bot strategy defined",
    );
  });

  it("starts and stops the tick loop", () => {
    const strategy: BotStrategy<CounterState> = {
      decide: () => ({ action: "increment" }),
    };

    const config = createTestConfig(strategy);
    const engine = new CroupierCore(config, ["p1", "bot:Alice"]);
    const manager = new BotManager(engine, ["bot:Alice"], { delayMs: 100 });

    expect(manager.isRunning()).toBe(false);
    manager.start();
    expect(manager.isRunning()).toBe(true);
    manager.stop();
    expect(manager.isRunning()).toBe(false);
  });

  it("bot dispatches actions on tick", async () => {
    const strategy: BotStrategy<CounterState> = {
      decide: (_playerId, _view, engineState) => {
        return { action: "increment" };
      },
    };

    const config = createTestConfig(strategy);
    const engine = new CroupierCore(config, ["p1", "bot:Alice"]);
    const manager = new BotManager(engine, ["bot:Alice"], { delayMs: 100 });

    // p1 acts first (ROUND_ROBIN), bot:Alice is second
    engine.dispatch("p1", "increment");
    expect(engine.getState().count).toBe(1);

    // Now it's bot's turn
    manager.start();
    await vi.advanceTimersByTimeAsync(150);
    expect(engine.getState().count).toBe(2);

    manager.stop();
  });

  it("bot auto-stops when game ends", async () => {
    const strategy: BotStrategy<CounterState> = {
      decide: () => ({ action: "increment" }),
    };

    const config = createTestConfig(strategy);
    const engine = new CroupierCore(config, ["bot:Alice", "bot:Bob"]);
    const manager = new BotManager(engine, ["bot:Alice", "bot:Bob"], {
      delayMs: 50,
    });

    manager.start();
    // Run enough ticks for 4 increments
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(60);
    }

    expect(engine.getEngineState().finished).toBe(true);
    expect(engine.getState().count).toBe(4);
    expect(manager.isRunning()).toBe(false);
  });

  it("bot returns null to skip a tick", async () => {
    let callCount = 0;
    const strategy: BotStrategy<CounterState> = {
      decide: () => {
        callCount++;
        // Skip first tick, act on second
        return callCount > 1 ? { action: "increment" } : null;
      },
    };

    const config = createTestConfig(strategy);
    const engine = new CroupierCore(config, ["p1", "bot:Alice"]);

    // Make it bot's turn
    engine.dispatch("p1", "increment");

    const manager = new BotManager(engine, ["bot:Alice"], { delayMs: 50 });
    manager.start();

    // First tick: bot returns null, no action
    await vi.advanceTimersByTimeAsync(60);
    expect(engine.getState().count).toBe(1);

    // Second tick: bot acts
    await vi.advanceTimersByTimeAsync(60);
    expect(engine.getState().count).toBe(2);

    manager.stop();
  });

  it("supports async decide()", async () => {
    const strategy: BotStrategy<CounterState> = {
      decide: async () => {
        return { action: "increment" };
      },
    };

    const config = createTestConfig(strategy);
    const engine = new CroupierCore(config, ["p1", "bot:Alice"]);
    engine.dispatch("p1", "increment");

    const manager = new BotManager(engine, ["bot:Alice"], { delayMs: 50 });
    manager.start();

    await vi.advanceTimersByTimeAsync(60);
    expect(engine.getState().count).toBe(2);

    manager.stop();
  });

  it("uses fallback when decide() throws", async () => {
    const strategy: BotStrategy<CounterState> = {
      decide: () => {
        throw new Error("decide failed");
      },
      fallback: () => {
        return { action: "increment" };
      },
    };

    const config = createTestConfig(strategy);
    const engine = new CroupierCore(config, ["p1", "bot:Alice"]);
    engine.dispatch("p1", "increment");

    const manager = new BotManager(engine, ["bot:Alice"], { delayMs: 50 });
    manager.start();

    await vi.advanceTimersByTimeAsync(60);
    expect(engine.getState().count).toBe(2);

    manager.stop();
  });

  it("uses fallback when async decide() times out", async () => {
    const strategy: BotStrategy<CounterState> = {
      decide: async () => {
        // Never resolves
        return new Promise(() => {});
      },
      fallback: () => {
        return { action: "increment" };
      },
    };

    const config = createTestConfig(strategy);
    const engine = new CroupierCore(config, ["p1", "bot:Alice"]);
    engine.dispatch("p1", "increment");

    const manager = new BotManager(engine, ["bot:Alice"], {
      delayMs: 50,
      timeoutMs: 200,
    });
    manager.start();

    // Advance past timeout
    await vi.advanceTimersByTimeAsync(300);
    expect(engine.getState().count).toBe(2);

    manager.stop();
  });

  it("does not double-start", () => {
    const strategy: BotStrategy<CounterState> = {
      decide: () => null,
    };

    const config = createTestConfig(strategy);
    const engine = new CroupierCore(config, ["p1", "bot:Alice"]);
    const manager = new BotManager(engine, ["bot:Alice"], { delayMs: 100 });

    manager.start();
    manager.start(); // Should not throw or create duplicate timers
    expect(manager.isRunning()).toBe(true);

    manager.stop();
  });

  it("getConfig() returns the engine config", () => {
    const strategy: BotStrategy<CounterState> = {
      decide: () => null,
    };

    const config = createTestConfig(strategy);
    const engine = new CroupierCore(config, ["p1", "bot:Alice"]);
    const retrievedConfig = engine.getConfig();

    expect(retrievedConfig.name).toBe("bot-test");
    expect(retrievedConfig.bot).toBe(strategy);
  });
});
