import type { CroupierEvents, GameState } from "./types.js";

type EventName = keyof CroupierEvents;
type EventPayload<K extends EventName> = CroupierEvents<GameState>[K];
type Listener<K extends EventName> = (payload: EventPayload<K>) => void;

/**
 * Typed event emitter for CroupierCore.
 */
export class EventEmitter {
  private listeners = new Map<EventName, Set<Listener<any>>>();

  on<K extends EventName>(event: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  off<K extends EventName>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends EventName>(event: K, payload: EventPayload<K>): void {
    this.listeners.get(event)?.forEach((listener) => {
      listener(payload);
    });
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
