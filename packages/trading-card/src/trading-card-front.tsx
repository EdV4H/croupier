import type { HTMLProps, PolymorphicProps } from "@ark-ui/react";
import { ark } from "@ark-ui/react";
import { mergeProps } from "@zag-js/react";
import { forwardRef } from "react";
import { partProps } from "./part-props";
import { parts } from "./state-machine/trading-card.anatomy";
import { useTradingCardContext } from "./use-trading-card-context";

export interface TradingCardFrontBaseProps extends PolymorphicProps {}
export interface TradingCardFrontProps
  extends HTMLProps<"div">,
    TradingCardFrontBaseProps {}

/**
 * The front face. Holds the consumer's content plus any `Layer`s.
 *
 * Blending is confined to this element (`isolation: isolate` in the recipe) so
 * a `mix-blend-mode` layer cannot bleed onto the page behind the card.
 */
export const TradingCardFront = forwardRef<
  HTMLDivElement,
  TradingCardFrontProps
>((props, ref) => {
  const api = useTradingCardContext();
  const hidden = api.flipped;

  // `aria-hidden` alone leaves focusable children in the tab order —
  // `backface-visibility` is a purely visual hide. `inert` is what removes
  // them from it.
  const faceAttrs = hidden ? { "aria-hidden": true, inert: true } : {};

  const mergedProps = mergeProps(
    partProps<"div">(parts.front.attrs, { "data-side": "front" }, faceAttrs),
    props,
  );

  return <ark.div {...mergedProps} ref={ref} />;
});

TradingCardFront.displayName = "TradingCardFront";
