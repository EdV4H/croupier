import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  particleCount,
  playBurst,
} from "../src/reveal/trading-card.particles";

/**
 * The burst creates dozens of nodes outside React's knowledge. The contract
 * that matters is that every one of them comes back out — a card unmounted
 * mid-entrance, or a StrictMode double-effect, must not leave particles on a
 * detached tree. These tests hold that contract, plus the intensity scaling
 * that the docs promise.
 */

/**
 * jsdom has no Web Animations API. A stub is enough here: nothing under test
 * reads back a computed value, it only needs `animate` to hand back something
 * with the `onfinish` hook and `cancel`.
 */
const installAnimateStub = () => {
  const finishers: Array<() => void> = [];
  Element.prototype.animate = function animate(this: Element) {
    const animation = {
      cancel: vi.fn(),
      set onfinish(fn: (() => void) | null) {
        if (fn) finishers.push(fn);
      },
      get onfinish() {
        return null;
      },
    };
    return animation as unknown as Animation;
  } as typeof Element.prototype.animate;
  return {
    finishAll: () => {
      for (const finish of finishers) finish();
    },
  };
};

const makeStage = () => {
  const stage = document.createElement("div");
  document.body.appendChild(stage);
  return stage;
};

/** Deterministic scatter, so the same burst is reproducible across runs. */
const fixedRandom = () => 0.5;

describe("particleCount", () => {
  it("scales monotonically with intensity", () => {
    const counts = [0, 0.25, 0.5, 0.75, 1].map(particleCount);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThan(counts[i - 1] as number);
    }
  });

  it("clamps out-of-range intensity to the ends of the scale", () => {
    expect(particleCount(-3)).toBe(particleCount(0));
    expect(particleCount(9)).toBe(particleCount(1));
  });

  it("still emits particles at zero intensity", () => {
    // A common card gets a smaller burst, not no burst — the entrance would
    // otherwise look broken rather than restrained.
    expect(particleCount(0)).toBeGreaterThan(0);
  });
});

describe("playBurst", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("mounts everything under the stage it was given", () => {
    installAnimateStub();
    const stage = makeStage();

    playBurst({
      stage,
      intensity: 1,
      speed: 1,
      accent: "red",
      random: fixedRandom,
    });

    expect(stage.childElementCount).toBeGreaterThan(0);
    // Nothing escapes into the card or the document.
    expect(document.body.children).toHaveLength(1);
  });

  it("removes every node it created on dispose", () => {
    installAnimateStub();
    const stage = makeStage();

    const burst = playBurst({
      stage,
      intensity: 1,
      speed: 1,
      accent: "red",
      random: fixedRandom,
    });
    expect(stage.querySelectorAll("*").length).toBeGreaterThan(0);

    burst.dispose();

    expect(stage.querySelectorAll("*")).toHaveLength(0);
  });

  it("is safe to dispose more than once", () => {
    // The reveal hook disposes on both `onfinish` and unmount, and StrictMode
    // can run the second path twice. A double dispose must be a no-op.
    installAnimateStub();
    const stage = makeStage();

    const burst = playBurst({
      stage,
      intensity: 0.5,
      speed: 1,
      accent: "red",
      random: fixedRandom,
    });
    burst.dispose();
    expect(() => burst.dispose()).not.toThrow();
    expect(stage.querySelectorAll("*")).toHaveLength(0);
  });

  it("hands back every animation it started so the caller can cancel as one", () => {
    installAnimateStub();
    const stage = makeStage();

    const burst = playBurst({
      stage,
      intensity: 1,
      speed: 1,
      accent: "red",
      random: fixedRandom,
    });

    // flash + glow + two rings + the particles.
    expect(burst.animations).toHaveLength(4 + particleCount(1));
    for (const animation of burst.animations) {
      expect(typeof animation.cancel).toBe("function");
    }
  });

  it("lets each particle drop out as it finishes, before the burst is disposed", () => {
    // A long burst should not hold every node until the very end.
    const { finishAll } = installAnimateStub();
    const stage = makeStage();

    const burst = playBurst({
      stage,
      intensity: 1,
      speed: 1,
      accent: "red",
      random: fixedRandom,
    });
    const before = stage.querySelectorAll("*").length;

    finishAll();

    expect(stage.querySelectorAll("*").length).toBeLessThan(before);
    // …and the wrappers still go on dispose.
    burst.dispose();
    expect(stage.querySelectorAll("*")).toHaveLength(0);
  });

  it("scales duration by the shared speed multiplier", () => {
    const durations: number[] = [];
    Element.prototype.animate = function animate(
      this: Element,
      _keyframes: unknown,
      options: number | KeyframeAnimationOptions | undefined,
    ) {
      if (typeof options === "object" && options?.duration !== undefined) {
        durations.push(Number(options.duration));
      }
      return { cancel: vi.fn(), onfinish: null } as unknown as Animation;
    } as typeof Element.prototype.animate;

    const stage = makeStage();
    playBurst({
      stage,
      intensity: 0,
      speed: 1,
      accent: "red",
      random: fixedRandom,
    });
    const atNormalSpeed = [...durations];

    durations.length = 0;
    playBurst({
      stage,
      intensity: 0,
      speed: 2,
      accent: "red",
      random: fixedRandom,
    });

    expect(durations).toHaveLength(atNormalSpeed.length);
    for (const [i, d] of durations.entries()) {
      expect(d).toBe((atNormalSpeed[i] as number) * 2);
    }
  });
});
