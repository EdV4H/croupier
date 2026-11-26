/**
 * Public configuration schemas for `TradingCard`.
 *
 * Boundary rule: **only values the input layer (JS) reads get a field here.**
 * Everything the presentation layer (CSS) reads goes through {@link
 * TradingCardFinish.vars}. This mirrors the spec's three-layer separation —
 * JS writes pointer-derived CSS variables, the layers are static CSS that only
 * reads variables, and the library never learns what a layer *is*.
 */

/**
 * The card's surface finish and motion tuning — "finish" in the print sense:
 * gloss, foil, the way light behaves on the stock.
 *
 * Only values that do not change at runtime belong here; interactive state
 * (`flipped`) stays a flat prop on `Root`.
 *
 * Named `finish` rather than `appearance` because `appearance` is a real CSS
 * property, and Panda's styled JSX would shadow the prop with it.
 */
export interface TradingCardFinish {
  /**
   * Pointer-follow tilt.
   * @default { max: 14, hoverScale: 1.04 }
   */
  tilt?: {
    /** Maximum tilt angle in degrees. `0` disables tilt entirely. */
    max?: number;
    /** Scale applied while the pointer is over the card. */
    hoverScale?: number;
  };
  /**
   * Drop shadow that trails the tilt.
   * @default { follow: true }
   */
  shadow?: {
    /** When `false` the shadow stays put instead of following the tilt. */
    follow?: boolean;
  };
  /**
   * Motion tuning.
   * @default { speed: 1 }
   */
  motion?: {
    /**
     * **Duration** multiplier for every transition and reveal — not a rate.
     * `0.5` halves the durations (feels faster), `2` doubles them (feels
     * slower). Range 0.3–2.
     */
    speed?: number;
  };
  /**
   * Arbitrary CSS custom properties written onto the root element, for the
   * consumer's own layer CSS to read: layer coefficients, iridescent
   * gradients, accent colors — anything the presentation layer needs.
   *
   * The library passes these through untouched and never interprets them.
   * Keys may omit the leading `--`; it is added when missing.
   *
   * @example
   * { "--tc-l-holo": "0.7", "--tc-accent": "oklch(0.82 0.15 85)" }
   */
  vars?: Record<string, string>;
}

/**
 * Entrance animation. Omit the prop entirely to ship a card with no reveal.
 *
 * @experimental The reveal API is the least settled part of `TradingCard` and
 * may change while the component lives under `/experimentals`.
 */
export interface TradingCardReveal {
  /**
   * Which choreography to play.
   *
   * The entrance lands on the face the card is showing. A face-up `drop` falls
   * in face-down and turns over; a card rendered `flipped` falls in and stays
   * face-down, and no mode ever shows it its front on the way in.
   */
  mode: "drop" | "burst" | "scan";
  /**
   * Strength of the burst — scales particle count, glow and ring radius.
   * Range 0–1.
   * @default 0.7
   */
  intensity?: number;
  /**
   * Beat between the card scrolling into view and the entrance starting, in ms.
   * Ignored when the card is already on screen as it mounts — a card in a
   * dialog that just opened starts at once, since waiting would show it fully
   * drawn and then snap it away to begin.
   * @default 420
   */
  delayMs?: number;
  /**
   * Play once shortly after the card first scrolls into view.
   *
   * Defaults to `false`: a component that animates itself on every mount is a
   * poor citizen inside a list, a modal, or a route transition.
   * @default false
   */
  auto?: boolean;
}
