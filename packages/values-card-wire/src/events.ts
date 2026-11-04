import type { ActionLogEntry, CroupierSnapshot, PlayerId } from "@edv4h/croupier-core";
import type { BaseCard, CardId, ValuesCardState } from "@edv4h/croupier-plugin-values-card";
import { wireCardIdOf } from "./card-id.js";
import type { WireGameEvent, WireOptions } from "./types.js";

export type WireEventsResult =
  | { kind: "events"; events: WireGameEvent[] }
  /**
   * The step from `prev` to `next` can't be told as events (log truncated, game
   * reset or replaced, unknown action). Send the viewer a full `snapshot` instead.
   */
  | { kind: "resync"; reason: string };

/**
 * The events one viewer should receive for the step from `prev` to `next`, in the
 * order the WS server sends them:
 *
 * - draw: `card_drawn` (everyone; `card_id` only from the discard pile) → `hand_updated` (drawer)
 * - discard: `card_discarded` (everyone) → `hand_updated` (discarder) →
 *   `turn_changed`, or `room_status_changed: finishing` when the game ended
 *
 * The new action-log entries are replayed from `prev.game` (bots and turn-timeout
 * takeovers are logged like any action). The replay must land exactly on
 * `next.game`; otherwise the result is `resync`.
 */
export function toWireEvents<C extends BaseCard>(
  prev: CroupierSnapshot<ValuesCardState<C>> | null,
  next: CroupierSnapshot<ValuesCardState<C>>,
  viewer: PlayerId,
  options: WireOptions<C> = {},
): WireEventsResult {
  if (!prev) return { kind: "resync", reason: "no previous state" };
  if (prev.gameName !== next.gameName) return { kind: "resync", reason: "different game" };
  // One revision per dispatched action (`actionCount` restarts with every phase, i.e. every
  // turn). Other mutations (join, endSession) also bump it; their replay then fails to
  // match and the result is a resync.
  const count = next.revision - prev.revision;
  if (count < 0) return { kind: "resync", reason: "game was reset" };
  if (count > next.log.length) return { kind: "resync", reason: "log truncated" };

  const wireId = wireCardIdOf(options);
  const game = structuredClone(prev.game);
  const entries = next.log.slice(next.log.length - count);
  const events: WireGameEvent[] = [];
  const handOf = (pid: PlayerId) => game.players[pid]?.hand;
  const sendHand = (pid: PlayerId) => {
    if (pid === viewer) {
      events.push({ type: "hand_updated", payload: { cards: handOf(pid).map(wireId) } });
    }
  };

  for (const [i, entry] of entries.entries()) {
    const hand = handOf(entry.playerId);
    if (!hand) return { kind: "resync", reason: `unknown player ${entry.playerId}` };
    const cardId = cardIdOf(entry);

    switch (entry.action) {
      case "drawFromDeck": {
        const card = game.deck.shift();
        if (!card) return { kind: "resync", reason: "deck already empty" };
        hand.push(card);
        events.push({
          type: "card_drawn",
          payload: { player_id: entry.playerId, from: "deck", deck_remaining: game.deck.length },
        });
        sendHand(entry.playerId);
        break;
      }
      case "drawFromDiscard": {
        const idx = game.discardPool.findIndex((e) => e.card.id === cardId);
        if (idx === -1) return { kind: "resync", reason: "card not in discard pool" };
        const [{ card }] = game.discardPool.splice(idx, 1);
        hand.push(card);
        events.push({
          type: "card_drawn",
          payload: {
            player_id: entry.playerId,
            from: "discard",
            card_id: wireId(card),
            deck_remaining: game.deck.length,
          },
        });
        sendHand(entry.playerId);
        break;
      }
      case "discardCard": {
        const idx = hand.findIndex((c) => c.id === cardId);
        if (idx === -1) return { kind: "resync", reason: "card not in hand" };
        const [card] = hand.splice(idx, 1);
        game.discardPool.push({ card, discardedBy: entry.playerId });
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
        events.push({
          type: "card_discarded",
          payload: { player_id: entry.playerId, card_id: wireId(card) },
        });
        sendHand(entry.playerId);
        // Only the last discard of the step can have ended the game.
        const isLast = i === entries.length - 1;
        if (isLast && next.game.endReason !== null) {
          events.push({ type: "room_status_changed", payload: { status: "finishing" } });
        } else {
          events.push({
            type: "turn_changed",
            payload: { player_id: game.playerOrder[game.currentPlayerIndex] },
          });
        }
        break;
      }
      default:
        return { kind: "resync", reason: `unknown action ${entry.action}` };
    }
  }

  if (!sameTable(game, next.game)) return { kind: "resync", reason: "replay did not match" };
  return { kind: "events", events };
}

function cardIdOf(entry: ActionLogEntry): CardId | undefined {
  return (entry.payload as { cardId?: CardId } | null | undefined)?.cardId;
}

const ids = <C extends BaseCard>(cards: C[]) => cards.map((c) => c.id);
const sameIds = (a: CardId[], b: CardId[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** Hands, deck, discard pool and turn match (what the events describe). */
function sameTable<C extends BaseCard>(a: ValuesCardState<C>, b: ValuesCardState<C>): boolean {
  if (a.currentPlayerIndex !== b.currentPlayerIndex) return false;
  if (!sameIds(ids(a.deck), ids(b.deck))) return false;
  if (!sameIds(a.discardPool.map((e) => e.card.id), b.discardPool.map((e) => e.card.id))) {
    return false;
  }
  if (!sameIds(a.playerOrder, b.playerOrder)) return false;
  return a.playerOrder.every((pid) => sameIds(ids(a.players[pid].hand), ids(b.players[pid].hand)));
}
