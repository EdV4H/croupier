import { describe, expect, it } from "vitest";
import { createMemoryHarness } from "./memory-harness.js";
import { SECRET_A } from "./fixtures.js";

describe("RoomHost", () => {
  it("handles one input per room at a time (bug 12)", async () => {
    const h = await createMemoryHarness();
    const created = await h.http("POST", "/api/rooms", { gameId: "race", playerId: "alice", secret: SECRET_A, botCount: 1 });
    const roomId = created.body.id;
    const a = await h.connect(roomId, "alice", SECRET_A);
    if (typeof a === "number") throw new Error("refused");
    await h.http("POST", `/api/rooms/${roomId}/start`, { playerId: "alice", secret: SECRET_A });

    // Fire many actions without waiting: exactly one may succeed, since it is then the bot's turn
    for (let i = 0; i < 5; i++) a.send({ type: "action", action: "step" });
    await h.settle();
    await new Promise((r) => setTimeout(r, 20));
    const results = a.messages.filter((m) => m.type === "actionResult").map((m: any) => m.data.ok);
    expect(results).toEqual([true, false, false, false, false]);
    const revisions = a.messages.filter((m) => m.type === "gameState").map((m: any) => m.data.revision);
    expect(revisions).toEqual([...revisions].sort((x, y) => x - y));
  });
});
