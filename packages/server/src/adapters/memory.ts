/**
 * In-process adapters. State is kept as JSON strings, so a room goes through
 * the same serialize → restore path as on Durable Objects for every input.
 */
import type { RoomSummary } from "../protocol.js";
import type { Clock, Connection, Lobby, RoomStore, Scheduler, Transport } from "../host/room-host.js";
import type { RoomState } from "../room/types.js";

const ROOM_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Returns a function that picks a 4-character room id not rejected by `taken` */
export function createRoomIdGenerator(random: () => number = Math.random) {
  return (taken: (id: string) => boolean): string => {
    for (let attempt = 0; attempt < 100; attempt++) {
      let id = "";
      for (let i = 0; i < 4; i++) id += ROOM_ID_CHARS[Math.floor(random() * ROOM_ID_CHARS.length)];
      if (!taken(id)) return id;
    }
    throw new Error("Failed to generate a unique room id");
  };
}

export class MemoryRoomStore implements RoomStore {
  private rooms = new Map<string, string>();

  async load(roomId: string): Promise<RoomState | null> {
    const json = this.rooms.get(roomId);
    return json ? (JSON.parse(json) as RoomState) : null;
  }

  async save(roomId: string, state: RoomState): Promise<void> {
    this.rooms.set(roomId, JSON.stringify(state));
  }

  async remove(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
  }
}

export class MemoryLobby implements Lobby {
  private rooms = new Map<string, RoomSummary | null>();
  private nextId = createRoomIdGenerator();

  async allocateId(): Promise<string> {
    const id = this.nextId((id) => this.rooms.has(id));
    this.rooms.set(id, null);
    return id;
  }

  async upsert(summary: RoomSummary): Promise<void> {
    this.rooms.set(summary.id, summary);
  }

  async remove(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
  }

  async list(): Promise<RoomSummary[]> {
    return [...this.rooms.values()].filter((r): r is RoomSummary => r !== null);
  }
}

/** One setTimeout per room */
export class TimerScheduler implements Scheduler {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private wake: (roomId: string) => void,
    private clock: Clock = { now: () => Date.now() },
  ) {}

  schedule(roomId: string, at: number | null): void {
    const prev = this.timers.get(roomId);
    if (prev) clearTimeout(prev);
    this.timers.delete(roomId);
    if (at === null) return;
    const timer = setTimeout(() => {
      this.timers.delete(roomId);
      this.wake(roomId);
    }, Math.max(0, at - this.clock.now()));
    this.timers.set(roomId, timer);
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}

export class ConnectionRegistry implements Transport {
  private rooms = new Map<string, Set<Connection>>();

  add(roomId: string, conn: Connection): void {
    let set = this.rooms.get(roomId);
    if (!set) this.rooms.set(roomId, (set = new Set()));
    set.add(conn);
  }

  remove(roomId: string, conn: Connection): void {
    const set = this.rooms.get(roomId);
    set?.delete(conn);
    if (set?.size === 0) this.rooms.delete(roomId);
  }

  connections(roomId: string): Connection[] {
    return [...(this.rooms.get(roomId) ?? [])];
  }
}
