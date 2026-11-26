import type { HTMLProps, PolymorphicProps } from "@ark-ui/react";
import { ark } from "@ark-ui/react";
import { mergeProps } from "@zag-js/react";
import { forwardRef } from "react";
import { partProps } from "./part-props";
import { parts } from "./state-machine/trading-card.anatomy";
import { useTradingCardContext } from "./use-trading-card-context";

export interface TradingCardBackBaseProps extends PolymorphicProps {}
export interface TradingCardBackProps
  extends HTMLProps<"div">,
    TradingCardBackBaseProps {}

/**
 * The reverse face. Pre-rotated 180° so the flip lands on it; hidden from
 * assistive technology and the tab order whenever the front is showing.
 */
export const TradingCardBack = forwardRef<HTMLDivElement, TradingCardBackProps>(
  (props, ref) => {
    const api = useTradingCardContext();
    const hidden = !api.flipped;

    const faceAttrs = hidden ? { "aria-hidden": true, inert: true } : {};

    const mergedProps = mergeProps(
      partProps<"div">(parts.back.attrs, { "data-side": "back" }, faceAttrs),
      props,
    );

    return <ark.div {...mergedProps} ref={ref} />;
  },
);

TradingCardBack.displayName = "TradingCardBack";
