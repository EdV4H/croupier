import { describe, expect, it } from "vitest";
import { RoomLogic, nextWakeup, type RoomState } from "@croupier/server";
import { registry } from "../shared/game-registry.js";

const SECRET = "demo-test-secret-0123456789";
/** Games where nothing happens until the human (the facilitator) acts */
const WAITS_FOR_HUMAN = new Set(["planning-poker"]);

/** Plays every demo game with bots (the human is covered by turn timeouts),
 *  persisting the room as JSON between every step like the real server does. */
describe.each(registry.games.map((g) => [g.id, g] as const))("%s on the room server", (gameId, game) => {
  it("survives being stored and restored at every step", async () => {
    const logic = new RoomLogic(registry);
    let now = 1_700_000_000_000;
    let state: RoomState | null = logic.create(
      null,
      "TEST",
      { gameId, playerId: "alice", secret: SECRET, botCount: game.minPlayers - 1 },
      now,
    ).state;
    state = logic.start(state, { playerId: "alice", secret: SECRET }, now).state;
    expect(state?.status).toBe("playing");
    const startRevision = state!.engine!.revision;

    for (let step = 0; step < 300 && state && state.status === "playing"; step++) {
      state = JSON.parse(JSON.stringify(state)) as RoomState;
      const at = nextWakeup(state);
      // Only the idle cleanup is left: the game waits for the human
      if (at === null || at === state.timers.cleanupAt) break;
      now = Math.max(now, at);
      const outcome = await logic.wake(state, now);
      if (outcome.changed) state = outcome.state;
      if (state) expect(logic.onConnect(state, "alice").length).toBeGreaterThan(1);
    }

    expect(state).not.toBeNull();
    if (!WAITS_FOR_HUMAN.has(gameId)) expect(state!.engine!.revision).toBeGreaterThan(startRevision);
  });
});
