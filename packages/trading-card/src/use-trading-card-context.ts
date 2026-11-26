import { createContext } from "./internal";
import type { TradingCardApi } from "./state-machine/trading-card.types";

export interface UseTradingCardContext extends TradingCardApi {
  /**
   * Play the entrance animation now.
   *
   * This is the only way in for a card configured with `reveal.auto: false`,
   * which is the default — a card that animates itself on every mount is a poor
   * citizen inside a list or a route transition, so the entrance waits to be
   * asked for. Call it from a replay control, or from whatever moment in the
   * host app the arrival actually belongs to.
   *
   * Ignored while an entrance is already running, and a no-op under reduced
   * motion (where `onRevealComplete` fires immediately instead) or on a card
   * rendered without a `reveal` prop.
   */
  playReveal(): void;
}

export const [TradingCardProvider, useTradingCardContext] =
  createContext<UseTradingCardContext>({
    name: "TradingCardContext",
    hookName: "useTradingCardContext",
    providerName: "<TradingCardProvider />",
    strict: true,
  });
