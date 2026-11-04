import type { PlayerId } from "@edv4h/croupier-core";
import type { BaseCard } from "@edv4h/croupier-plugin-values-card";

/**
 * Message shapes of the Wevox Values Card WebSocket protocol (`values-card.v1`),
 * limited to the game part. They mirror `packages/core-values-card/src/shared/realtime`
 * in wevox-mono-web; keep both in step when the protocol changes.
 *
 * Every message is `{ type, payload }`. Card ids on the wire are the numeric catalog ids.
 */
export type WireCardId = number;

/** `snapshot.payload.game`: sent while playing. Only the viewer's own hand is revealed. */
export interface WireGameSnapshot {
  deck_remaining: number;
  turn_player_id: PlayerId;
  your_hand: WireCardId[];
  hand_counts: Record<PlayerId, number>;
  discards: { card_id: WireCardId; player_id: PlayerId }[];
}

/** One player's final hand in `snapshot.payload.result.players` */
export interface WireResultPlayer {
  player_id: PlayerId;
  cards: WireCardId[];
}

export type WireDrawSource = "deck" | "discard";

/** Sent to everyone. `card_id` only when drawn from the discard pile (the card leaves the table). */
export interface WireCardDrawnEvent {
  type: "card_drawn";
  payload: {
    player_id: PlayerId;
    from: WireDrawSource;
    card_id?: WireCardId;
    deck_remaining: number;
  };
}

/** Sent only to the player whose hand changed. Always the whole hand. */
export interface WireHandUpdatedEvent {
  type: "hand_updated";
  payload: { cards: WireCardId[] };
}

export interface WireCardDiscardedEvent {
  type: "card_discarded";
  payload: { player_id: PlayerId; card_id: WireCardId };
}

export interface WireTurnChangedEvent {
  type: "turn_changed";
  payload: { player_id: PlayerId };
}

/** The game part only ever moves the room to `finishing` (saving the result). */
export interface WireRoomStatusChangedEvent {
  type: "room_status_changed";
  payload: { status: "finishing" };
}

/** Game events, in the order the WS server sends them */
export type WireGameEvent =
  | WireCardDrawnEvent
  | WireHandUpdatedEvent
  | WireCardDiscardedEvent
  | WireTurnChangedEvent
  | WireRoomStatusChangedEvent;

export interface WireDrawCardCommand {
  type: "draw_card";
  payload: { from: WireDrawSource; card_id?: WireCardId };
}

export interface WireDiscardCardCommand {
  type: "discard_card";
  payload: { card_id: WireCardId };
}

/** Game commands from a client. The sender is known from the connection, never from the payload. */
export type WireGameCommand = WireDrawCardCommand | WireDiscardCardCommand;

export interface WireOptions<C extends BaseCard> {
  /**
   * Catalog id of a card on the wire. Defaults to the card's own id when it is
   * already an integer; required when cards use other ids (e.g. value names).
   */
  toWireCardId?: (card: C) => WireCardId;
}
