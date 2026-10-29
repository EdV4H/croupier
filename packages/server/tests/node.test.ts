import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startNodeServer } from "../src/adapters/node.js";
import { MessageLog } from "./harness.js";
import { registry, SECRET_A, SECRET_B } from "./fixtures.js";

/** Real sockets through @hono/node-server and @hono/node-ws */
describe("node adapter", () => {
  let server: ReturnType<typeof startNodeServer>;
  let base = "";

  beforeAll(async () => {
    server = startNodeServer({ registry, port: 0 });
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    base = `127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  const post = (path: string, body: unknown) =>
    fetch(`http://${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  function open(roomId: string, playerId: string, secret: string) {
    const ws = new WebSocket(`ws://${base}/ws/${roomId}/${playerId}?secret=${secret}`);
    const log = new MessageLog();
    ws.addEventListener("message", (e) => log.push(JSON.parse(String(e.data))));
    // Node's WebSocket reports a refused upgrade with "error" and may never fire "close"
    const closed = new Promise<void>((resolve) => {
      ws.addEventListener("close", () => resolve());
      ws.addEventListener("error", () => resolve());
    });
    return { ws, log, closed };
  }

  it("serves REST and WebSocket for room members only", async () => {
    const created = await (await post("/api/rooms", { gameId: "race", playerId: "alice", secret: SECRET_A })).json();
    expect((await post(`/api/rooms/${created.id}/join`, { playerId: "bob", secret: SECRET_B })).status).toBe(200);

    const intruder = open(created.id, "alice", SECRET_B);
    await intruder.closed;
    expect(intruder.log.messages).toEqual([]);

    const alice = open(created.id, "alice", SECRET_A);
    await alice.log.waitFor("connected");
    expect((await post(`/api/rooms/${created.id}/start`, { playerId: "alice", secret: SECRET_A })).status).toBe(200);
    await alice.log.waitFor("gameState");

    alice.ws.send(JSON.stringify({ type: "action", action: "step" }));
    const state = await alice.log.waitFor("gameState", (m) => m.data.playerView.count === 1);
    expect(state.data.engineState.currentPlayers).toBe("bob");
    alice.ws.close();
  });
});
