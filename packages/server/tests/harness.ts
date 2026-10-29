import type { ServerMessage } from "../src/protocol.js";

export interface TestClient {
  readonly messages: ServerMessage[];
  readonly closed: boolean;
  send(message: unknown): void;
  /** Resolves with the first message (received so far or later) of `type` matching `pred`, after index `from` */
  waitFor<T extends ServerMessage["type"]>(
    type: T,
    pred?: (m: Extract<ServerMessage, { type: T }>) => boolean,
  ): Promise<Extract<ServerMessage, { type: T }>>;
  /** Forget messages received so far */
  clear(): void;
  close(): void;
}

/** A server running on one runtime, driven by the shared contract tests */
export interface Harness {
  http(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }>;
  /** Open a socket; returns the HTTP status when the upgrade is refused */
  connect(roomId: string, playerId: string, secret: string): Promise<TestClient | number>;
  /** Move the clock forward and run every wakeup that becomes due */
  advance(ms: number): Promise<void>;
  /** Let pending async work settle */
  settle(): Promise<void>;
}

type Waiter = { type: string; pred?: (m: any) => boolean; resolve: (m: any) => void };

/** Collects messages and resolves waiters; shared by the harness implementations */
export class MessageLog {
  messages: ServerMessage[] = [];
  closed = false;
  private cursor = 0;
  private waiters: Waiter[] = [];

  push(message: ServerMessage): void {
    this.messages.push(message);
    this.waiters = this.waiters.filter((w) => {
      if (message.type === w.type && (!w.pred || w.pred(message))) {
        w.resolve(message);
        return false;
      }
      return true;
    });
  }

  clear(): void {
    this.cursor = this.messages.length;
  }

  waitFor(type: string, pred?: (m: any) => boolean, timeoutMs = 2000): Promise<any> {
    const found = this.messages.slice(this.cursor).find((m) => m.type === type && (!pred || pred(m)));
    if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new Error(`Timed out waiting for ${type}; got ${JSON.stringify(this.messages.slice(this.cursor).map((m) => m.type))}`));
      }, timeoutMs);
      const waiter: Waiter = {
        type,
        pred,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
      };
      this.waiters.push(waiter);
    });
  }
}
