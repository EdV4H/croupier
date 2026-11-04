import type { PlayerId } from "@edv4h/croupier-core";
import type { BaseCard, CardId, ValuesCardState } from "@edv4h/croupier-plugin-values-card";
import { wireCardIdOf } from "./card-id.js";
import type { WireGameCommand, WireOptions } from "./types.js";

/** A croupier Values Card action, ready for `CroupierCore.dispatch(player, action, payload)` */
export type ValuesCardAction =
  | { action: "drawFromDeck"; payload?: undefined }
  | { action: "drawFromDiscard"; payload: { cardId: CardId } }
  | { action: "discardCard"; payload: { cardId: CardId } };

/**
 * The croupier action for a client command sent by `player`, or null when the card
 * it names isn't where the command says (not in the discard pool / not in the hand).
 * Turn order and the other rules are left to the engine's validation.
 */
export function toValuesCardAction<C extends BaseCard>(
  command: WireGameCommand,
  game: ValuesCardState<C>,
  player: PlayerId,
  options: WireOptions<C> = {},
): ValuesCardAction | null {
  const wireId = wireCardIdOf(options);
  switch (command.type) {
    case "draw_card": {
      if (command.payload.from === "deck") return { action: "drawFromDeck" };
      const entry = game.discardPool.find((e) => wireId(e.card) === command.payload.card_id);
      return entry ? { action: "drawFromDiscard", payload: { cardId: entry.card.id } } : null;
    }
    case "discard_card": {
      const card = game.players[player]?.hand.find((c) => wireId(c) === command.payload.card_id);
      return card ? { action: "discardCard", payload: { cardId: card.id } } : null;
    }
    default:
      return null;
  }
}
