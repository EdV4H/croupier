import type { HTMLProps, PolymorphicProps } from "@ark-ui/react";
import { ark } from "@ark-ui/react";
import { mergeProps } from "@zag-js/react";
import { forwardRef } from "react";
import { partProps } from "./part-props";
import { parts } from "./state-machine/trading-card.anatomy";

export interface TradingCardContentBaseProps extends PolymorphicProps {}
export interface TradingCardContentProps
  extends HTMLProps<"div">,
    TradingCardContentBaseProps {}

/**
 * Content well for text and controls. Sits below the `Layer` stack but carries
 * an opaque background and its own stacking isolation, so the optical layers
 * wash over the artwork rather than over the copy — text contrast has to
 * survive whatever the layers do (WCAG 1.4.3).
 *
 * Put anything that *should* shimmer in `Media` instead.
 */
export const TradingCardContent = forwardRef<
  HTMLDivElement,
  TradingCardContentProps
>((props, ref) => {
  const mergedProps = mergeProps(partProps<"div">(parts.content.attrs), props);
  return <ark.div {...mergedProps} ref={ref} />;
});

TradingCardContent.displayName = "TradingCardContent";
