import type { PlayerId } from "@edv4h/croupier-core";
import type { BaseCard, ValuesCardState } from "@edv4h/croupier-plugin-values-card";
import { wireCardIdOf } from "./card-id.js";
import type { WireGameSnapshot, WireOptions, WireResultPlayer } from "./types.js";

/**
 * `snapshot.payload.game` for one viewer. Other players' hands are counts only;
 * a spectator (not in the game) gets an empty `your_hand`.
 */
export function toWireGameSnapshot<C extends BaseCard>(
  game: ValuesCardState<C>,
  viewer: PlayerId,
  options: WireOptions<C> = {},
): WireGameSnapshot {
  const wireId = wireCardIdOf(options);
  return {
    deck_remaining: game.deck.length,
    turn_player_id: game.playerOrder[game.currentPlayerIndex],
    your_hand: game.players[viewer]?.hand.map(wireId) ?? [],
    hand_counts: Object.fromEntries(
      game.playerOrder.map((pid) => [pid, game.players[pid].hand.length]),
    ),
    discards: game.discardPool.map((entry) => ({
      card_id: wireId(entry.card),
      player_id: entry.discardedBy,
    })),
  };
}

/** `snapshot.payload.result.players`: every player's final hand, in turn order */
export function toWireResultPlayers<C extends BaseCard>(
  game: ValuesCardState<C>,
  options: WireOptions<C> = {},
): WireResultPlayer[] {
  const wireId = wireCardIdOf(options);
  return game.playerOrder.map((pid) => ({
    player_id: pid,
    cards: game.players[pid].hand.map(wireId),
  }));
}
