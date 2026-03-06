import { describe, expect, it, vi } from "vitest";
import { CroupierCore } from "../src/croupier-core.js";
import { ROUND_ROBIN } from "../src/turn-orders.js";
import type { CroupierConfig, GameState } from "../src/types.js";

interface SimpleState extends GameState {
  joined: string[];
}

function simpleConfig(
  overrides: Partial<CroupierConfig<SimpleState>> = {},
): CroupierConfig<SimpleState> {
  return {
    name: "simple",
    setup: () => ({ joined: [] }),
    actions: {
      noop: {
        execute: () => {},
        unrestricted: true,
      },
    },
    phases: {
      main: {
        allowedActions: ["noop"],
        turnOrder: ROUND_ROBIN,
      },
    },
    ...overrides,
  };
}

describe("addPlayer", () => {
  it("adds a player to ctx.players", () => {
    const config = simpleConfig({
      onPlayerJoin: (game, playerId) => {
        game.joined.push(playerId);
      },
    });
    const engine = new CroupierCore(config, ["P1", "P2"]);
    const result = engine.addPlayer("P3");
    expect(result.ok).toBe(true);
    expect(engine.getEngineState().players).toContain("P3");
    expect(engine.getState().joined).toContain("P3");
  });

  it("rejects duplicate player", () => {
    const config = simpleConfig({
      onPlayerJoin: () => {},
    });
    const engine = new CroupierCore(config, ["P1", "P2"]);
    const result = engine.addPlayer("P1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("already in game");
  });

  it("rejects when game is finished", () => {
    const config = simpleConfig({
      onPlayerJoin: () => {},
      endConditions: [
        {
          guard: (ctx) => ctx.actionCount >= 1,
          result: () => ({ winner: null }),
        },
      ],
    });
    const engine = new CroupierCore(config, ["P1", "P2"]);
    engine.dispatch("P1", "noop");
    const result = engine.addPlayer("P3");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("finished");
  });

  it("rejects when onPlayerJoin is not defined", () => {
    const config = simpleConfig();
    const engine = new CroupierCore(config, ["P1", "P2"]);
    const result = engine.addPlayer("P3");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("does not support mid-game joining");
  });

  it("rejects when onPlayerJoin returns false", () => {
    const config = simpleConfig({
      onPlayerJoin: () => false,
    });
    const engine = new CroupierCore(config, ["P1", "P2"]);
    const result = engine.addPlayer("P3");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("rejected");
  });

  it("emits playerJoin and stateChange events", () => {
    const config = simpleConfig({
      onPlayerJoin: () => {},
    });
    const engine = new CroupierCore(config, ["P1", "P2"]);
    const joinListener = vi.fn();
    const stateListener = vi.fn();
    engine.on("playerJoin", joinListener);
    engine.on("stateChange", stateListener);

    engine.addPlayer("P3");

    expect(joinListener).toHaveBeenCalledOnce();
    expect(joinListener.mock.calls[0][0]).toEqual({ playerId: "P3" });
    expect(stateListener).toHaveBeenCalled();
  });

  it("reflects in getEngineState().players", () => {
    const config = simpleConfig({
      onPlayerJoin: () => {},
    });
    const engine = new CroupierCore(config, ["P1", "P2"]);
    expect(engine.getEngineState().players).toEqual(["P1", "P2"]);

    engine.addPlayer("P3");
    expect(engine.getEngineState().players).toEqual(["P1", "P2", "P3"]);
  });
});
