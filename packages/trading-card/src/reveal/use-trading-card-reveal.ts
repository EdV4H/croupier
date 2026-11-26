import { type RefObject, useCallback, useEffect, useRef } from "react";
import type { TradingCardReveal } from "../schemas/trading-card";
import { type BurstHandle, playBurst } from "./trading-card.particles";
import {
  BURST_AT_FRACTION,
  beamKeyframes,
  DEFAULT_INTENSITY,
  layerCascade,
  revealFadeKeyframes,
  revealKeyframes,
} from "./trading-card.reveal";

/** Beat between a card scrolling into view and its entrance starting. */
const DEFAULT_AUTO_DELAY_MS = 420;

export interface UseTradingCardRevealArgs {
  reveal: TradingCardReveal | undefined;
  /**
   * The card root, as an element rather than a ref: the auto trigger has to
   * re-arm when it attaches, which a ref cannot signal.
   */
  rootEl: HTMLElement | null;
  /** The 3D wrapper the entrance actually animates. */
  innerRef: RefObject<HTMLElement | null>;
  reducedMotion: boolean;
  /**
   * Whether the card is face-down. The entrance has to land on — and stay on —
   * the face the card is showing, since its keyframes replace `--tc-flip` for
   * as long as they run.
   */
  flipped: boolean;
  /** Duration multiplier, shared with the rest of the card's motion. */
  speed: number;
  /**
   * Set for the length of the entrance. Owned by the caller so the pointer
   * handlers can read it without the hook's return value having to be threaded
   * through their dependency lists.
   */
  playingRef: RefObject<boolean>;
  onComplete?: () => void;
}

export interface UseTradingCardRevealReturn {
  /** Play the entrance now. Ignored while one is already running. */
  play: () => void;
}

/**
 * Runs the entrance animation.
 *
 * Everything here is imperative Web Animations work against refs — no state, so
 * an entrance never re-renders the card. The animations are all `fill: "none"`,
 * so when they finish the card falls straight back under the control of the CSS
 * variables the pointer handlers write.
 */
export function useTradingCardReveal({
  reveal,
  rootEl,
  innerRef,
  reducedMotion,
  flipped,
  speed,
  playingRef,
  onComplete,
}: UseTradingCardRevealArgs): UseTradingCardRevealReturn {
  const animationsRef = useRef<Animation[]>([]);
  const burstsRef = useRef<BurstHandle[]>([]);
  /** Timers belonging to the entrance that is running. Cleared when it is. */
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  /**
   * The auto trigger's own beat, kept apart from `timersRef`.
   *
   * `cleanup()` tears down *the entrance that is running*; a scheduled future
   * entrance is not part of that, and clearing it there would conflate
   * "stop what is playing" with "cancel what is about to play".
   */
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didAutoRef = useRef(false);

  // Read through refs so `play` stays stable and the auto effect does not
  // re-arm every time a parent re-renders.
  const configRef = useRef({
    reveal,
    reducedMotion,
    flipped,
    speed,
    onComplete,
  });
  configRef.current = { reveal, reducedMotion, flipped, speed, onComplete };

  const cleanup = useCallback(() => {
    for (const animation of animationsRef.current) {
      // Drop the callbacks before cancelling. WAAPI queues `cancel` as an
      // event, so a handler left attached here fires *after* the next entrance
      // has already set `playingRef` — the previous run's `oncancel` would then
      // clear the flag out from under the new animation, and `flushPointer`
      // would start writing pointer variables into a running entrance.
      animation.onfinish = null;
      animation.oncancel = null;
      animation.cancel();
    }
    animationsRef.current = [];
    // Every node the burst created has to come back out. A card unmounted
    // mid-entrance, or StrictMode running the effect twice, must not leave
    // particles behind on a detached tree.
    for (const burst of burstsRef.current) {
      for (const animation of burst.animations) animation.cancel();
      burst.dispose();
    }
    burstsRef.current = [];
    for (const timer of timersRef.current) clearTimeout(timer);
    timersRef.current = [];
  }, []);

  const play = useCallback(() => {
    const {
      reveal: config,
      reducedMotion: reduced,
      flipped: faceDown,
      speed: rate,
    } = configRef.current;
    const inner = innerRef.current;
    if (!config || !inner || !rootEl) return;

    // Checked and set synchronously: the machine dispatches on a microtask, so
    // a state flag would let a double-click through before it settled.
    if (playingRef.current) return;

    // The entrance is a once-per-card event however it was started. Without
    // this, a card played by hand before it scrolled into view would arrive a
    // second time the moment the observer caught up.
    didAutoRef.current = true;
    if (autoTimerRef.current !== null) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }

    // Reduced motion gets the end state and nothing else.
    if (reduced) {
      configRef.current.onComplete?.();
      return;
    }

    playingRef.current = true;
    cleanup();

    const { keyframes, options } = revealKeyframes(
      config.mode,
      config.intensity ?? DEFAULT_INTENSITY,
      rate,
      faceDown,
    );
    const main = inner.animate(keyframes, options);
    animationsRef.current.push(main);

    // The fade goes on the root, never on the 3D wrapper: opacity below 1
    // flattens preserve-3d, and a flattened card shows its front through where
    // the back should be for as long as the fade lasts.
    const fade = revealFadeKeyframes(config.mode, rate);
    animationsRef.current.push(rootEl.animate(fade.keyframes, fade.options));

    // Run the light up the stack, bottom to top. Each layer's own opacity comes
    // from the consumer's CSS, so it is read off the element rather than
    // assumed — the library never learns what any layer is.
    const layers = Array.from(
      rootEl.querySelectorAll<HTMLElement>("[data-part='layer']"),
    );
    const startDelay = Number(options.duration ?? 0) * BURST_AT_FRACTION;
    for (const step of layerCascade(layers.length, rate, startDelay)) {
      const layer = layers[step.index];
      if (!layer) continue;
      const target = getComputedStyle(layer).opacity;
      if (target === "0") continue;
      const flash = layer.animate([{ opacity: "0" }, { opacity: target }], {
        duration: step.durationMs,
        delay: step.delayMs,
        fill: "none",
      });
      animationsRef.current.push(flash);
    }

    const duration = Number(options.duration ?? 0);

    // The burst, on the stage if the consumer rendered one. No stage, no
    // particles — a card that opted out of the fireworks renders no nodes.
    const stage = rootEl.querySelector<HTMLElement>(
      "[data-part='reveal-stage']",
    );
    if (stage) {
      const accent =
        getComputedStyle(rootEl).getPropertyValue("--tc-accent").trim() ||
        "rgba(255,255,255,.9)";
      timersRef.current.push(
        setTimeout(
          () => {
            burstsRef.current.push(
              playBurst({
                stage,
                intensity: config.intensity ?? DEFAULT_INTENSITY,
                speed: rate,
                accent,
              }),
            );
          },
          Math.round(duration * BURST_AT_FRACTION),
        ),
      );
    }

    // The scan sweep, if there is a beam to sweep.
    if (config.mode === "scan") {
      for (const beam of rootEl.querySelectorAll<HTMLElement>(
        "[data-part='beam']",
      )) {
        const { keyframes: beamFrames, options: beamOptions } =
          beamKeyframes(duration);
        animationsRef.current.push(beam.animate(beamFrames, beamOptions));
      }
    }

    main.onfinish = () => {
      playingRef.current = false;
      animationsRef.current = [];
      // The bursts are deliberately left alone. Particles outlive the card's
      // own movement — the spray is still travelling when the card lands — and
      // each burst removes its own nodes once its last animation settles.
      //
      // Disposing here instead would both cut the fireworks off mid-flight and
      // detach the nodes out from under animations that are still running. The
      // handles stay in `burstsRef` so `cleanup()` can still cut them short if
      // the card goes away first.
      configRef.current.onComplete?.();
    };
    main.oncancel = () => {
      playingRef.current = false;
    };
  }, [cleanup, innerRef, rootEl, playingRef]);

  // Auto-play once, the first time the card is actually on screen.
  //
  // Two cases, and they want different timing. A card that is already visible
  // when it mounts — one inside a dialog that just opened — has to start
  // immediately, or it sits there fully drawn for a beat and then snaps to
  // invisible to begin its entrance, which reads as a glitch rather than an
  // arrival. A card further down the page can afford the configured beat once
  // it scrolls in.
  //
  // Depends on `rootEl` rather than reading a ref, so it arms whenever the
  // element actually attaches. Portalled content is not guaranteed to be in the
  // DOM on the first commit, and a ref read here would silently come back null
  // and never retry.
  useEffect(() => {
    if (!reveal?.auto || !rootEl || didAutoRef.current) return;

    const start = (delayMs: number) => {
      if (didAutoRef.current) return;
      didAutoRef.current = true;
      if (delayMs <= 0) {
        play();
        return;
      }
      autoTimerRef.current = setTimeout(play, delayMs);
    };

    const rect = rootEl.getBoundingClientRect();
    const alreadyVisible =
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth;
    if (alreadyVisible) {
      start(0);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      start(0);
      return;
    }

    const delay =
      (reveal.delayMs ?? DEFAULT_AUTO_DELAY_MS) * configRef.current.speed;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      start(delay);
    });
    observer.observe(rootEl);
    return () => observer.disconnect();
  }, [reveal?.auto, reveal?.delayMs, rootEl, play]);

  // Cancel everything on unmount. Without this, StrictMode's double effect and
  // a card removed mid-animation both leave animations running on a dead node.
  // The auto beat is cleared here rather than in `cleanup`, which only tears
  // down the entrance that is running.
  useEffect(() => {
    return () => {
      cleanup();
      if (autoTimerRef.current !== null) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [cleanup]);

  return { play };
}
