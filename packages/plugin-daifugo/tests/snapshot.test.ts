import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CroupierCore,
  SeededRandom,
  type CroupierConfig,
  type GameState,
} from "@croupier/core";
import { createDaifugoConfig } from "../src/index.js";

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
}

/**
 * Drive the game with its bot strategy. Before every action the engine is
 * round-tripped through toSnapshot() → JSON → fromSnapshot(), and the same
 * action is applied to both the original and the restored engine.
 */
async function playWithRoundTrips<S extends GameState>(
  config: CroupierConfig<S>,
  players: string[],
  seed: number,
  maxSteps: number,
) {
  const original = new CroupierCore(config, players, { seed });
  let restored = roundTrip(config, original);
  expectSameEngine(original, restored);

  let steps = 0;
  while (!original.getEngineState().finished && steps < maxSteps) {
    const es = original.getEngineState();
    const current = Array.isArray(es.currentPlayers)
      ? es.currentPlayers
      : [es.currentPlayers];

    // First current player whose bot decision is accepted
    let acted = false;
    for (const p of current) {
      const decision = await config.bot!.decide(p, original.getPlayerView(p), es);
      if (!decision) continue;
      const r1 = original.dispatch(p, decision.action, decision.payload);
      const r2 = restored.dispatch(p, decision.action, decision.payload);
      expect(r2).toEqual(r1);
      if (r1.ok) {
        acted = true;
        break;
      }
    }
    if (!acted) break;
    expectSameEngine(original, restored);

    restored = roundTrip(config, restored);
    expectSameEngine(original, restored);
    steps++;
  }

  return { original, restored, steps };
}

describe("snapshot round trip", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restored engine matches the original at every step", async () => {
    // Bot strategies use Math.random — seed it so the playthrough is reproducible
    const botRng = new SeededRandom(1);
    vi.spyOn(Math, "random").mockImplementation(() => botRng.next());

    const config = createDaifugoConfig();
    const { original, restored, steps } = await playWithRoundTrips(
      config,
      ["P1", "P2", "P3", "P4"],
      42,
      2000,
    );
    expect(steps).toBeGreaterThan(5);
    expect(restored.getRevision()).toBe(original.getRevision());
    expect(restored.getResult()).toEqual(original.getResult());
  });
});
