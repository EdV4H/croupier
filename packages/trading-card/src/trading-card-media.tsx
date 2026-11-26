import type { HTMLProps, PolymorphicProps } from "@ark-ui/react";
import { ark } from "@ark-ui/react";
import { mergeProps } from "@zag-js/react";
import { forwardRef } from "react";
import { partProps } from "./part-props";
import { parts } from "./state-machine/trading-card.anatomy";

export interface TradingCardMediaBaseProps extends PolymorphicProps {
  /**
   * Aspect ratio reserved for the artwork, as a CSS `aspect-ratio` value.
   * Reserving the box is what stops the card reflowing while the image loads.
   * @default "3 / 4"
   */
  ratio?: string;
}

export interface TradingCardMediaProps
  extends HTMLProps<"div">,
    TradingCardMediaBaseProps {}

/**
 * Artwork frame with its aspect ratio reserved up front, so the card does not
 * reflow when the image finishes loading.
 *
 * Unlike `Content` this sits *under* the optical layers, so artwork placed here
 * picks up the gloss, holo and glare.
 */
export const TradingCardMedia = forwardRef<
  HTMLDivElement,
  TradingCardMediaProps
>(({ ratio = "3 / 4", style, ...props }, ref) => {
  const mergedProps = mergeProps(
    partProps<"div">(parts.media.attrs, {
      style: { aspectRatio: ratio, ...style },
    }),
    props,
  );

  return <ark.div {...mergedProps} ref={ref} />;
});

TradingCardMedia.displayName = "TradingCardMedia";
