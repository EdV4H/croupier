import { describe, expect, it, vi } from "vitest";
import { CroupierCore } from "../src/croupier-core.js";
import { runSnapshotRoundTrip, jsonRoundTrip } from "../src/testing.js";
import { ROUND_ROBIN } from "../src/turn-orders.js";
import type { CroupierConfig, CroupierSnapshot, GameState } from "../src/types.js";
import { SNAPSHOT_FORMAT, SNAPSHOT_VERSION } from "../src/types.js";

// ====================
// A small draw game that reshuffles mid-game using ctx.random
// ====================

interface DrawState extends GameState {
  deck: number[];
  discard: number[];
  hands: Record<string, number[]>;
  reshuffles: number;
  enterCount: number;
}

function drawConfig(
  overrides: Partial<CroupierConfig<DrawState>> = {},
): CroupierConfig<DrawState> {
  return {
    name: "draw",
    setup: ({ players, random }) => ({
      deck: random.shuffle([1, 2, 3, 4, 5, 6]),
      discard: [],
      hands: Object.fromEntries(players.map((p) => [p, []])),
      reshuffles: 0,
      enterCount: 0,
    }),
    actions: {
      draw: {
        execute: (game, playerId, _payload, ctx) => {
          if (game.deck.length === 0) {
            game.deck = ctx.random.shuffle(game.discard);
            game.discard = [];
            game.reshuffles++;
          }
          game.hands[playerId].push(game.deck.pop()!);
        },
      },
      discard: {
        execute: (game, playerId, _payload, ctx) => {
          const hand = game.hands[playerId];
          const [card] = hand.splice(ctx.random.integer(0, hand.length - 1), 1);
          game.discard.push(card);
        },
        validate: (game, playerId) =>
          game.hands[playerId].length === 0 ? "Empty hand" : true,
      },
    },
    phases: {
      main: {
        allowedActions: ["draw", "discard"],
        turnOrder: ROUND_ROBIN,
        onEnter: (game) => {
          game.enterCount++;
        },
      },
    },
    endConditions: [
      {
        guard: (ctx) => ctx.game.reshuffles >= 3,
        result: (ctx) => ({ reason: "reshuffled", draws: ctx.log.length }),
      },
    ],
    bot: {
      decide: (playerId, view) => {
        const v = view as DrawState;
        return v.hands[playerId].length >= 2 ? { action: "discard" } : { action: "draw" };
      },
    },
    ...overrides,
  };
}

const PLAYERS = ["P1", "P2"];

describe("snapshot / restore", () => {
  it("produces a versioned, JSON-serializable snapshot", () => {
    const engine = new CroupierCore(drawConfig(), PLAYERS, { seed: 42 });
    const snap = engine.toSnapshot();
    expect(snap.format).toBe(SNAPSHOT_FORMAT);
    expect(snap.version).toBe(SNAPSHOT_VERSION);
    expect(snap.gameName).toBe("draw");
    expect(snap.revision).toBe(0);
    expect(jsonRoundTrip(snap)).toEqual(snap);
  });

  it("restores the same engine state and player views", () => {
    const engine = new CroupierCore(drawConfig(), PLAYERS, { seed: 42 });
    engine.dispatch("P1", "draw");
    engine.dispatch("P2", "draw");

    const restored = CroupierCore.fromSnapshot(drawConfig(), jsonRoundTrip(engine.toSnapshot()));
    expect(restored.getEngineState()).toEqual(engine.getEngineState());
    expect(restored.getState()).toEqual(engine.getState());
    for (const p of PLAYERS) {
      expect(restored.getPlayerView(p)).toEqual(engine.getPlayerView(p));
    }
    expect(restored.getLog()).toEqual(engine.getLog());
    expect(restored.getRevision()).toBe(engine.getRevision());
  });

  it("does not re-run setup() or onEnter on restore", () => {
    const setup = vi.fn(drawConfig().setup);
    const onEnter = vi.fn();
    const config = drawConfig({
      setup,
      phases: { main: { allowedActions: ["draw", "discard"], onEnter } },
    });
    const engine = new CroupierCore(config, PLAYERS, { seed: 1 });
    expect(setup).toHaveBeenCalledTimes(1);
    expect(onEnter).toHaveBeenCalledTimes(1);

    CroupierCore.fromSnapshot(config, jsonRoundTrip(engine.toSnapshot()));
    expect(setup).toHaveBeenCalledTimes(1);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("continues the seeded random sequence after restore", () => {
    const config = drawConfig();
    const engine = new CroupierCore(config, PLAYERS, { seed: 7 });
    const restored = CroupierCore.fromSnapshot(config, jsonRoundTrip(engine.toSnapshot()));

    // Play until several mid-game reshuffles have happened on both
    for (let i = 0; i < 40 && !engine.getEngineState().finished; i++) {
      const p = engine.getEngineState().currentPlayers as string;
      const action = engine.getState().hands[p].length >= 2 ? "discard" : "draw";
      expect(restored.dispatch(p, action)).toEqual(engine.dispatch(p, action));
    }
    expect(engine.getState().reshuffles).toBeGreaterThan(0);
    expect(restored.getState()).toEqual(engine.getState());
    expect(restored.getResult()).toEqual(engine.getResult());
  });

  it("exposes ctx.random to actions with the same seed as setup()", () => {
    const a = new CroupierCore(drawConfig(), PLAYERS, { seed: 99 });
    const b = new CroupierCore(drawConfig(), PLAYERS, { seed: 99 });
    expect(a.getState()).toEqual(b.getState());
    a.dispatch("P1", "draw");
    b.dispatch("P1", "draw");
    a.dispatch("P2", "draw");
    b.dispatch("P2", "draw");
    a.dispatch("P1", "draw");
    b.dispatch("P1", "draw");
    a.dispatch("P2", "discard");
    b.dispatch("P2", "discard");
    expect(a.getState()).toEqual(b.getState());
  });

  it("round-trips at every step of a full game", async () => {
    const { steps, finished } = await runSnapshotRoundTrip(drawConfig(), PLAYERS, { seed: 3 });
    expect(finished).toBe(true);
    expect(steps).toBeGreaterThan(10);
  });

  it("restores a finished game", () => {
    const engine = new CroupierCore(drawConfig(), PLAYERS, { seed: 5 });
    engine.endSession({ reason: "manual" });
    const restored = CroupierCore.fromSnapshot(drawConfig(), jsonRoundTrip(engine.toSnapshot()));
    expect(restored.getEngineState().finished).toBe(true);
    expect(restored.getResult()).toEqual({ reason: "manual" });
    expect(restored.dispatch("P1", "draw").ok).toBe(false);
  });

  it("restores the current stage", () => {
    const config: CroupierConfig<{ n: number }> = {
      name: "staged",
      setup: () => ({ n: 0 }),
      actions: { tick: { execute: (g) => void g.n++ } },
      phases: {
        main: {
          stages: {
            first: { allowedActions: ["tick"], always: [{ target: "second", guard: (c) => c.game.n >= 1 }] },
            second: { allowedActions: ["tick"] },
          },
        },
      },
    };
    const engine = new CroupierCore(config, PLAYERS, { seed: 1 });
    engine.dispatch("P1", "tick");
    expect(engine.getEngineState().stage).toBe("second");
    const restored = CroupierCore.fromSnapshot(config, jsonRoundTrip(engine.toSnapshot()));
    expect(restored.getEngineState()).toEqual(engine.getEngineState());
  });

  describe("revision", () => {
    it("increments on successful mutations only", () => {
      const engine = new CroupierCore(
        drawConfig({ onPlayerJoin: (game, p) => void (game.hands[p] = []) }),
        PLAYERS,
        { seed: 1 },
      );
      expect(engine.getRevision()).toBe(0);
      engine.dispatch("P1", "draw");
      expect(engine.getRevision()).toBe(1);
      engine.dispatch("P1", "draw"); // not P1's turn
      expect(engine.getRevision()).toBe(1);
      engine.addPlayer("P3");
      expect(engine.getRevision()).toBe(2);
      engine.endSession();
      expect(engine.getRevision()).toBe(3);
    });

    it("keeps counting across phase changes (unlike actionCount)", () => {
      const config: CroupierConfig<{ n: number }> = {
        name: "phases",
        setup: () => ({ n: 0 }),
        actions: { tick: { execute: (g) => void g.n++ } },
        phases: {
          a: { allowedActions: ["tick"], transitions: [{ target: "b", guard: () => true }] },
          b: { allowedActions: ["tick"] },
        },
      };
      const engine = new CroupierCore(config, PLAYERS, { seed: 1 });
      engine.dispatch("P1", "tick");
      expect(engine.getEngineState().phase).toBe("b");
      engine.dispatch("P1", "tick");
      expect(engine.toSnapshot().actionCount).toBe(1);
      expect(engine.getRevision()).toBe(2);
    });
  });

  describe("log option", () => {
    it("includes the full log by default and can limit or drop it", () => {
      const engine = new CroupierCore(drawConfig(), PLAYERS, { seed: 1 });
      engine.dispatch("P1", "draw");
      engine.dispatch("P2", "draw");
      engine.dispatch("P1", "draw");
      expect(engine.toSnapshot().log).toHaveLength(3);
      expect(engine.toSnapshot({ logLimit: 2 }).log.map((e) => e.playerId)).toEqual(["P2", "P1"]);
      expect(engine.toSnapshot({ logLimit: 0 }).log).toEqual([]);
    });
  });

  describe("compatibility checks", () => {
    const base = () => new CroupierCore(drawConfig(), PLAYERS, { seed: 1 }).toSnapshot();

    it("rejects an unknown format", () => {
      const snap = { ...base(), format: "other" } as unknown as CroupierSnapshot<DrawState>;
      expect(() => CroupierCore.fromSnapshot(drawConfig(), snap)).toThrow(/format/);
    });

    it("rejects an unsupported version", () => {
      const snap = { ...base(), version: SNAPSHOT_VERSION + 1 };
      expect(() => CroupierCore.fromSnapshot(drawConfig(), snap)).toThrow(/version/);
    });

    it("rejects a snapshot from a different game", () => {
      expect(() =>
        CroupierCore.fromSnapshot(drawConfig({ name: "other" }), base()),
      ).toThrow(/game/);
    });

    it("rejects an unknown phase", () => {
      const snap = { ...base(), phase: "nope" };
      expect(() => CroupierCore.fromSnapshot(drawConfig(), snap)).toThrow(/phase/);
    });
  });
});
