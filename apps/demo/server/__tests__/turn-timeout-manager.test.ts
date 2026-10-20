import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CroupierCore, ROUND_ROBIN, SIMULTANEOUS } from "@edv4h/croupier-core";
import type { BotStrategy, CroupierConfig, GameState } from "@edv4h/croupier-core";
import { TurnTimeoutManager } from "../turn-timeout-manager.js";

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
    name: "timeout-manager-test",
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
        turnTimeoutMs: 1000,
      },
    },
    bot: {
      decide: () => ({ action: "increment" }),
    },
    ...overrides,
  };
}

// ====================
// TurnTimeoutManager Tests
// ====================

describe("TurnTimeoutManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires bot takeover after timeout", async () => {
    const onTimeout = vi.fn();
    const config = createTestConfig();
    const engine = new CroupierCore<CounterState>(config, [
      "human1",
      "bot:Alice",
    ]);

    const manager = new TurnTimeoutManager(engine, onTimeout);

    // human1 is current player
    expect(engine.getEngineState().currentPlayers).toBe("human1");
    expect(engine.getState().count).toBe(0);

    // Advance past the timeout
    await vi.advanceTimersByTimeAsync(1100);

    expect(engine.getState().count).toBe(1);
    expect(onTimeout).toHaveBeenCalled();

    manager.dispose();
  });

  it("resets timer on stateChange", async () => {
    const onTimeout = vi.fn();
    const config = createTestConfig();
    const engine = new CroupierCore<CounterState>(config, [
      "human1",
      "human2",
    ]);

    const manager = new TurnTimeoutManager(engine, onTimeout);

    // Advance 800ms (not yet timed out)
    await vi.advanceTimersByTimeAsync(800);
    expect(onTimeout).not.toHaveBeenCalled();

    // Human acts, resetting the timer
    engine.dispatch("human1", "increment");
    expect(engine.getState().count).toBe(1);

    // Advance another 800ms — should NOT timeout (timer was reset)
    await vi.advanceTimersByTimeAsync(800);
    expect(onTimeout).not.toHaveBeenCalled();

    // Advance to full timeout from last action
    await vi.advanceTimersByTimeAsync(300);
    expect(onTimeout).toHaveBeenCalled();

    manager.dispose();
  });

  it("stops timer when game ends", async () => {
    const onTimeout = vi.fn();
    const config = createTestConfig({
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

    const manager = new TurnTimeoutManager(engine, onTimeout);

    // End the game
    engine.dispatch("human1", "increment");
    expect(engine.getEngineState().finished).toBe(true);

    // Timer should have been cleared on stateChange (game finished)
    await vi.advanceTimersByTimeAsync(2000);
    expect(onTimeout).not.toHaveBeenCalled();

    manager.dispose();
  });

  it("does not set timer when no turnTimeoutMs is configured", async () => {
    const onTimeout = vi.fn();
    const config = createTestConfig({
      phases: {
        main: {
          allowedActions: ["increment"],
          turnOrder: ROUND_ROBIN,
          // No turnTimeoutMs
        },
      },
    });
    const engine = new CroupierCore<CounterState>(config, [
      "human1",
      "bot:Alice",
    ]);

    const manager = new TurnTimeoutManager(engine, onTimeout);

    expect(manager.getDeadline()).toBeUndefined();

    await vi.advanceTimersByTimeAsync(5000);
    expect(onTimeout).not.toHaveBeenCalled();

    manager.dispose();
  });

  it("does not set timer when only bots are current players", async () => {
    const onTimeout = vi.fn();
    const config = createTestConfig();
    const engine = new CroupierCore<CounterState>(config, [
      "bot:Alice",
      "human1",
    ]);

    // bot:Alice is first (ROUND_ROBIN)
    expect(engine.getEngineState().currentPlayers).toBe("bot:Alice");

    const manager = new TurnTimeoutManager(engine, onTimeout);

    expect(manager.getDeadline()).toBeUndefined();

    await vi.advanceTimersByTimeAsync(2000);
    expect(onTimeout).not.toHaveBeenCalled();

    manager.dispose();
  });

  it("getDeadline returns the deadline when timer is active", () => {
    const config = createTestConfig();
    const engine = new CroupierCore<CounterState>(config, [
      "human1",
      "bot:Alice",
    ]);

    const now = Date.now();
    const manager = new TurnTimeoutManager(engine, vi.fn());

    const deadline = manager.getDeadline();
    expect(deadline).toBeDefined();
    // Deadline should be approximately now + 1000ms
    expect(deadline!).toBeGreaterThanOrEqual(now + 1000);
    expect(deadline!).toBeLessThanOrEqual(now + 1100);

    manager.dispose();
  });

  it("dispose cleans up timer and event listener", async () => {
    const onTimeout = vi.fn();
    const config = createTestConfig();
    const engine = new CroupierCore<CounterState>(config, [
      "human1",
      "bot:Alice",
    ]);

    const manager = new TurnTimeoutManager(engine, onTimeout);
    manager.dispose();

    // Timer should not fire after dispose
    await vi.advanceTimersByTimeAsync(2000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
