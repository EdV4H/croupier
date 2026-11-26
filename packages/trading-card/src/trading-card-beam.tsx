import type { HTMLProps, PolymorphicProps } from "@ark-ui/react";
import { ark } from "@ark-ui/react";
import { mergeProps } from "@zag-js/react";
import { forwardRef } from "react";
import { partProps } from "./part-props";
import { parts } from "./state-machine/trading-card.anatomy";

export interface TradingCardBeamBaseProps extends PolymorphicProps {}
export interface TradingCardBeamProps
  extends HTMLProps<"div">,
    TradingCardBeamBaseProps {}

/**
 * The sweep of light that crosses the card during a `scan` entrance.
 *
 * Like `Layer`, this ships as a skeleton: absolute, invisible at rest, and
 * nothing else. The gradient is yours — the docs carry the one the spec
 * describes. Place it inside a face, above the layers.
 *
 * It only moves while a `scan` entrance is running; the rest of the time it
 * sits at `opacity: 0` and costs nothing.
 */
export const TradingCardBeam = forwardRef<HTMLDivElement, TradingCardBeamProps>(
  (props, ref) => {
    const mergedProps = mergeProps(partProps<"div">(parts.beam.attrs), props);
    return <ark.div {...mergedProps} ref={ref} />;
  },
);

TradingCardBeam.displayName = "TradingCardBeam";
