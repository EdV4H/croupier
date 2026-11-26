import type { HTMLProps, PolymorphicProps } from "@ark-ui/react";
import { ark } from "@ark-ui/react";
import { mergeProps } from "@zag-js/react";
import { forwardRef } from "react";
import { parts } from "./state-machine/trading-card.anatomy";
import { useTradingCardContext } from "./use-trading-card-context";

export interface TradingCardFlipTriggerBaseProps extends PolymorphicProps {}
export interface TradingCardFlipTriggerProps
  extends HTMLProps<"button">,
    TradingCardFlipTriggerBaseProps {}

/**
 * Turns the card over. A real `<button>`, so Enter and Space work natively —
 * do not hand-roll key handling here.
 *
 * This is the keyboard and assistive-technology path to the reverse face.
 * Clicking the card body does the same thing for pointer users, but this
 * trigger is what makes the behaviour reachable without one, so render it
 * whenever the card is flippable.
 *
 * The accessible name comes from `children`. For an icon-only trigger, pass
 * `aria-label` — and keep the wording a prop rather than a constant so it can
 * be translated.
 */
export const TradingCardFlipTrigger = forwardRef<
  HTMLButtonElement,
  TradingCardFlipTriggerProps
>((props, ref) => {
  const api = useTradingCardContext();

  const mergedProps = mergeProps(
    {
      ...parts.flipTrigger.attrs,
      type: "button" as const,
      "aria-pressed": api.flipped,
      disabled: !api.flippable,
      onClick: () => api.toggleFlip(),
    },
    props,
  );

  return <ark.button {...mergedProps} ref={ref} />;
});

TradingCardFlipTrigger.displayName = "TradingCardFlipTrigger";
