import type { HTMLProps, PolymorphicProps } from "@ark-ui/react";
import { ark } from "@ark-ui/react";
import { mergeProps } from "@zag-js/react";
import { forwardRef } from "react";
import { partProps } from "./part-props";
import { parts } from "./state-machine/trading-card.anatomy";

export interface TradingCardLayerBaseProps extends PolymorphicProps {}
export interface TradingCardLayerProps
  extends HTMLProps<"div">,
    TradingCardLayerBaseProps {}

/**
 * A single optical layer — and nothing more. The library ships only the
 * skeleton (`position: absolute; inset: 0; pointer-events: none`); the
 * gradient, blend mode, filter, animation, stacking order and opacity are all
 * yours, applied with `css()` or `className`.
 *
 * The component knows neither how many layers there are nor what any of them
 * mean, so it takes no props. Layers paint in DOM order, and each one reads
 * whatever custom properties your CSS names — see the gloss / holo / foil /
 * sparkle / edge / glare recipes in the docs for the canonical set.
 *
 * Keep every layer mounted and drive its `opacity` from a variable rather than
 * mounting and unmounting layers: switching treatments then rewrites variables
 * only and never disturbs the DOM.
 *
 * @example
 * const GLOSS = css({
 *   zIndex: 3,
 *   opacity: "var(--tc-l-gloss, 0)",
 *   backgroundImage: "linear-gradient(105deg, transparent 34%, …)",
 *   backgroundPosition: "calc(var(--tc-px, 50) * 1%) calc(var(--tc-py, 50) * 1%)",
 *   mixBlendMode: "screen",
 * });
 *
 * <TradingCard.Layer className={GLOSS} />
 */
export const TradingCardLayer = forwardRef<
  HTMLDivElement,
  TradingCardLayerProps
>((props, ref) => {
  const mergedProps = mergeProps(partProps<"div">(parts.layer.attrs), props);
  return <ark.div {...mergedProps} ref={ref} />;
});

TradingCardLayer.displayName = "TradingCardLayer";
