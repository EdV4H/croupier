import type { TradingCardReveal } from "../schemas/trading-card";

/**
 * Entrance choreography, as plain data. No DOM, no React — the caller feeds
 * the result straight to `Element.animate`.
 *
 * Two rules hold across every mode:
 *
 * **`fill: "none"`.** The card's resting transform is built from CSS variables
 * that the pointer handlers keep writing; if the animation held its final frame
 * it would pin the card and hover would stop working from then on. Letting it
 * release hands control straight back.
 *
 * **No `opacity` in the transform keyframes.** An opacity below 1 forces the
 * element to be rendered as a group, which flattens `transform-style:
 * preserve-3d`. On a card mid-flip that means the front stops being hidden by
 * `backface-visibility` and shows through mirrored instead of the back — the
 * one moment the reverse is supposed to be on display. The fade lives on a
 * separate element; see {@link revealFadeKeyframes}.
 */

export const DROP_MS = 1600;
export const BURST_MS = 1450;
export const SCAN_MS = 1600;

/** Matches the resting transition so the reveal and the hover feel related. */
export const REVEAL_EASING = "cubic-bezier(0.24, 0.85, 0.28, 1)";

export const DEFAULT_INTENSITY = 0.7;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export interface RevealAnimation {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

/**
 * The keyframes for one entrance.
 *
 * `intensity` (0–1) scales how far the card overshoots — a common card barely
 * moves, a rare one lands hard. It never changes the duration, so a grid of
 * mixed cards still resolves together.
 *
 * `flipped` is the face the card has to land on. The keyframes replace the
 * whole transform for as long as they run — `--tc-flip` included — so an
 * entrance that ignored it would play front-up and then snap over to the back
 * the moment it released: a face-down card that shows its face on the way in.
 * A face-down entrance never turns the front towards the viewer at any point;
 * see {@link faceDownKeyframes}.
 */
export function revealKeyframes(
  mode: TradingCardReveal["mode"],
  intensity: number = DEFAULT_INTENSITY,
  speed = 1,
  flipped = false,
): RevealAnimation {
  const i = clamp01(intensity);

  if (flipped) return faceDownKeyframes(mode, i, speed);

  if (mode === "drop") {
    return {
      // Falls in face-down, lands with a bounce, then turns over.
      keyframes: [
        {
          offset: 0,
          transform: `translate3d(0, ${-160 - 100 * i}px, 0) rotateX(26deg) rotateY(180deg) scale(0.84)`,
        },
        {
          offset: 0.22,
          transform:
            "translate3d(0, -40px, 0) rotateX(8deg) rotateY(180deg) scale(0.96)",
        },
        {
          offset: 0.36,
          transform: `translate3d(0, 0, 0) rotateX(${-3 - 4 * i}deg) rotateY(180deg) scale(${1 + 0.05 * i})`,
        },
        {
          offset: 0.5,
          transform:
            "translate3d(0, 0, 0) rotateX(0deg) rotateY(180deg) scale(1)",
        },
        {
          offset: 0.74,
          transform: `translate3d(0, 0, 0) rotateX(0deg) rotateY(30deg) scale(${1 + 0.07 * i})`,
        },
        {
          offset: 1,
          transform:
            "translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1)",
        },
      ],
      options: {
        duration: Math.round(DROP_MS * speed),
        easing: REVEAL_EASING,
        fill: "none",
      },
    };
  }

  if (mode === "burst") {
    return {
      // Spins up out of nothing, overshoots, settles.
      keyframes: [
        { offset: 0, transform: "scale(0.12) rotateY(560deg)" },
        { offset: 0.2, transform: "scale(0.6) rotateY(420deg)" },
        { offset: 0.52, transform: `scale(${1 + 0.16 * i}) rotateY(180deg)` },
        { offset: 0.78, transform: `scale(${1 - 0.03 * i}) rotateY(20deg)` },
        { offset: 1, transform: "scale(1) rotateY(0deg)" },
      ],
      options: {
        duration: Math.round(BURST_MS * speed),
        easing: "cubic-bezier(0.2, 0.8, 0.24, 1)",
        fill: "none",
      },
    };
  }

  return {
    // Stays put and simply comes up, for when a full tumble would be too much.
    keyframes: [
      { offset: 0, transform: "scale(0.98) rotateY(-14deg)" },
      {
        offset: 0.55,
        transform: `scale(${1 + 0.02 * i}) rotateY(6deg)`,
      },
      { offset: 1, transform: "scale(1) rotateY(0deg)" },
    ],
    options: {
      duration: Math.round(SCAN_MS * speed),
      easing: "cubic-bezier(0.3, 0.8, 0.3, 1)",
      fill: "none",
    },
  };
}

/**
 * The face-down variants: same arrival, same timing, but the back stays towards
 * the viewer from the first frame to the last.
 *
 * Every `rotateY` sits within ±40° of 180°. The front only comes into view
 * past ±90° from there, so nothing here can show it — which rules out the
 * turnover in `drop` and the spin in `burst`. Both keep their movement and
 * trade the rotation for a small sway around the back.
 *
 * Kept as separate keyframes rather than `180deg` added to the face-up ones:
 * the face-up ones *do* pass through the front (that is the turnover), so
 * offsetting them would simply move the reveal to the other face.
 */
function faceDownKeyframes(
  mode: TradingCardReveal["mode"],
  i: number,
  speed: number,
): RevealAnimation {
  if (mode === "drop") {
    return {
      // Falls in face-down and lands with a bounce, but stays face-down.
      keyframes: [
        {
          offset: 0,
          transform: `translate3d(0, ${-160 - 100 * i}px, 0) rotateX(26deg) rotateY(180deg) scale(0.84)`,
        },
        {
          offset: 0.22,
          transform:
            "translate3d(0, -40px, 0) rotateX(8deg) rotateY(180deg) scale(0.96)",
        },
        {
          offset: 0.36,
          transform: `translate3d(0, 0, 0) rotateX(${-3 - 4 * i}deg) rotateY(180deg) scale(${1 + 0.05 * i})`,
        },
        {
          offset: 0.5,
          transform:
            "translate3d(0, 0, 0) rotateX(0deg) rotateY(180deg) scale(1)",
        },
        {
          offset: 0.74,
          transform: `translate3d(0, 0, 0) rotateX(0deg) rotateY(${180 - 10 * i}deg) scale(${1 + 0.03 * i})`,
        },
        {
          offset: 1,
          transform:
            "translate3d(0, 0, 0) rotateX(0deg) rotateY(180deg) scale(1)",
        },
      ],
      options: {
        duration: Math.round(DROP_MS * speed),
        easing: REVEAL_EASING,
        fill: "none",
      },
    };
  }

  if (mode === "burst") {
    return {
      // Swells up out of nothing and overshoots, swaying instead of spinning.
      keyframes: [
        { offset: 0, transform: "scale(0.12) rotateY(220deg)" },
        { offset: 0.2, transform: "scale(0.6) rotateY(205deg)" },
        { offset: 0.52, transform: `scale(${1 + 0.16 * i}) rotateY(172deg)` },
        { offset: 0.78, transform: `scale(${1 - 0.03 * i}) rotateY(184deg)` },
        { offset: 1, transform: "scale(1) rotateY(180deg)" },
      ],
      options: {
        duration: Math.round(BURST_MS * speed),
        easing: "cubic-bezier(0.2, 0.8, 0.24, 1)",
        fill: "none",
      },
    };
  }

  return {
    keyframes: [
      { offset: 0, transform: "scale(0.98) rotateY(166deg)" },
      {
        offset: 0.55,
        transform: `scale(${1 + 0.02 * i}) rotateY(186deg)`,
      },
      { offset: 1, transform: "scale(1) rotateY(180deg)" },
    ],
    options: {
      duration: Math.round(SCAN_MS * speed),
      easing: "cubic-bezier(0.3, 0.8, 0.3, 1)",
      fill: "none",
    },
  };
}

/** Fraction of the entrance the card spends fading in. */
const FADE_FRACTION = 0.22;

/**
 * When the burst goes off, as a fraction of the entrance.
 *
 * Roughly a third in — the moment the card lands in `drop` and the moment it
 * reaches full size in `burst`. Early enough that the light is still expanding
 * as the card settles, rather than arriving after the movement is over.
 */
export const BURST_AT_FRACTION = 0.34;

/** When the scan beam starts crossing, as a fraction of the entrance. */
export const BEAM_DELAY_FRACTION = 0.1125;
/** How much of the entrance the beam takes to cross, as a fraction. */
export const BEAM_SPAN_FRACTION = 0.75;

/**
 * The sweep of light that crosses the card during a `scan` entrance.
 *
 * Timed off the entrance rather than given its own duration, so the beam is
 * always finished by the time the card settles however the speed is tuned.
 */
export function beamKeyframes(entranceMs: number): RevealAnimation {
  return {
    keyframes: [
      { opacity: "0", transform: "translateX(-160%) skewX(-16deg)" },
      { opacity: "1", offset: 0.15 },
      { opacity: "1", offset: 0.85 },
      { opacity: "0", transform: "translateX(300%) skewX(-16deg)" },
    ],
    options: {
      duration: Math.round(entranceMs * BEAM_SPAN_FRACTION),
      delay: Math.round(entranceMs * BEAM_DELAY_FRACTION),
      easing: "cubic-bezier(0.4, 0, 0.3, 1)",
      fill: "none",
    },
  };
}

/**
 * The fade, kept separate from the movement.
 *
 * It has to run on an element *outside* the 3D group — the card root rather
 * than the 3D wrapper — because an opacity below 1 flattens `preserve-3d` on
 * whatever carries it. Put this on the wrapper and the card turns to cardboard
 * for the first fifth of its entrance: both faces render on one plane and the
 * front shows through mirrored where the back should be.
 */
export function revealFadeKeyframes(
  mode: TradingCardReveal["mode"],
  speed = 1,
): RevealAnimation {
  const total =
    mode === "drop" ? DROP_MS : mode === "burst" ? BURST_MS : SCAN_MS;
  return {
    keyframes: [{ opacity: "0" }, { opacity: "1" }],
    options: {
      duration: Math.round(total * FADE_FRACTION * speed),
      easing: "ease-out",
      fill: "none",
    },
  };
}

/**
 * The staggered flash that runs the light up the layer stack, bottom to top.
 * One entry per layer, in paint order.
 *
 * Returned as data rather than applied here so the timing is testable without
 * a DOM: the caller pairs entry `n` with the nth `[data-part="layer"]`.
 */
export interface LayerFlash {
  index: number;
  delayMs: number;
  durationMs: number;
}

export const CASCADE_STEP_MS = 110;
export const FLASH_MS = 420;

export function layerCascade(
  layerCount: number,
  speed = 1,
  startDelayMs = 0,
): LayerFlash[] {
  return Array.from({ length: Math.max(0, layerCount) }, (_, index) => ({
    index,
    delayMs: Math.round((startDelayMs + index * CASCADE_STEP_MS) * speed),
    durationMs: Math.round(FLASH_MS * speed),
  }));
}
