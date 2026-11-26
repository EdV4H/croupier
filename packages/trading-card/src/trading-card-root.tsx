import type { Assign, HTMLProps, PolymorphicProps } from "@ark-ui/react";
import { ark } from "@ark-ui/react";
import { createSplitProps } from "./internal";
import { mergeProps } from "@zag-js/react";
import {
  forwardRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { partProps } from "./part-props";
import { useTradingCardReveal } from "./reveal/use-trading-card-reveal";
import type {
  TradingCardFinish,
  TradingCardReveal,
} from "./schemas/trading-card";
import { parts } from "./state-machine/trading-card.anatomy";
import {
  CLICK_THRESHOLD_PX,
  DEFAULT_HOVER_SCALE,
  DEFAULT_MOTION_SPEED,
  DEFAULT_TILT_MAX,
  defaultVarStyle,
  dragVars,
  normalizeVars,
  pointerVars,
  shadowTransform,
  snapDry,
  transitionMs,
} from "./state-machine/trading-card.optics";
import { type UseTradingCardProps, useTradingCard } from "./use-trading-card";
import { TradingCardProvider } from "./use-trading-card-context";

export interface TradingCardRootBaseProps
  extends UseTradingCardProps,
    PolymorphicProps {
  /**
   * Look and motion tuning. Only values that do not change at runtime belong
   * here; everything the layer CSS reads goes through `finish.vars`.
   *
   * Hoist this object to module scope and reuse it — a fresh literal each
   * render is handled correctly but does needless work.
   */
  finish?: TradingCardFinish;
  /**
   * Whether dragging the card spins it freely. Rotation always snaps back to a
   * square-on face on release, so it produces no persistent outcome.
   * Automatically disabled under reduced motion and on touch.
   * @default true
   */
  dragRotate?: boolean;
  /**
   * Where the flip control lives.
   *
   * - `"trigger"` (default) — a separate `FlipTrigger` is the control, and the
   *   card itself is a plain container. Use this whenever the card holds
   *   anything interactive of its own; a link inside a button is invalid.
   * - `"card"` — the card *is* the control: focusable, `aria-pressed`, and
   *   flipped by Enter or Space. Nothing else to render and nothing appears
   *   out of nowhere on focus, so prefer it for a card whose content is
   *   inert. Do not put links or buttons inside a card in this mode.
   *
   * @default "trigger"
   */
  flipTrigger?: "trigger" | "card";
  /**
   * Entrance animation. Omit it entirely and the card simply appears.
   *
   * The animation is `fill: "none"`, so when it ends the card hands straight
   * back to the pointer-driven transform. Skipped under reduced motion.
   *
   * `auto` decides who starts it. Left at its default of `false`, the entrance
   * waits to be asked for: call `useTradingCardContext().playReveal()` from
   * anywhere inside the card, or from a control the host app renders alongside
   * it.
   *
   * @experimental The least settled part of the API.
   */
  reveal?: TradingCardReveal;
  /** Called when the entrance finishes (or is skipped for reduced motion). */
  onRevealComplete?: () => void;
}

export interface TradingCardRootProps
  extends Assign<HTMLProps<"div">, TradingCardRootBaseProps> {}

/**
 * Anything the consumer put on the card that handles its own activation. A
 * press that starts here must not also flip or spin the card: the flip trigger
 * would toggle twice and cancel itself out, and a link would spin the card on
 * its way to being clicked.
 */
const INTERACTIVE_SELECTOR =
  "a[href], button, input, select, textarea, label, [role='button'], [role='link'], [contenteditable='true']";

/**
 * Whether the press landed on a control the consumer put *inside* the card.
 *
 * The search deliberately stops short of the card itself. In `flipTrigger="card"`
 * mode the card carries `role="button"`, which the selector above matches — so a
 * plain `closest()` would decide every press had landed on a control and quietly
 * suppress the very flip the card exists to perform.
 */
const pressedInnerControl = (target: EventTarget | null, root: Element) => {
  const hit = (target as Element | null)?.closest?.(INTERACTIVE_SELECTOR);
  return Boolean(hit) && hit !== root;
};

/**
 * Pointer capture is best-effort. Both calls throw if the pointer is no longer
 * active — a pointer cancelled by the OS, a stale id — and an exception here
 * would abort the rest of the gesture handler, leaving the card mid-drag.
 */
/**
 * Whether this is a development build.
 *
 * Read off `globalThis` rather than referencing `process` directly: this
 * package builds without Node types and ships to browsers, where a bare
 * `process` is a runtime error rather than a missing variable.
 *
 * An absent `NODE_ENV` counts as *not* development. The usual convention is
 * `!== "production"`, which treats unknown as development so warnings are never
 * lost — but that convention assumes a bundler has substituted the value.
 * Reading through `globalThis` defeats that substitution, so an unknown value
 * here means a browser that was handed the package with no bundler at all, and
 * warning every one of those users in production is the worse mistake. Every
 * other value ("development", "test", "staging") still warns.
 */
const isDevBuild = () => {
  const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } })
    .process?.env?.NODE_ENV;
  return env !== undefined && env !== "production";
};

/**
 * A media query's current answer, or `null` where there is nobody to ask —
 * server rendering, or a test environment without `matchMedia`. `null` is
 * deliberately distinct from `false` so each caller can pick its own default.
 */
const matchesMedia = (query: string): boolean | null => {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  return window.matchMedia(query).matches;
};

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server, where a layout
 * effect never runs and React warns about every one it is handed.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const capturePointer = (el: Element, pointerId: number, capture: boolean) => {
  try {
    if (capture) el.setPointerCapture(pointerId);
    else el.releasePointerCapture(pointerId);
  } catch {
    // Capture is an optimization for tracking outside the element, not a
    // requirement — the gesture still works without it.
  }
};

interface DragState {
  /** Pointer is down on the card. */
  down: boolean;
  /**
   * Which pointer pressed. A press survives the pointer wandering off the card
   * and back, so the release has to prove it belongs to the same gesture rather
   * than to something that started elsewhere and happened to end up here.
   */
  pointerId: number | null;
  /** The press landed on an interactive descendant, so the card stays put. */
  onInteractive: boolean;
  /** Pointer is down *and* free rotation is allowed. */
  rotating: boolean;
  startX: number;
  startY: number;
  /** Greatest distance travelled from the press point, for the click threshold. */
  moved: number;
  /** Accumulated rotation at press time. */
  drx0: number;
  dry0: number;
  /** Live accumulated rotation. */
  drx: number;
  dry: number;
}

/**
 * The input layer. Owns the perspective, the pointer gestures, and every CSS
 * custom property the presentation layer reads.
 *
 * The hard rule this component exists to enforce: **a pointer move never
 * touches React state.** The move handler stores the event on a ref, schedules
 * one `requestAnimationFrame`, and the frame callback writes variables straight
 * to the DOM. Only the coarse discrete transitions (enter, leave, drag
 * start/end, flip) go through the state machine.
 *
 * Renders the shadow and the 3D wrapper itself; `children` land inside the
 * wrapper, so consumers write `Front` and `Back` directly under `Root`.
 */
export const TradingCardRoot = forwardRef<HTMLDivElement, TradingCardRootProps>(
  (props, ref) => {
    const [machineProps, rest] = createSplitProps<UseTradingCardProps>()(
      props,
      [
        "id",
        "dir",
        "getRootNode",
        "flipped",
        "defaultFlipped",
        "onFlipChange",
        "flippable",
      ],
    );
    const {
      finish,
      dragRotate = true,
      flipTrigger = "trigger",
      reveal,
      onRevealComplete,
      children,
      ...localProps
    } = rest as TradingCardRootProps;

    const machine = useTradingCard(machineProps);

    // Environment queries. Both change approximately never, so the two renders
    // they can cause are irrelevant.
    //
    // Seeded from `matchMedia` on the very first client render rather than from
    // a fixed default, so the answer is right one render earlier. The defaults
    // are still what SSR and a no-`matchMedia` environment get, which is why
    // the recipe carries `@media` fallbacks for the same two conditions —
    // nothing this component writes exists before hydration.
    const [reducedMotion, setReducedMotion] = useState(
      () => matchesMedia("(prefers-reduced-motion: reduce)") ?? false,
    );
    const [hoverCapable, setHoverCapable] = useState(
      () => matchesMedia("(hover: hover) and (pointer: fine)") ?? true,
    );

    const rootElRef = useRef<HTMLDivElement | null>(null);
    // Mirrored into state so the entrance can arm the moment the node attaches.
    // One extra render on mount, and none after — nowhere near the pointer path.
    const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
    const shadowElRef = useRef<HTMLDivElement | null>(null);
    const innerElRef = useRef<HTMLDivElement | null>(null);
    /** Set while the entrance runs; the pointer handlers stand down. */
    const revealPlayingRef = useRef(false);
    const rafRef = useRef(0);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const dragRef = useRef<DragState>({
      down: false,
      pointerId: null,
      onInteractive: false,
      rotating: false,
      startX: 0,
      startY: 0,
      moved: 0,
      drx0: 0,
      dry0: 0,
      drx: 0,
      dry: 0,
    });

    // Mirrors of values the rAF callback needs. Reading them from refs keeps
    // the callback identity stable across renders.
    const tiltMax = finish?.tilt?.max ?? DEFAULT_TILT_MAX;
    const hoverScale = finish?.tilt?.hoverScale ?? DEFAULT_HOVER_SCALE;
    const shadowFollow = finish?.shadow?.follow ?? true;
    const speed = finish?.motion?.speed ?? DEFAULT_MOTION_SPEED;

    const optionsRef = useRef({
      tiltMax,
      hoverScale,
      shadowFollow,
      speed,
      dragRotate,
      reducedMotion,
      hoverCapable,
    });
    optionsRef.current = {
      tiltMax,
      hoverScale,
      shadowFollow,
      speed,
      dragRotate,
      reducedMotion,
      hoverCapable,
    };

    // `play` is handed to consumers through the context rather than dropped:
    // `reveal.auto` defaults to false, so without an on-demand path that
    // default would mean "an entrance that can never run".
    const { play: playReveal } = useTradingCardReveal({
      reveal,
      rootEl,
      innerRef: innerElRef,
      reducedMotion,
      flipped: machine.flipped,
      speed,
      playingRef: revealPlayingRef,
      onComplete: onRevealComplete,
    });

    /**
     * Park the card while it is off screen.
     *
     * Layer animations are cheap alone and ruinous in bulk: twenty cards each
     * looping a sparkle drift and a hue rotate keeps the compositor busy for
     * rows nobody is looking at. The attribute lets the recipe pause them, and
     * the pointer handlers bail out early rather than measuring a card that is
     * not in view.
     *
     * Written straight to the DOM rather than held in state — nothing about
     * this needs to re-render the card.
     */
    const offscreenRef = useRef(false);

    useEffect(() => {
      if (!rootEl || typeof IntersectionObserver === "undefined") return;
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries.some((entry) => entry.isIntersecting);
          offscreenRef.current = !visible;
          if (visible) rootEl.removeAttribute("data-offscreen");
          else rootEl.setAttribute("data-offscreen", "");
        },
        // A little slack, so a card is already running by the time it arrives.
        { rootMargin: "100px" },
      );
      observer.observe(rootEl);
      return () => observer.disconnect();
    }, [rootEl]);

    // The spec puts the blend budget at about six layers per card, and blending
    // is the expensive part. The component cannot enforce it — layers are the
    // consumer's to compose — so say something once, in development only.
    useEffect(() => {
      if (!isDevBuild() || !rootEl) return;
      const count = rootEl.querySelectorAll("[data-part='layer']").length;
      if (count <= 6) return;
      console.warn(
        `[TradingCard] ${count} layers on one card. Each blended layer costs ` +
          "compositing work; the spec puts the practical ceiling around 6. " +
          "Consider folding two treatments into one gradient.",
      );
    }, [rootEl]);

    // Consumer-supplied variables, normalized once per distinct `finish`.
    // Keyed on the object rather than on serialized content: `finish` is
    // documented as a hoist-to-module-scope value, so reference equality holds
    // for the intended usage, and a card that does pass a fresh literal each
    // render only pays one walk of the object — not a `stringify` on every
    // render plus a `parse` in the effect, twenty times over in a list.
    const vars = useMemo(() => normalizeVars(finish?.vars), [finish]);
    const appliedVarKeysRef = useRef<string[]>([]);

    // Keyed on `rootEl` as well as `vars`, and reading the element from state
    // rather than the ref. `finish` is documented as a hoist-to-module-scope
    // value, so `vars` very often never changes for the life of the card — if
    // the element had not attached yet on the first run there would be nothing
    // to bring the effect back, and the card would ship with every layer
    // coefficient unset.
    useEffect(() => {
      if (!rootEl) return;
      // Drop variables the previous finish set and this one does not, so
      // switching between presets cannot leave a stale layer lit.
      for (const key of appliedVarKeysRef.current) {
        if (!(key in vars)) rootEl.style.removeProperty(key);
      }
      for (const [key, value] of Object.entries(vars)) {
        rootEl.style.setProperty(key, value);
      }
      appliedVarKeysRef.current = Object.keys(vars);
    }, [vars, rootEl]);

    useEffect(() => {
      if (typeof window === "undefined" || !window.matchMedia) return;
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const update = () => setReducedMotion(mq.matches);
      update();
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }, []);

    useEffect(() => {
      if (typeof window === "undefined" || !window.matchMedia) return;
      const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
      const update = () => setHoverCapable(mq.matches);
      update();
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }, []);

    useEffect(() => {
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, []);

    // The flip duration. The face itself (`--tc-flip`) is not written here: it
    // goes out with the render, in `style` below, so a card mounted face-down is
    // face-down in its very first frame — and in server-rendered markup.
    // Written from an effect it arrived one paint late, and a card mounted with
    // `flipped` showed its front for a frame before turning over to the back.
    //
    // A layout effect rather than a plain one, so the duration lands before the
    // browser picks up the new `--tc-flip` and starts the transition. A plain
    // effect runs after paint, and the turn would start on whatever duration
    // the pointer handlers last left behind.
    //
    // `reducedMotion` and `speed` are read from props/state rather than through
    // `optionsRef`, so they can be listed as dependencies. Keying on the flip
    // alone would write the mount-time duration and then never revisit it: a
    // card mounted before the reduced-motion query settles would keep `--tc-t`
    // at the full 760ms until the next flip.
    useIsomorphicLayoutEffect(() => {
      const el = rootElRef.current;
      if (!el) return;
      el.style.setProperty(
        "--tc-t",
        reducedMotion ? "0ms" : `${transitionMs("snap", speed)}ms`,
      );
    }, [machine.flipped, reducedMotion, speed]);

    const flushPointer = useCallback(() => {
      rafRef.current = 0;
      const el = rootElRef.current;
      const point = lastPointRef.current;
      if (!el || !point) return;
      // The entrance owns the transform while it runs; writing pointer
      // variables underneath it would fight the animation.
      if (revealPlayingRef.current) return;
      // Nothing to track for a card nobody can see.
      if (offscreenRef.current) return;

      const o = optionsRef.current;
      const drag = dragRef.current;

      if (drag.rotating) {
        const { drx, dry } = dragVars({
          dx: point.x - drag.startX,
          dy: point.y - drag.startY,
          drx0: drag.drx0,
          dry0: drag.dry0,
        });
        drag.drx = drx;
        drag.dry = dry;
        el.style.setProperty("--tc-drx", `${drx.toFixed(2)}deg`);
        el.style.setProperty("--tc-dry", `${dry.toFixed(2)}deg`);
        return;
      }

      const rect = el.getBoundingClientRect();
      const v = pointerVars({
        rect,
        clientX: point.x,
        clientY: point.y,
        tiltMax: o.tiltMax,
        hoverScale: o.hoverScale,
        reducedMotion: o.reducedMotion,
        hoverCapable: o.hoverCapable,
      });

      // Unitless on purpose: the layer CSS does `calc(var(--tc-px) * 1%)`, and
      // a unit here would invalidate that calc and silently blank the layer.
      el.style.setProperty("--tc-px", v.px.toFixed(2));
      el.style.setProperty("--tc-py", v.py.toFixed(2));
      el.style.setProperty("--tc-rx", `${v.rx.toFixed(2)}deg`);
      el.style.setProperty("--tc-ry", `${v.ry.toFixed(2)}deg`);
      el.style.setProperty("--tc-hyp", v.hyp.toFixed(3));
      // Written from here too, not just on enter. `pointerVars` collapses the
      // scale to 1 under reduced motion, and if that switches on mid-hover the
      // enter handler is not coming back to undo the value it left behind —
      // the card would sit there enlarged for as long as the pointer stayed.
      el.style.setProperty("--tc-sc", String(v.sc));

      const shadow = shadowElRef.current;
      if (shadow && o.shadowFollow) {
        const s = shadowTransform(v);
        shadow.style.transform = s.transform;
        shadow.style.opacity = s.opacity;
      }
    }, []);

    const schedule = useCallback(
      (clientX: number, clientY: number) => {
        lastPointRef.current = { x: clientX, y: clientY };
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(flushPointer);
      },
      [flushPointer],
    );

    const onPointerEnter = useCallback(() => {
      const el = rootElRef.current;
      const o = optionsRef.current;
      if (el && !o.reducedMotion && o.hoverCapable) {
        el.style.setProperty("--tc-t", `${transitionMs("hover", o.speed)}ms`);
        el.style.setProperty("--tc-sc", String(o.hoverScale));
      }
      machine.pointerEnter();
    }, [machine]);

    const onPointerMove = useCallback(
      (e: ReactPointerEvent<HTMLDivElement>) => {
        const o = optionsRef.current;
        // Nothing to track on touch or under reduced motion unless a rotation
        // drag is in progress.
        if (!dragRef.current.rotating && (!o.hoverCapable || o.reducedMotion)) {
          return;
        }
        if (dragRef.current.down) {
          const dx = e.clientX - dragRef.current.startX;
          const dy = e.clientY - dragRef.current.startY;
          dragRef.current.moved = Math.max(
            dragRef.current.moved,
            Math.hypot(dx, dy),
          );
        }
        schedule(e.clientX, e.clientY);
      },
      [schedule],
    );

    const resetToRest = useCallback(() => {
      const el = rootElRef.current;
      if (!el) return;
      const o = optionsRef.current;
      for (const [key, value] of Object.entries(defaultVarStyle())) {
        el.style.setProperty(key, value);
      }
      el.style.setProperty("--tc-t", `${transitionMs("leave", o.speed)}ms`);
      const shadow = shadowElRef.current;
      if (shadow) {
        shadow.style.transform = "translate3d(0, 26px, 0) scale(0.94)";
        shadow.style.opacity = "0.5";
      }
    }, []);

    // Put the card back to neutral when the environment turns against motion
    // while the pointer is still on it.
    //
    // Nothing else will: the move handler stands down under reduced motion and
    // on touch, so it never gets to write the neutral state, and the enter
    // handler that wrote the hover scale is not coming back. Without this the
    // card sits there enlarged and tilted for as long as the pointer stays.
    useEffect(() => {
      if (!rootEl) return;
      if (reducedMotion || !hoverCapable) resetToRest();
    }, [reducedMotion, hoverCapable, rootEl, resetToRest]);

    const onPointerLeave = useCallback(() => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      lastPointRef.current = null;
      const drag = dragRef.current;
      const wasRotating = drag.rotating;
      // `down` and `onInteractive` describe the *press*, which is still going
      // on: the finger has not lifted, it has only wandered off the card.
      // Clearing them here made `endDrag` bail out on the way back, so a press
      // that crossed the edge and returned never flipped the card — a jitter at
      // the boundary was enough to lose the click. Whether the round trip
      // counts as a click is `endDrag`'s call, decided on distance travelled.
      //
      // Only the rotation ends here. Note that a leave mid-gesture means
      // pointer capture was never granted; with capture the boundary events are
      // held back until release, and this path is never taken.
      drag.rotating = false;

      // A leave can arrive without an `endDrag` — pointer capture may never have
      // been granted, or the OS may have taken the pointer away. Settle the
      // rotation here too, or the card is left tilted with nothing coming to
      // straighten it.
      if (wasRotating) {
        const el = rootElRef.current;
        drag.drx = 0;
        drag.dry = snapDry(drag.dry);
        if (el) {
          el.style.setProperty("--tc-drx", "0deg");
          el.style.setProperty("--tc-dry", `${drag.dry}deg`);
        }
        machine.dragEnd();
      }

      resetToRest();
      machine.pointerLeave();
    }, [machine, resetToRest]);

    const onPointerDown = useCallback(
      (e: ReactPointerEvent<HTMLDivElement>) => {
        const el = rootElRef.current;
        if (!el) return;
        const o = optionsRef.current;
        const drag = dragRef.current;

        drag.down = true;
        drag.pointerId = e.pointerId;
        drag.startX = e.clientX;
        drag.startY = e.clientY;
        drag.moved = 0;
        drag.drx0 = drag.drx;
        drag.dry0 = drag.dry;
        drag.onInteractive = pressedInnerControl(e.target, e.currentTarget);
        drag.rotating =
          !drag.onInteractive &&
          o.dragRotate &&
          o.hoverCapable &&
          !o.reducedMotion;

        // Capturing on an interactive descendant would swallow its own click.
        if (!drag.onInteractive) {
          capturePointer(e.currentTarget, e.pointerId, true);
        }

        if (drag.rotating) {
          el.style.setProperty("--tc-t", `${transitionMs("drag", o.speed)}ms`);
          machine.dragStart();
        }
      },
      [machine],
    );

    const endDrag = useCallback(
      (e: ReactPointerEvent<HTMLDivElement>) => {
        const el = rootElRef.current;
        const drag = dragRef.current;
        if (!drag.down) return;
        // A press that started somewhere else and merely ended up over the card
        // is not this card's release.
        if (drag.pointerId !== null && drag.pointerId !== e.pointerId) return;

        const wasRotating = drag.rotating;
        const wasClick = drag.moved < CLICK_THRESHOLD_PX;
        const onInteractive = drag.onInteractive;
        drag.down = false;
        drag.pointerId = null;
        drag.rotating = false;
        drag.onInteractive = false;
        if (!onInteractive) {
          capturePointer(e.currentTarget, e.pointerId, false);
        }

        if (el) {
          const o = optionsRef.current;
          el.style.setProperty("--tc-t", `${transitionMs("snap", o.speed)}ms`);
          if (wasRotating) {
            drag.drx = 0;
            drag.dry = snapDry(drag.dry);
            el.style.setProperty("--tc-drx", "0deg");
            el.style.setProperty("--tc-dry", `${drag.dry}deg`);
          }
        }

        if (wasRotating) machine.dragEnd();
        // Pointer flip. A press that landed on a control the consumer put on
        // the card is left alone: that element already handles itself, and
        // flipping here too would toggle twice and cancel out.
        if (wasClick && !onInteractive) machine.toggleFlip();
      },
      [machine],
    );

    const cardIsTrigger = flipTrigger === "card" && machine.flippable;

    /**
     * Enter and Space, split the way a native button splits them.
     *
     * Enter fires on key down and repeats while held. Space does not: it is
     * swallowed on the way down — otherwise the page scrolls out from under the
     * card — and only acts on release. Firing Space on key down instead would
     * both diverge from every other button on the page and turn a held key into
     * a stream of flips, since key repeat keeps sending key down events.
     */
    const spaceHeldRef = useRef(false);

    const onKeyDown = useCallback(
      (e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (!cardIsTrigger) return;
        if (e.target !== e.currentTarget) return;

        if (e.key === " ") {
          e.preventDefault();
          spaceHeldRef.current = true;
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          machine.toggleFlip();
        }
      },
      [cardIsTrigger, machine],
    );

    const onKeyUp = useCallback(
      (e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (e.key !== " ") return;
        // Only if the press started here: a Space released over the card after
        // starting somewhere else is not an activation of this card.
        if (!spaceHeldRef.current) return;
        spaceHeldRef.current = false;
        if (!cardIsTrigger) return;
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        machine.toggleFlip();
      },
      [cardIsTrigger, machine],
    );

    // A card that loses focus mid-press never sees the key up, so the held flag
    // would survive and fire on the next unrelated release.
    const onBlur = useCallback(() => {
      spaceHeldRef.current = false;
    }, []);

    const mergedProps = mergeProps(
      partProps<"div">(parts.root.attrs, {
        "data-state": machine.state,
        "data-flipped": machine.flipped ? "" : undefined,
        // Lets the recipe switch off layer animations even when the consumer's
        // own layer CSS forgot to. `@media (prefers-reduced-motion)` alone
        // cannot see this component's state; the attribute can.
        "data-reduced-motion": reducedMotion ? "" : undefined,
        // The grab cursor and `touch-action: none` are only honest while the
        // card can actually be dragged. Off, the card looks grabbable but is
        // not, and it suppresses page scrolling for a gesture it will ignore.
        //
        // The attribute states the *conclusion*, not one of its inputs: it
        // carries the same three conditions `onPointerDown` uses to decide
        // whether a press rotates the card. Reporting only the prop would leave
        // an attribute named "drag disabled" absent from cards that will not
        // drag, and the CSS would be relying on separate rules to say the same
        // thing twice.
        "data-drag-disabled":
          dragRotate && hoverCapable && !reducedMotion ? undefined : "",
        // When the card is the control, it has to say so and be reachable.
        // The accessible name comes from the card's contents, so pass an
        // `aria-label` whenever that content is decorative.
        role: cardIsTrigger ? "button" : undefined,
        tabIndex: cardIsTrigger ? 0 : undefined,
        "aria-pressed": cardIsTrigger ? machine.flipped : undefined,
        onKeyDown,
        onKeyUp,
        onBlur,
        onPointerEnter,
        onPointerMove,
        onPointerLeave,
        onPointerDown,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        // The face, rendered rather than written after the fact; see the
        // `--tc-t` effect above. Merged under the consumer's own `style`.
        style: { "--tc-flip": machine.flipped ? "180deg" : "0deg" },
      }),
      localProps,
    );

    return (
      <TradingCardProvider
        value={{ ...machine, reducedMotion, hoverCapable, playReveal }}
      >
        <ark.div
          {...mergedProps}
          ref={(node: HTMLDivElement | null) => {
            rootElRef.current = node;
            setRootEl(node);
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
        >
          <div {...parts.shadow.attrs} ref={shadowElRef} />
          <div {...parts.inner.attrs} ref={innerElRef}>
            {children}
          </div>
        </ark.div>
      </TradingCardProvider>
    );
  },
);

TradingCardRoot.displayName = "TradingCardRoot";
