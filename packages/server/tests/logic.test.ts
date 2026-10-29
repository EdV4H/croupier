import { describe, expect, it } from "vitest";
import { RoomLogic, nextWakeup, type GameRegistry, type RoomState } from "../src/index.js";
import { createRaceConfig, registry, SECRET_A, SECRET_B } from "./fixtures.js";

const T0 = 1_700_000_000_000;

function startedState(logic: RoomLogic, extra: Record<string, unknown> = {}): RoomState {
  let state = logic.create(null, "ROOM", { gameId: "race", playerId: "alice", secret: SECRET_A, ...extra }, T0).state!;
  state = logic.join(state, { playerId: "bob", secret: SECRET_B }, T0).state!;
  return logic.start(state, { playerId: "alice", secret: SECRET_A }, T0).state!;
}

describe("RoomLogic", () => {
  it("is JSON-serializable after every step", () => {
    const logic = new RoomLogic(registry);
    const state = startedState(logic);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("does not mutate the input state", () => {
    const logic = new RoomLogic(registry);
    const state = startedState(logic);
    const copy = structuredClone(state);
    logic.message(state, "alice", { type: "action", action: "step" }, T0 + 5);
    expect(state).toEqual(copy);
  });

  it("wakes at the earliest timer", () => {
    const logic = new RoomLogic(registry);
    const state = startedState(logic);
    expect(state.timers.turnDeadline).toBe(T0 + 30_000);
    expect(nextWakeup(state)).toBe(T0 + 30_000);
  });

  it("does nothing when woken early", async () => {
    const logic = new RoomLogic(registry);
    const state = startedState(logic);
    const outcome = await logic.wake(state, T0 + 29_999);
    expect(outcome.changed).toBe(false);
  });

  it("stops retrying a takeover the bot cannot play (bug 22)", async () => {
    const stuck: GameRegistry = {
      ...registry,
      createConfig: () => ({ ...createRaceConfig(), bot: { decide: () => ({ action: "nope" }) } }),
    };
    const logic = new RoomLogic(stuck);
    const state = startedState(logic);
    const outcome = await logic.wake(state, T0 + 30_000);
    expect(outcome.state!.timers.turnDeadline).toBeNull();
    expect(outcome.effects).toEqual([]);
  });

  it("falls back when a bot decide() hangs", async () => {
    const slow: GameRegistry = {
      ...registry,
      createConfig: () => ({
        ...createRaceConfig(),
        bot: { decide: () => new Promise(() => {}), fallback: () => ({ action: "step" }) },
      }),
    };
    const logic = new RoomLogic(slow, { botDecideTimeoutMs: 10 });
    let state = logic.create(null, "ROOM", { gameId: "race", playerId: "alice", secret: SECRET_A, botCount: 1 }, T0).state!;
    state = logic.start(state, { playerId: "alice", secret: SECRET_A }, T0).state!;
    state = logic.message(state, "alice", { type: "action", action: "step" }, T0).state!;
    const outcome = await logic.wake(state, T0 + 1_000);
    expect((outcome.state!.engine!.game as any).count).toBe(2);
  });
});
