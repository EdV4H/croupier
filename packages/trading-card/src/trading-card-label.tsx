import type { HTMLProps, PolymorphicProps } from "@ark-ui/react";
import { ark } from "@ark-ui/react";
import { mergeProps } from "@zag-js/react";
import { forwardRef } from "react";
import { partProps } from "./part-props";
import { parts } from "./state-machine/trading-card.anatomy";

export interface TradingCardLabelBaseProps extends PolymorphicProps {}
export interface TradingCardLabelProps
  extends HTMLProps<"span">,
    TradingCardLabelBaseProps {}

/**
 * Visible text label for whatever the card's layer treatment signifies —
 * a tier, a rank, a status.
 *
 * This is deliberately visible text rather than an `aria-label`: a difference
 * carried only by color or shimmer is not perceivable by every user, so
 * whatever the layers encode must also be readable as words.
 */
export const TradingCardLabel = forwardRef<
  HTMLSpanElement,
  TradingCardLabelProps
>((props, ref) => {
  const mergedProps = mergeProps(partProps<"span">(parts.label.attrs), props);
  return <ark.span {...mergedProps} ref={ref} />;
});

TradingCardLabel.displayName = "TradingCardLabel";
