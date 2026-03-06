import { describe, expect, it, vi } from "vitest";
import { CroupierCore } from "../src/croupier-core.js";
import { ROUND_ROBIN } from "../src/turn-orders.js";
import type { CroupierConfig, GameState } from "../src/types.js";

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

describe("getResult()", () => {
  it("returns null when game is not finished and no getResult callback", () => {
    const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
    expect(engine.getResult()).toBeNull();
  });

  it("returns live snapshot when getResult callback is defined", () => {
    const config = counterConfig({
      getResult: (game) => ({
        reason: "snapshot",
        playerResults: {
          P1: { score: game.count },
        },
      }),
    });
    const engine = new CroupierCore(config, ["P1", "P2"]);
    engine.dispatch("P1", "increment");

    const result = engine.getResult();
    expect(result).not.toBeNull();
    expect(result!.reason).toBe("snapshot");
    expect(result!.playerResults!.P1.score).toBe(1);
  });

  it("returns final result after game ends", () => {
    const config = counterConfig({
      endConditions: [
        {
          guard: (ctx) => ctx.game.count >= 1,
          result: () => ({ winner: "P1", reason: "reached 1" }),
        },
      ],
    });
    const engine = new CroupierCore(config, ["P1", "P2"]);
    engine.dispatch("P1", "increment");

    expect(engine.getEngineState().finished).toBe(true);
    const result = engine.getResult();
    expect(result).not.toBeNull();
    expect(result!.winner).toBe("P1");
    expect(result!.reason).toBe("reached 1");
  });

  it("returns deep clone of final result", () => {
    const config = counterConfig({
      endConditions: [
        {
          guard: (ctx) => ctx.game.count >= 1,
          result: () => ({
            winner: "P1",
            playerResults: { P1: { score: 1 } },
          }),
        },
      ],
    });
    const engine = new CroupierCore(config, ["P1", "P2"]);
    engine.dispatch("P1", "increment");

    const r1 = engine.getResult();
    const r2 = engine.getResult();
    expect(r1).toEqual(r2);
    expect(r1).not.toBe(r2);
  });
});

describe("endSession()", () => {
  it("ends the game and fires gameEnd event", () => {
    const handler = vi.fn();
    const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
    engine.on("gameEnd", handler);

    engine.endSession();

    expect(engine.getEngineState().finished).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].result.reason).toBe("Session ended");
  });

  it("throws when game is already finished", () => {
    const config = counterConfig({
      endConditions: [
        {
          guard: (ctx) => ctx.game.count >= 1,
          result: () => ({ winner: "P1" }),
        },
      ],
    });
    const engine = new CroupierCore(config, ["P1", "P2"]);
    engine.dispatch("P1", "increment");

    expect(() => engine.endSession()).toThrow("Game already finished");
  });

  it("uses provided result when given", () => {
    const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
    engine.endSession({ winner: "P1", reason: "custom end" });

    const result = engine.getResult();
    expect(result!.winner).toBe("P1");
    expect(result!.reason).toBe("custom end");
  });

  it("computes result from getResult callback when no explicit result given", () => {
    const config = counterConfig({
      getResult: (game) => ({
        reason: "computed",
        playerResults: {
          P1: { score: game.count },
        },
      }),
    });
    const engine = new CroupierCore(config, ["P1", "P2"]);
    engine.dispatch("P1", "increment");
    engine.endSession();

    const result = engine.getResult();
    expect(result!.reason).toBe("computed");
    expect(result!.playerResults!.P1.score).toBe(1);
  });

  it("uses default reason when no result and no getResult callback", () => {
    const engine = new CroupierCore(counterConfig(), ["P1", "P2"]);
    engine.endSession();

    const result = engine.getResult();
    expect(result!.reason).toBe("Session ended");
  });
});
