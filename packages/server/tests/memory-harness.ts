import {
  ConnectionRegistry,
  MemoryLobby,
  MemoryRoomStore,
  RoomHost,
  createApp,
  type Connection,
  type RoomGateway,
  type Scheduler,
} from "../src/index.js";
import type { Harness, TestClient } from "./harness.js";
import { MessageLog } from "./harness.js";
import { registry } from "./fixtures.js";

/** Records wakeups instead of setting real timers; advance() fires them in time order */
class ManualScheduler implements Scheduler {
  pending = new Map<string, number>();
  schedule(roomId: string, at: number | null): void {
    if (at === null) this.pending.delete(roomId);
    else this.pending.set(roomId, at);
  }
}

export async function createMemoryHarness(): Promise<Harness & { host: RoomHost }> {
  let now = 1_700_000_000_000;
  const clock = { now: () => now };
  const scheduler = new ManualScheduler();
  const transport = new ConnectionRegistry();
  const host = new RoomHost({
    registry,
    store: new MemoryRoomStore(),
    scheduler,
    transport,
    lobby: new MemoryLobby(),
    clock,
  });

  const gateway: RoomGateway = {
    createRoom: (b) => host.createRoom(b),
    joinRoom: (id, b) => host.joinRoom(id, b),
    leaveRoom: (id, b) => host.leaveRoom(id, b),
    startGame: (id, b) => host.startGame(id, b),
    deleteRoom: (id, b) => host.deleteRoom(id, b),
    getRoom: (id) => host.getRoom(id),
    listRooms: () => host.listRooms(),
    connect: async (c) => c.body(null, 500),
  };
  const app = createApp(gateway, registry);
  const settle = () => new Promise<void>((r) => setTimeout(r, 0));

  return {
    host,
    settle,
    async http(method, path, body) {
      const res = await app.request(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    },
    async connect(roomId, playerId, secret) {
      const status = await host.authorize(roomId, playerId, secret);
      if (status !== 200) return status;
      const log = new MessageLog();
      const conn: Connection = {
        playerId,
        send: (m) => {
          if (!log.closed) log.push(JSON.parse(JSON.stringify(m)));
        },
        close: () => {
          log.closed = true;
          transport.remove(roomId, conn);
        },
      };
      transport.add(roomId, conn);
      await host.onConnect(roomId, conn);
      const client: TestClient = {
        get messages() {
          return log.messages;
        },
        get closed() {
          return log.closed;
        },
        send: (m) => void host.onMessage(roomId, conn, JSON.stringify(m)),
        waitFor: (type, pred) => log.waitFor(type, pred as any),
        clear: () => log.clear(),
        close: () => conn.close(1000, ""),
      };
      return client;
    },
    async advance(ms) {
      const target = now + ms;
      for (let i = 0; i < 10_000; i++) {
        await settle();
        const due = [...scheduler.pending.entries()].sort((x, y) => x[1] - y[1])[0];
        if (!due || due[1] > target) break;
        now = Math.max(now, due[1]);
        scheduler.pending.delete(due[0]);
        await host.wake(due[0]);
      }
      now = target;
      await settle();
    },
  };
}
