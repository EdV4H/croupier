import { SELF, env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { defineContractTests } from "../contract.js";
import { MessageLog, type Harness, type TestClient } from "../harness.js";
import { testClock } from "./worker.js";

async function createWorkersHarness(): Promise<Harness> {
  // Storage is shared between tests (WebSockets need it), so start from an empty lobby
  const lobby = env.LOBBY.get(env.LOBBY.idFromName("singleton"));
  await runInDurableObject(lobby, (_obj, state) => state.storage.deleteAll());
  testClock.offset = 0;
  const rooms = new Set<string>();
  const settle = () => new Promise<void>((r) => setTimeout(r, 30));

  const roomStub = (id: string) => env.GAME_ROOM.get(env.GAME_ROOM.idFromName(id));

  return {
    settle,
    async http(method, path, body) {
      const res = await SELF.fetch(`https://test${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      const parsed = text ? JSON.parse(text) : null;
      if (method === "POST" && path === "/api/rooms" && parsed?.id) rooms.add(parsed.id);
      return { status: res.status, body: parsed };
    },
    async connect(roomId, playerId, secret) {
      const res = await SELF.fetch(
        `https://test/ws/${roomId}/${encodeURIComponent(playerId)}?secret=${encodeURIComponent(secret)}`,
        { headers: { Upgrade: "websocket" } },
      );
      if (res.status !== 101 || !res.webSocket) {
        await res.body?.cancel();
        return res.status;
      }
      const ws = res.webSocket;
      const log = new MessageLog();
      ws.addEventListener("message", (e) => log.push(JSON.parse(e.data as string)));
      ws.addEventListener("close", () => (log.closed = true));
      ws.accept();
      const client: TestClient = {
        get messages() {
          return log.messages;
        },
        get closed() {
          return log.closed;
        },
        send: (m) => ws.send(JSON.stringify(m)),
        waitFor: (type, pred) => log.waitFor(type, pred as any),
        clear: () => log.clear(),
        close: () => ws.close(1000, "bye"),
      };
      return client;
    },
    async advance(ms) {
      const target = testClock.now() + ms;
      for (let i = 0; i < 1000; i++) {
        await settle();
        let next: { id: string; at: number } | null = null;
        for (const id of rooms) {
          const at = await runInDurableObject(roomStub(id), (_obj, state) => state.storage.getAlarm());
          if (at !== null && (!next || at < next.at)) next = { id, at };
        }
        if (!next || next.at > target) break;
        testClock.offset += Math.max(0, next.at - testClock.now());
        await runDurableObjectAlarm(roomStub(next.id));
      }
      testClock.offset += Math.max(0, target - testClock.now());
      await settle();
    },
  };
}

defineContractTests("durable objects", createWorkersHarness);
