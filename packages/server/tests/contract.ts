/**
 * Behaviour every runtime must share. Runs against the in-memory host (Node)
 * and against real Durable Objects (workerd). Bug numbers refer to the redesign plan.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { Harness, TestClient } from "./harness.js";
import { SECRET_A, SECRET_B, SECRET_C } from "./fixtures.js";

const ALICE = { playerId: "alice", secret: SECRET_A };
const BOB = { playerId: "bob", secret: SECRET_B };
const CAROL = { playerId: "carol", secret: SECRET_C };

export function defineContractTests(name: string, makeHarness: () => Promise<Harness>) {
  describe(`room server contract (${name})`, () => {
    let h: Harness;

    beforeEach(async () => {
      h = await makeHarness();
    });

    async function createRoom(extra: Record<string, unknown> = {}) {
      const res = await h.http("POST", "/api/rooms", { gameId: "race", ...ALICE, ...extra });
      expect(res.status).toBe(201);
      return res.body.id as string;
    }

    async function client(roomId: string, who: { playerId: string; secret: string }): Promise<TestClient> {
      const c = await h.connect(roomId, who.playerId, who.secret);
      if (typeof c === "number") throw new Error(`connect refused: ${c}`);
      await c.waitFor("connected");
      return c;
    }

    /** Alice + Bob in a started room, both connected */
    async function startedRoom(extra: Record<string, unknown> = {}) {
      const roomId = await createRoom(extra);
      expect((await h.http("POST", `/api/rooms/${roomId}/join`, BOB)).status).toBe(200);
      const a = await client(roomId, ALICE);
      const b = await client(roomId, BOB);
      expect((await h.http("POST", `/api/rooms/${roomId}/start`, ALICE)).status).toBe(200);
      await a.waitFor("gameState");
      await b.waitFor("gameState");
      return { roomId, a, b };
    }

    function action(c: TestClient, name = "step") {
      c.send({ type: "action", action: name });
    }

    // ------------------------------------------------------------
    // Rooms
    // ------------------------------------------------------------

    it("creates, lists and describes a room", async () => {
      const roomId = await createRoom();
      const room = await h.http("GET", `/api/rooms/${roomId}`);
      expect(room.body).toMatchObject({ id: roomId, gameId: "race", creatorId: "alice", players: ["alice"], status: "waiting" });
      const list = await h.http("GET", "/api/rooms");
      expect(list.body.map((r: any) => r.id)).toContain(roomId);
      expect(JSON.stringify(list.body)).not.toContain(SECRET_A);
    });

    it("rejects an unknown game without leaving a lobby entry (bug 9)", async () => {
      const res = await h.http("POST", "/api/rooms", { gameId: "nope", ...ALICE });
      expect(res.status).toBe(400);
      expect((await h.http("GET", "/api/rooms")).body).toEqual([]);
    });

    it("answers 404 for a room that does not exist (bug 8)", async () => {
      expect((await h.http("GET", "/api/rooms/ZZZZ")).status).toBe(404);
      expect((await h.http("POST", "/api/rooms/ZZZZ/join", BOB)).status).toBe(404);
      expect(await h.connect("ZZZZ", "bob", SECRET_B)).toBe(404);
    });

    it("tells connected players when someone joins", async () => {
      const roomId = await createRoom();
      const a = await client(roomId, ALICE);
      await h.http("POST", `/api/rooms/${roomId}/join`, BOB);
      const msg = await a.waitFor("room", (m) => m.data.players.includes("bob"));
      expect(msg.data.players).toEqual(["alice", "bob"]);
    });

    it("does not let another browser take a name already used in the room (bug 15)", async () => {
      const roomId = await createRoom();
      expect((await h.http("POST", `/api/rooms/${roomId}/join`, { playerId: "alice", secret: SECRET_B })).status).toBe(403);
      expect(await h.connect(roomId, "alice", SECRET_B)).toBe(403);
      expect(await h.connect(roomId, "bob", SECRET_B)).toBe(403);
    });

    it("lets a member rejoin with the same secret", async () => {
      const roomId = await createRoom();
      expect((await h.http("POST", `/api/rooms/${roomId}/join`, ALICE)).status).toBe(200);
    });

    it("only lets the creator start or delete, with the right secret (bug 16)", async () => {
      const roomId = await createRoom();
      await h.http("POST", `/api/rooms/${roomId}/join`, BOB);
      expect((await h.http("POST", `/api/rooms/${roomId}/start`, BOB)).status).toBe(403);
      expect((await h.http("POST", `/api/rooms/${roomId}/start`, { playerId: "alice", secret: SECRET_B })).status).toBe(403);
      expect((await h.http("DELETE", `/api/rooms/${roomId}`, BOB)).status).toBe(403);
      expect((await h.http("DELETE", `/api/rooms/${roomId}`, ALICE)).status).toBe(204);
      expect((await h.http("GET", `/api/rooms/${roomId}`)).status).toBe(404);
    });

    it("tells connected players when the room is deleted", async () => {
      const roomId = await createRoom();
      const a = await client(roomId, ALICE);
      await h.http("DELETE", `/api/rooms/${roomId}`, ALICE);
      const msg = await a.waitFor("roomDeleted");
      expect(msg.reason).toBe("deleted");
      expect((await h.http("GET", "/api/rooms")).body).toEqual([]);
    });

    it("frees the seat when a player leaves before the start (bug 17)", async () => {
      const roomId = await createRoom();
      await h.http("POST", `/api/rooms/${roomId}/join`, BOB);
      await h.http("POST", `/api/rooms/${roomId}/join`, CAROL);
      expect((await h.http("POST", `/api/rooms/${roomId}/leave`, BOB)).status).toBe(200);
      expect((await h.http("GET", `/api/rooms/${roomId}`)).body.players).toEqual(["alice", "carol"]);

      // Creator leaving hands the room to the next human
      await h.http("POST", `/api/rooms/${roomId}/leave`, ALICE);
      expect((await h.http("GET", `/api/rooms/${roomId}`)).body.creatorId).toBe("carol");

      // Last human leaving deletes it
      await h.http("POST", `/api/rooms/${roomId}/leave`, CAROL);
      expect((await h.http("GET", `/api/rooms/${roomId}`)).status).toBe(404);
    });

    it("removes a room that never starts (bug 18)", async () => {
      const roomId = await createRoom();
      await h.advance(31 * 60_000);
      expect((await h.http("GET", `/api/rooms/${roomId}`)).status).toBe(404);
      expect((await h.http("GET", "/api/rooms")).body).toEqual([]);
    });

    // ------------------------------------------------------------
    // Playing
    // ------------------------------------------------------------

    it("starts the game and sends each player a state with a deadline and revision", async () => {
      const { a } = await startedRoom();
      const state = await a.waitFor("gameState");
      expect(state.data.engineState.currentPlayers).toBe("alice");
      expect(state.data.turnDeadline).toEqual(expect.any(Number));
      expect(state.data.revision).toEqual(expect.any(Number));
      expect((await h.http("GET", "/api/rooms")).body[0].status).toBe("playing");
    });

    it("passes gameOptions to the game (bug 6)", async () => {
      const { a } = await startedRoom({ gameOptions: { target: 2 } });
      const state = await a.waitFor("gameState");
      expect((state.data.playerView as any).target).toBe(2);
    });

    it("rejects an out-of-turn action and broadcasts a valid one", async () => {
      const { a, b } = await startedRoom();
      a.clear();
      b.clear();
      action(b);
      expect((await b.waitFor("actionResult")).data.ok).toBe(false);

      action(a);
      expect((await a.waitFor("actionResult")).data.ok).toBe(true);
      const seen = await b.waitFor("gameState");
      expect((seen.data.playerView as any).count).toBe(1);
      expect(seen.data.engineState.currentPlayers).toBe("bob");
    });

    it("answers getState with the deadline (bug 7)", async () => {
      const { a } = await startedRoom();
      a.clear();
      a.send({ type: "getState" });
      const state = await a.waitFor("gameState");
      expect(state.data.turnDeadline).toEqual(expect.any(Number));
    });

    it("rejects malformed messages", async () => {
      const { a } = await startedRoom();
      a.clear();
      a.send({ type: "nonsense" });
      await a.waitFor("error");
    });

    it("lets a bot take over an idle player's turn (bugs 2, 5)", async () => {
      const { a } = await startedRoom();
      a.clear();
      await h.advance(30_000);
      const state = await a.waitFor("gameState", (m) => (m.data.playerView as any).count === 1);
      expect(state.data.engineState.currentPlayers).toBe("bob");
      expect((await h.http("GET", "/api/rooms")).body).toHaveLength(1);
    });

    it("keeps the room when a human hands the turn to a bot (bug 14)", async () => {
      const roomId = await createRoom({ botCount: 1 });
      const a = await client(roomId, ALICE);
      await h.http("POST", `/api/rooms/${roomId}/start`, ALICE);
      await a.waitFor("gameState");
      a.clear();
      action(a);
      await a.waitFor("actionResult");

      // Bot plays after its delay, then it is Alice's turn again
      await h.advance(1_000);
      const afterBot = await a.waitFor("gameState", (m) => (m.data.playerView as any).count === 2);
      expect(afterBot.data.engineState.currentPlayers).toBe("alice");

      // Past the deadline set before the bot moved, the room must still be playing
      await h.advance(29_500);
      expect((await h.http("GET", `/api/rooms/${roomId}`)).status).toBe(200);
    });

    it("plays bots to the end and removes the finished room after the result is shown (bugs 4, 18)", async () => {
      const roomId = await createRoom({ botCount: 1, gameOptions: { target: 4 } });
      const a = await client(roomId, ALICE);
      await h.http("POST", `/api/rooms/${roomId}/start`, ALICE);
      await a.waitFor("gameState");

      for (let i = 0; i < 2; i++) {
        a.clear();
        action(a);
        await a.waitFor("actionResult");
        await h.advance(1_000);
      }
      const final = await a.waitFor("gameState", (m) => m.data.engineState.finished);
      expect(final.data.engineState.result?.winner).toBe("bot:Alice");
      expect((await h.http("GET", `/api/rooms/${roomId}`)).body.status).toBe("finished");

      await h.advance(30_000);
      expect((await a.waitFor("roomDeleted")).reason).toBe("expired");
      expect((await h.http("GET", `/api/rooms/${roomId}`)).status).toBe(404);
    });

    it("lets a player join mid-game when the game allows it", async () => {
      const { roomId, a } = await startedRoom();
      a.clear();
      expect((await h.http("POST", `/api/rooms/${roomId}/join`, CAROL)).status).toBe(200);
      const room = await a.waitFor("room", (m) => m.data.players.includes("carol"));
      expect(room.data.status).toBe("playing");
      const c = await client(roomId, CAROL);
      const state = await c.waitFor("gameState");
      expect(state.data.engineState.players).toContain("carol");
    });

    it("sends the latest state to a player who reconnects", async () => {
      const { roomId, a, b } = await startedRoom();
      action(a);
      await b.waitFor("gameState", (m) => (m.data.playerView as any).count === 1);
      b.close();
      const again = await client(roomId, BOB);
      const state = await again.waitFor("gameState");
      expect((state.data.playerView as any).count).toBe(1);
    });
  });
}
