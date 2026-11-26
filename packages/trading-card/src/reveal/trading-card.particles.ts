/**
 * The burst that goes off around a card as it lands: a flash, two expanding
 * rings, and a spray of particles.
 *
 * All of it is built imperatively and thrown away when it finishes. None of it
 * is React's business — these are dozens of short-lived nodes that exist for
 * under a second, and putting them through the reconciler would mean a render
 * per frame of an animation React is not driving anyway.
 *
 * The one rule: every node this creates has to come back out. A card unmounted
 * mid-burst, or a StrictMode double-effect, must not leave particles behind.
 * Hence {@link BurstHandle.dispose}, which the caller is obliged to run.
 */

/** Deterministic scatter, so a burst looks the same in a test as in a browser. */
export type BurstRandom = () => number;

export interface BurstOptions {
  /** Where the burst is mounted. Positioned relative by the caller. */
  stage: HTMLElement;
  /** 0–1. Scales particle count, ring reach and glow. */
  intensity: number;
  /** Duration multiplier, shared with the rest of the card's motion. */
  speed: number;
  /** Colour for the accent particles and the leading ring. */
  accent: string;
  /** Injectable for tests. Defaults to `Math.random`. */
  random?: BurstRandom;
}

export interface BurstHandle {
  /** Every animation started, so the caller can cancel them as one. */
  animations: Animation[];
  /**
   * Removes every node created. Safe to call more than once, and safe to skip
   * on the happy path — a burst that runs to completion clears up after itself.
   *
   * Call it to cut a burst short, and always **after** cancelling
   * {@link BurstHandle.animations}: disposing on its own would detach the nodes
   * and leave their animations running on a tree nobody can see.
   */
  dispose: () => void;
}

const MIN_PARTICLES = 12;
const MAX_EXTRA_PARTICLES = 34;
const FLASH_MS = 620;
const GLOW_MS = 1100;
const RING_MS = 820;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Particle count for a given intensity. Pure, so the scaling is testable. */
export function particleCount(intensity: number): number {
  return Math.round(MIN_PARTICLES + MAX_EXTRA_PARTICLES * clamp01(intensity));
}

const absoluteFill = (el: HTMLElement) => {
  el.style.position = "absolute";
  el.style.inset = "0";
  el.style.pointerEvents = "none";
};

/**
 * Fire the burst. Returns immediately; the caller decides when to dispose.
 *
 * Nothing here reads or writes the card's CSS variables, so a burst can run
 * over a card that is still being tilted by the pointer.
 */
export function playBurst({
  stage,
  intensity,
  speed,
  accent,
  random = Math.random,
}: BurstOptions): BurstHandle {
  const i = clamp01(intensity);
  const created: HTMLElement[] = [];
  const animations: Animation[] = [];

  const disposeNodes = () => {
    for (const el of created) el.remove();
    created.length = 0;
  };

  /**
   * The burst outlives the card's own movement, so it takes itself away rather
   * than being cut short by whoever started it: the last animation to settle
   * removes what is left.
   *
   * Cancelling counts as settling, which is what makes the caller's
   * cancel-then-dispose path idempotent — by the time `dispose()` runs the
   * nodes are usually already gone.
   */
  let live = 0;
  const settle = () => {
    live -= 1;
    if (live <= 0) disposeNodes();
  };

  /**
   * Assigning the handlers rather than adding listeners: a burst is disposable
   * from the outside at any moment, and `Animation` objects handed back by a
   * test double are not required to be event targets.
   */
  const track = (animation: Animation) => {
    live += 1;
    const own = animation.onfinish;
    animation.onfinish = function (this: Animation, event) {
      own?.call(this, event);
      settle();
    };
    animation.oncancel = settle;
    animations.push(animation);
    return animation;
  };

  const add = (el: HTMLElement) => {
    created.push(el);
    stage.appendChild(el);
    return el;
  };

  // A single white flash, brightest at the moment of impact.
  const flash = add(document.createElement("div"));
  absoluteFill(flash);
  flash.style.background =
    "radial-gradient(circle at 50% 50%, rgba(255,255,255,.9), transparent 55%)";
  flash.style.mixBlendMode = "screen";
  flash.style.opacity = "0";
  track(
    flash.animate(
      [
        { opacity: "0" },
        { opacity: String(0.55 * i), offset: 0.12 },
        { opacity: "0" },
      ],
      {
        duration: Math.round(FLASH_MS * speed),
        easing: "ease-out",
        fill: "none",
      },
    ),
  );

  // A wash of accent light behind the card.
  const glow = add(document.createElement("div"));
  absoluteFill(glow);
  glow.style.background = `radial-gradient(circle, ${accent} 0%, transparent 62%)`;
  glow.style.mixBlendMode = "screen";
  glow.style.filter = "blur(6px)";
  glow.style.opacity = "0";
  track(
    glow.animate(
      [
        { opacity: "0", transform: "scale(0.5)" },
        { opacity: String(0.5 * i), offset: 0.18 },
        { opacity: "0", transform: "scale(1.25)" },
      ],
      {
        duration: Math.round(GLOW_MS * speed),
        easing: "ease-out",
        fill: "none",
      },
    ),
  );

  // Two shockwave rings, the second trailing the first.
  for (const [index, colour] of [accent, "rgba(255,255,255,.85)"].entries()) {
    const ring = add(document.createElement("div"));
    ring.style.position = "absolute";
    ring.style.inset = "0";
    ring.style.margin = "auto";
    ring.style.width = "72%";
    ring.style.height = "94%";
    ring.style.borderRadius = "26px";
    ring.style.border = `${index === 0 ? 2 : 1}px solid ${colour}`;
    ring.style.pointerEvents = "none";
    ring.style.opacity = "0";
    track(
      ring.animate(
        [
          { opacity: "0.9", transform: "scale(0.82)" },
          {
            opacity: "0",
            transform: `scale(${(1.7 + index * 0.5) * (0.6 + 0.4 * i)})`,
          },
        ],
        {
          duration: Math.round((RING_MS + index * 260) * speed),
          delay: Math.round(index * 90 * speed),
          easing: "cubic-bezier(0.15, 0.75, 0.3, 1)",
          fill: "none",
        },
      ),
    );
  }

  // The spray. Each particle removes itself the moment it is done, so a long
  // burst does not hold every node until the end.
  const field = add(document.createElement("div"));
  absoluteFill(field);
  for (let n = 0; n < particleCount(i); n++) {
    const dot = document.createElement("div");
    const size = 2 + random() * 3;
    dot.style.position = "absolute";
    dot.style.left = "50%";
    dot.style.top = "50%";
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.borderRadius = "50%";
    dot.style.background = n % 3 === 0 ? accent : "#fff";
    dot.style.mixBlendMode = "screen";
    field.appendChild(dot);

    const angle = random() * Math.PI * 2;
    const distance = (110 + random() * 300) * (0.6 + 0.4 * i);
    const animation = dot.animate(
      [
        { transform: "translate(-50%, -50%) scale(1)", opacity: "1" },
        {
          transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(0)`,
          opacity: "0",
        },
      ],
      {
        duration: Math.round((700 + random() * 700) * speed),
        easing: "cubic-bezier(0.1, 0.7, 0.3, 1)",
        fill: "none",
      },
    );
    animation.onfinish = () => dot.remove();
    track(animation);
  }

  return { animations, dispose: disposeNodes };
}
