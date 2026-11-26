import { describe, expect, it } from "vitest";
import {
  BEAM_DELAY_FRACTION,
  BEAM_SPAN_FRACTION,
  BURST_AT_FRACTION,
  BURST_MS,
  beamKeyframes,
  CASCADE_STEP_MS,
  DROP_MS,
  FLASH_MS,
  layerCascade,
  revealFadeKeyframes,
  revealKeyframes,
  SCAN_MS,
} from "../src/reveal/trading-card.reveal";

const MODES = ["drop", "burst", "scan"] as const;

describe("revealKeyframes", () => {
  it("never holds its final frame", () => {
    // The single most fragile invariant in the whole component. The resting
    // transform is built from CSS variables the pointer handlers keep writing;
    // a filled animation would pin the card and hover would stop working from
    // then on, with nothing in the console to say why.
    for (const mode of MODES) {
      expect(revealKeyframes(mode).options.fill).toBe("none");
    }
  });

  it("runs for the duration the spec gives each mode", () => {
    expect(revealKeyframes("drop").options.duration).toBe(DROP_MS);
    expect(revealKeyframes("burst").options.duration).toBe(BURST_MS);
    expect(revealKeyframes("scan").options.duration).toBe(SCAN_MS);
  });

  it("scales the duration by the shared speed multiplier", () => {
    expect(revealKeyframes("drop", 1, 0.5).options.duration).toBe(DROP_MS / 2);
    expect(revealKeyframes("burst", 1, 2).options.duration).toBe(BURST_MS * 2);
  });

  it("ends at rest whatever the mode did", () => {
    for (const mode of MODES) {
      const last = revealKeyframes(mode).keyframes.at(-1);
      expect(last?.offset).toBe(1);
      expect(last?.transform).toContain("scale(1)");
      expect(last?.transform).toContain("rotateY(0deg)");
    }
  });

  it("never animates opacity alongside the transform", () => {
    // An opacity below 1 renders the element as a group, which flattens
    // `preserve-3d`. On a card mid-flip that means the front stops being hidden
    // by `backface-visibility` and shows through mirrored exactly where the
    // back is supposed to be. The fade belongs on the root instead.
    for (const mode of MODES) {
      for (const frame of revealKeyframes(mode).keyframes) {
        expect(frame.opacity).toBeUndefined();
      }
    }
  });

  it("fades over the opening fifth, on its own animation", () => {
    const fade = revealFadeKeyframes("drop");
    expect(fade.keyframes[0]?.opacity).toBe("0");
    expect(fade.keyframes.at(-1)?.opacity).toBe("1");
    expect(fade.options.fill).toBe("none");
    expect(Number(fade.options.duration)).toBeLessThan(DROP_MS);
  });

  it("keeps offsets ordered from 0 to 1", () => {
    for (const mode of MODES) {
      const offsets = revealKeyframes(mode).keyframes.map((k) => k.offset);
      expect(offsets[0]).toBe(0);
      expect(offsets.at(-1)).toBe(1);
      for (let i = 1; i < offsets.length; i++) {
        expect(Number(offsets[i])).toBeGreaterThan(Number(offsets[i - 1]));
      }
    }
  });

  it("overshoots further as intensity rises", () => {
    const overshootAt = (intensity: number) => {
      const peak = revealKeyframes("burst", intensity).keyframes[2];
      return Number(
        String(peak?.transform).match(/scale\(([\d.]+)\)/)?.[1] ?? 0,
      );
    };
    expect(overshootAt(1)).toBeGreaterThan(overshootAt(0.3));
  });

  it("clamps intensity to 0–1 rather than trusting the caller", () => {
    const wild = revealKeyframes("burst", 99).keyframes[2];
    const sane = revealKeyframes("burst", 1).keyframes[2];
    expect(wild?.transform).toBe(sane?.transform);
  });

  it("turns the card over during a drop", () => {
    // It falls face-down and lands showing its front; without the mid-flight
    // rotateY(180deg) the whole point of the mode is lost.
    const { keyframes } = revealKeyframes("drop");
    expect(keyframes[0]?.transform).toContain("rotateY(180deg)");
    expect(keyframes.at(-1)?.transform).toContain("rotateY(0deg)");
  });
});

describe("revealKeyframes, face-down", () => {
  /** Every `rotateY` in a set of keyframes, in degrees. */
  const turns = (keyframes: Keyframe[]) =>
    keyframes.map((k) =>
      Number(String(k.transform).match(/rotateY\((-?[\d.]+)deg\)/)?.[1]),
    );

  it("never turns the front towards the viewer", () => {
    // The keyframes replace `--tc-flip` while they run, so a face-down card
    // played the face-up choreography showed its front on the way in and only
    // snapped to the back once the entrance released.
    for (const mode of MODES) {
      for (const angle of turns(revealKeyframes(mode, 1, 1, true).keyframes)) {
        const fromBack = Math.abs(((((angle - 180) % 360) + 540) % 360) - 180);
        expect(fromBack).toBeLessThan(90);
      }
    }
  });

  it("lands on the back", () => {
    for (const mode of MODES) {
      const last = revealKeyframes(mode, 1, 1, true).keyframes.at(-1);
      expect(last?.offset).toBe(1);
      expect(last?.transform).toContain("rotateY(180deg)");
      expect(last?.transform).toContain("scale(1)");
    }
  });

  it("keeps the face-up timing, so a mixed row still resolves together", () => {
    for (const mode of MODES) {
      expect(revealKeyframes(mode, 0.7, 1.5, true).options).toEqual(
        revealKeyframes(mode, 0.7, 1.5, false).options,
      );
    }
  });

  it("still never animates opacity", () => {
    for (const mode of MODES) {
      for (const frame of revealKeyframes(mode, 1, 1, true).keyframes) {
        expect(frame.opacity).toBeUndefined();
      }
    }
  });
});

describe("layerCascade", () => {
  it("staggers one flash per layer, bottom to top", () => {
    const steps = layerCascade(3);
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(steps[1]?.delayMs).toBe(CASCADE_STEP_MS);
    expect(steps[2]?.delayMs).toBe(CASCADE_STEP_MS * 2);
    expect(steps[0]?.durationMs).toBe(FLASH_MS);
  });

  it("offsets the whole cascade by the start delay", () => {
    const [first] = layerCascade(1, 1, 500);
    expect(first?.delayMs).toBe(500);
  });

  it("scales with the speed multiplier", () => {
    const steps = layerCascade(2, 0.5);
    expect(steps[1]?.delayMs).toBe(CASCADE_STEP_MS / 2);
    expect(steps[0]?.durationMs).toBe(FLASH_MS / 2);
  });

  it("copes with a card that has no layers at all", () => {
    expect(layerCascade(0)).toEqual([]);
    expect(layerCascade(-3)).toEqual([]);
  });
});

describe("beamKeyframes", () => {
  it("is timed off the entrance, not given a duration of its own", () => {
    // The beam has to be gone by the time the card settles however the speed is
    // tuned; deriving both numbers from the entrance is what guarantees that.
    const { options } = beamKeyframes(1600);
    expect(options.duration).toBe(Math.round(1600 * BEAM_SPAN_FRACTION));
    expect(options.delay).toBe(Math.round(1600 * BEAM_DELAY_FRACTION));
    expect(
      Number(options.delay) + Number(options.duration),
    ).toBeLessThanOrEqual(1600);
  });

  it("crosses the card and releases it", () => {
    const { keyframes, options } = beamKeyframes(1600);
    expect(keyframes[0]?.transform).toContain("translateX(-160%)");
    expect(keyframes.at(-1)?.transform).toContain("translateX(300%)");
    // Same rule as the entrance: nothing may hold its final frame, or the beam
    // stays parked over the card forever at opacity 0.
    expect(options.fill).toBe("none");
  });

  it("fades at both ends so the sweep has no hard edge", () => {
    const { keyframes } = beamKeyframes(1600);
    expect(keyframes[0]?.opacity).toBe("0");
    expect(keyframes.at(-1)?.opacity).toBe("0");
    expect(keyframes.some((f) => f.opacity === "1")).toBe(true);
  });
});

describe("BURST_AT_FRACTION", () => {
  it("fires while the card is still moving", () => {
    // Light that arrives after the movement is over reads as a second,
    // unrelated event rather than the impact of the first.
    expect(BURST_AT_FRACTION).toBeGreaterThan(0);
    expect(BURST_AT_FRACTION).toBeLessThan(0.5);
  });
});
