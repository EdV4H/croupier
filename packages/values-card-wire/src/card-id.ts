import type { BaseCard } from "@edv4h/croupier-plugin-values-card";
import type { WireCardId, WireOptions } from "./types.js";

/** Resolve the wire id function: the option, or the card's own id when it is an integer. */
export function wireCardIdOf<C extends BaseCard>(
  options: WireOptions<C> = {},
): (card: C) => WireCardId {
  if (options.toWireCardId) return options.toWireCardId;
  return (card) => {
    if (typeof card.id === "number" && Number.isInteger(card.id)) return card.id;
    throw new Error(
      `Card id ${JSON.stringify(card.id)} is not a catalog id; pass toWireCardId to map it`,
    );
  };
}
