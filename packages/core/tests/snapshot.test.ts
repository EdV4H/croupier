import { describe, expect, it, vi } from "vitest";
import { CroupierCore } from "../src/croupier-core.js";
import { ROUND_ROBIN } from "../src/turn-orders.js";
import type {
  CroupierConfig,
  CroupierSnapshot,
  GameState,
} from "../src/types.js";
import { SNAPSHOT_FORMAT_VERSION } from "../src/types.js";

// ====================
// Test game: draws use ctx.random, phases/stages have onEnter side effects
// ====================

interface DiceState extends GameState {
  deck: number[];
  rolls: Record<string, number[]>;
  enterCount: number;
  stageEnterCount: number;
  round: number;
}

function diceConfig(onSetup = vi.fn()): CroupierConfig<DiceState> {
  return {
    name: "dice",
    setup: (ctx) => {
      onSetup();
      return {
        deck: ctx.random.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]),
        rolls: Object.fromEntries(ctx.players.map((p) => [p, []])),
        enterCount: 0,
        stageEnterCount: 0,
        round: 0,
      };
    },
    actions: {
      roll: {
        execute: (game, playerId, _payload, ctx) => {
          game.rolls[playerId].push(ctx.random.integer(1, 6));
        },
      },
      reshuffle: {
        execute: (game, _playerId, _payload, ctx) => {
          game.deck = ctx.random.shuffle(game.deck);
        },
      },
      confirm: {
        execute: () => {},
      },
    },
    phases: {
      play: {
        turnOrder: ROUND_ROBIN,
        onEnter: (game) => {
          game.enterCount++;
          game.round++;
        },
        stages: {
          rolling: {
            allowedActions: ["roll", "reshuffle"],
            onEnter: (game) => {
              game.stageEnterCount++;
            },
            always: [
              {
                target: "confirming",
                guard: (ctx) =>
                  Object.values(ctx.game.rolls).every(
                    (r) => r.length >= ctx.game.round,
                  ),
              },
            ],
          },
          confirming: {
            allowedActions: ["confirm"],
            always: [{ target: "__done__", guard: () => true }],
          },
        },
        initialStage: "rolling",
        transitions: [{ target: "play", guard: () => true }],
      },
    },
    endConditions: [
      {
        guard: (ctx) => ctx.game.round > 3,
        result: (ctx) => ({
          reason: "done",
          totals: Object.fromEntries(
            Object.entries(ctx.game.rolls).map(([p, r]) => [
              p,
              r.reduce((a, b) => a + b, 0),
            ]),
          ),
        }),
      },
    ],
    view: {
      playerView: (state, playerId) => ({
        myRolls: state.rolls[playerId],
        deckCount: state.deck.length,
        round: state.round,
      }),
    },
  };
}

const PLAYERS = ["P1", "P2"];

function roundTrip<S extends GameState>(
  config: CroupierConfig<S>,
  engine: CroupierCore<S>,
): CroupierCore<S> {
  const json = JSON.stringify(engine.toSnapshot());
  return CroupierCore.fromSnapshot(config, JSON.parse(json));
}

function expectSameEngine<S extends GameState>(
  a: CroupierCore<S>,
  b: CroupierCore<S>,
) {
  expect(b.getEngineState()).toEqual(a.getEngineState());
  expect(b.getState()).toEqual(a.getState());
  for (const p of a.getEngineState().players) {
    expect(b.getPlayerView(p)).toEqual(a.getPlayerView(p));
  }
  expect(b.getRevision()).toBe(a.getRevision());
}

/** Dispatch the next legal action for the current player */
function step(engine: CroupierCore<DiceState>, action?: string) {
  const es = engine.getEngineState();
  const player = Array.isArray(es.currentPlayers)
    ? es.currentPlayers[0]
    : es.currentPlayers;
  const name = action ?? (es.stage === "confirming" ? "confirm" : "roll");
  return engine.dispatch(player, name);
}

describe("snapshot", () => {
  it("toSnapshot() captures the full engine state", () => {
    const engine = new CroupierCore(diceConfig(), PLAYERS, { seed: 7 });
    step(engine);

    const snap = engine.toSnapshot();
    expect(snap.formatVersion).toBe(SNAPSHOT_FORMAT_VERSION);
    expect(snap.gameName).toBe("dice");
    expect(snap.phase).toBe("play");
    expect(snap.stage).toBe("rolling");
    expect(snap.players).toEqual(PLAYERS);
    expect(snap.currentPlayers).toEqual(["P2"]);
    expect(snap.lastPlayer).toBe("P1");
    expect(snap.finished).toBe(false);
    expect(snap.result).toBeNull();
    expect(typeof snap.randomState).toBe("number");
    expect(snap.log).toHaveLength(1);
    expect(snap.revision).toBe(1);
  });

  it("toSnapshot() does not alias engine state", () => {
    const engine = new CroupierCore(diceConfig(), PLAYERS, { seed: 7 });
    const snap = engine.toSnapshot();
    snap.game.deck.length = 0;
    snap.players.push("X");
    expect(engine.getState().deck).toHaveLength(9);
    expect(engine.getEngineState().players).toEqual(PLAYERS);
  });

  it("round-trips through JSON at every step and stays in lockstep", () => {
    const config = diceConfig();
    const original = new CroupierCore(config, PLAYERS, { seed: 123 });
    let restored = roundTrip(config, original);
    expectSameEngine(original, restored);

    let steps = 0;
    while (!original.getEngineState().finished && steps < 100) {
      // Occasionally reshuffle mid-game to consume randomness in actions
      const action =
        steps % 5 === 0 && original.getEngineState().stage === "rolling"
          ? "reshuffle"
          : undefined;
      const r1 = step(original, action);
      const r2 = step(restored, action);
      expect(r2).toEqual(r1);
      expectSameEngine(original, restored);

      // Restore again from the restored engine (chained round trips)
      restored = roundTrip(config, restored);
      expectSameEngine(original, restored);
      steps++;
    }

    expect(original.getEngineState().finished).toBe(true);
    expect(restored.getResult()).toEqual(original.getResult());
    // Timestamps differ (separate dispatches); compare everything else
    const strip = (log: ReturnType<typeof original.getLog>) =>
      log.map(({ timestamp: _t, ...rest }) => rest);
    expect(strip(restored.getLog())).toEqual(strip(original.getLog()));
  });

  it("does not re-run setup() or onEnter hooks on restore", () => {
    const onSetup = vi.fn();
    const config = diceConfig(onSetup);
    const engine = new CroupierCore(config, PLAYERS, { seed: 1 });
    expect(onSetup).toHaveBeenCalledTimes(1);
    const before = engine.getState();

    const phaseListener = vi.fn();
    const restored = roundTrip(config, engine);
    restored.on("phaseChange", phaseListener);

    expect(onSetup).toHaveBeenCalledTimes(1);
    expect(restored.getState().enterCount).toBe(before.enterCount);
    expect(restored.getState().stageEnterCount).toBe(before.stageEnterCount);
    expect(phaseListener).not.toHaveBeenCalled();
  });

  it("restores the random state so later draws match", () => {
    const config = diceConfig();
    const a = new CroupierCore(config, PLAYERS, { seed: 99 });
    step(a);
    const b = roundTrip(config, a);
    for (let i = 0; i < 4; i++) {
      step(a, "reshuffle");
      step(b, "reshuffle");
    }
    expect(b.getState().deck).toEqual(a.getState().deck);
    expect(b.getState().rolls).toEqual(a.getState().rolls);
  });

  it("restores a finished game", () => {
    const config = diceConfig();
    const engine = new CroupierCore(config, PLAYERS, { seed: 5 });
    while (!engine.getEngineState().finished) step(engine);

    const restored = roundTrip(config, engine);
    expect(restored.getEngineState().finished).toBe(true);
    expect(restored.getResult()).toEqual(engine.getResult());
    expect(restored.dispatch("P1", "roll").ok).toBe(false);
  });

  it("supports actions with ctx.random", () => {
    const config = diceConfig();
    const a = new CroupierCore(config, PLAYERS, { seed: 3 });
    const b = new CroupierCore(config, PLAYERS, { seed: 3 });
    step(a);
    step(b);
    expect(a.getState().rolls).toEqual(b.getState().rolls);
  });

  describe("log options", () => {
    function playedEngine() {
      const engine = new CroupierCore(diceConfig(), PLAYERS, { seed: 2 });
      for (let i = 0; i < 5; i++) step(engine);
      return engine;
    }

    it("includes the full log by default", () => {
      const engine = playedEngine();
      expect(engine.toSnapshot().log).toEqual(engine.getLog());
    });

    it("omits the log with log: false", () => {
      const snap = playedEngine().toSnapshot({ log: false });
      expect(snap.log).toBeUndefined();
      const restored = CroupierCore.fromSnapshot(diceConfig(), snap);
      expect(restored.getLog()).toEqual([]);
    });

    it("keeps only the latest entries with logLimit", () => {
      const engine = playedEngine();
      const snap = engine.toSnapshot({ logLimit: 2 });
      expect(snap.log).toEqual(engine.getLog().slice(-2));
      expect(engine.toSnapshot({ logLimit: 0 }).log).toEqual([]);
    });
  });

  describe("revision", () => {
    it("increments on successful dispatch only", () => {
      const engine = new CroupierCore(diceConfig(), PLAYERS, { seed: 1 });
      expect(engine.getRevision()).toBe(0);
      step(engine);
      expect(engine.getRevision()).toBe(1);
      // Not P1's turn anymore
      expect(engine.dispatch("P1", "roll").ok).toBe(false);
      expect(engine.getRevision()).toBe(1);
    });

    it("increments on endSession", () => {
      const engine = new CroupierCore(diceConfig(), PLAYERS, { seed: 1 });
      engine.endSession();
      expect(engine.getRevision()).toBe(1);
    });

    it("is preserved and continues after restore", () => {
      const config = diceConfig();
      const engine = new CroupierCore(config, PLAYERS, { seed: 1 });
      step(engine);
      step(engine);
      const restored = roundTrip(config, engine);
      expect(restored.getRevision()).toBe(2);
      step(restored);
      expect(restored.getRevision()).toBe(3);
    });

    it("enables optimistic locking", () => {
      const config = diceConfig();
      const stored = new CroupierCore(config, PLAYERS, { seed: 1 }).toSnapshot();

      // Two workers load the same snapshot
      const w1 = CroupierCore.fromSnapshot(config, stored);
      const w2 = CroupierCore.fromSnapshot(config, stored);
      step(w1);
      step(w2);

      let current = stored;
      const save = (engine: CroupierCore<DiceState>, expected: number) => {
        if (current.revision !== expected) return false;
        current = engine.toSnapshot();
        return true;
      };
      expect(save(w1, stored.revision)).toBe(true);
      expect(save(w2, stored.revision)).toBe(false);
    });
  });

  describe("validation", () => {
    function snap(): CroupierSnapshot<DiceState> {
      return new CroupierCore(diceConfig(), PLAYERS, { seed: 1 }).toSnapshot();
    }

    it("rejects unknown format versions", () => {
      expect(() =>
        CroupierCore.fromSnapshot(diceConfig(), { ...snap(), formatVersion: 999 }),
      ).toThrow(/format version/);
    });

    it("rejects snapshots from another game", () => {
      expect(() =>
        CroupierCore.fromSnapshot(diceConfig(), { ...snap(), gameName: "other" }),
      ).toThrow(/other/);
    });

    it("rejects unknown phases and stages", () => {
      expect(() =>
        CroupierCore.fromSnapshot(diceConfig(), { ...snap(), phase: "nope" }),
      ).toThrow(/phase/);
      expect(() =>
        CroupierCore.fromSnapshot(diceConfig(), { ...snap(), stage: "nope" }),
      ).toThrow(/stage/);
    });

    it("does not alias the input snapshot", () => {
      const s = snap();
      const engine = CroupierCore.fromSnapshot(diceConfig(), s);
      step(engine);
      expect(s.game.rolls.P1).toEqual([]);
      expect(s.log).toEqual([]);
    });
  });
});
