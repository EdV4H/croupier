import type { HTMLProps, PolymorphicProps } from "@ark-ui/react";
import { ark } from "@ark-ui/react";
import { mergeProps } from "@zag-js/react";
import { forwardRef } from "react";
import { partProps } from "./part-props";
import { parts } from "./state-machine/trading-card.anatomy";

export interface TradingCardRevealStageBaseProps extends PolymorphicProps {}
export interface TradingCardRevealStageProps
  extends HTMLProps<"div">,
    TradingCardRevealStageBaseProps {}

/**
 * Where the entrance burst goes off — the flash, the rings, the particles.
 *
 * An explicit part rather than something `Root` conjures up, so a card with no
 * entrance renders no extra nodes at all. Render it inside `Root` alongside the
 * faces; it sits behind them and spills past the card's edges on purpose, since
 * a burst confined to the card would not read as one.
 *
 * The contents are created and destroyed imperatively while the entrance plays,
 * so this element is empty at rest.
 */
export const TradingCardRevealStage = forwardRef<
  HTMLDivElement,
  TradingCardRevealStageProps
>((props, ref) => {
  const mergedProps = mergeProps(
    partProps<"div">(parts.revealStage.attrs, { "aria-hidden": true }),
    props,
  );
  return <ark.div {...mergedProps} ref={ref} />;
});

TradingCardRevealStage.displayName = "TradingCardRevealStage";
