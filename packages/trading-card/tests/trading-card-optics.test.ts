import { describe, expect, it } from "vitest";
import {
  CLICK_THRESHOLD_PX,
  DRX_CLAMP_DEG,
  defaultVarStyle,
  dragVars,
  normalizeVars,
  pointerVars,
  shadowTransform,
  snapDry,
  transitionMs,
} from "../src/state-machine/trading-card.optics";

/** 200 x 300 card whose top-left corner sits at (100, 50). */
const RECT = { left: 100, top: 50, width: 200, height: 300 };

const CENTER = { clientX: 200, clientY: 200 };
const TOP_LEFT = { clientX: 100, clientY: 50 };
const TOP_RIGHT = { clientX: 300, clientY: 50 };
const BOTTOM_LEFT = { clientX: 100, clientY: 350 };
const BOTTOM_RIGHT = { clientX: 300, clientY: 350 };

const at = (point: { clientX: number; clientY: number }, extra = {}) =>
  pointerVars({ rect: RECT, ...point, ...extra });

describe("pointerVars", () => {
  it("reports the pointer position as unitless 0–100 numbers", () => {
    const v = at(CENTER);
    expect(v.px).toBe(50);
    expect(v.py).toBe(50);
    // Unitless is load-bearing: the layer CSS multiplies these inside a
    // calc(), and a unit here would invalidate it and blank the layer.
    expect(typeof v.px).toBe("number");
  });

  it("clamps the position when the pointer runs past the edge", () => {
    const past = pointerVars({ rect: RECT, clientX: -500, clientY: 9999 });
    expect(past.px).toBe(0);
    expect(past.py).toBe(100);
  });

  it("tilts the correct way at every corner", () => {
    // rx = -ny * tiltMax, ry = nx * tiltMax. The easiest thing in the whole
    // component to get backwards, and the hardest to spot in review.
    const tiltMax = 14;

    const tl = at(TOP_LEFT, { tiltMax });
    expect(tl.rx).toBeCloseTo(14); // pointer at the top -> top edge leans back
    expect(tl.ry).toBeCloseTo(-14); // pointer at the left -> left edge leans back

    const tr = at(TOP_RIGHT, { tiltMax });
    expect(tr.rx).toBeCloseTo(14);
    expect(tr.ry).toBeCloseTo(14);

    const bl = at(BOTTOM_LEFT, { tiltMax });
    expect(bl.rx).toBeCloseTo(-14);
    expect(bl.ry).toBeCloseTo(-14);

    const br = at(BOTTOM_RIGHT, { tiltMax });
    expect(br.rx).toBeCloseTo(-14);
    expect(br.ry).toBeCloseTo(14);
  });

  it("disables tilt entirely at tiltMax 0", () => {
    const v = at(TOP_LEFT, { tiltMax: 0 });
    expect(v.rx).toBe(0);
    expect(v.ry).toBe(0);
  });

  it("keeps hyp within 0–1, zero at the center and one at the corners", () => {
    expect(at(CENTER).hyp).toBe(0);
    expect(at(TOP_LEFT).hyp).toBe(1);
    expect(at(BOTTOM_RIGHT).hyp).toBe(1);
  });

  it("increases hyp monotonically as the pointer leaves the center", () => {
    // Sampled straight out to the left edge, where hypot stays inside the
    // clamp — a diagonal saturates at 1 well before the corner.
    const samples = [0, 0.25, 0.5, 0.75, 1].map(
      (t) => at({ clientX: 200 - 100 * t, clientY: 200 }).hyp,
    );
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1] as number);
    }
    expect(samples.at(-1)).toBe(1);
  });

  it("collapses to the resting state under reduced motion", () => {
    // Killing hyp also switches the glare off, since its opacity multiplies
    // by it — one flag disables the whole pointer-driven treatment.
    const v = at(TOP_LEFT, { reducedMotion: true });
    expect(v).toEqual({
      px: 50,
      py: 50,
      rx: 0,
      ry: 0,
      hyp: 0,
      sc: 1,
      nx: 0,
      ny: 0,
    });
  });

  it("collapses to the resting state on a device without hover", () => {
    // The @media (hover: hover) requirement, expressed as an invariant a test
    // can actually check rather than a CSS branch nobody exercises.
    expect(at(BOTTOM_RIGHT, { hoverCapable: false })).toEqual(
      at(BOTTOM_RIGHT, { reducedMotion: true }),
    );
  });

  it("applies hoverScale only while the treatment is active", () => {
    expect(at(CENTER, { hoverScale: 1.08 }).sc).toBe(1.08);
    expect(at(CENTER, { hoverScale: 1.08, reducedMotion: true }).sc).toBe(1);
  });
});

describe("defaultVarStyle", () => {
  it("matches the resting values pointerVars produces", () => {
    const rest = at(TOP_LEFT, { reducedMotion: true });
    expect(defaultVarStyle()).toEqual({
      "--tc-px": String(rest.px),
      "--tc-py": String(rest.py),
      "--tc-rx": "0deg",
      "--tc-ry": "0deg",
      "--tc-hyp": "0",
      "--tc-sc": "1",
    });
  });

  it("leaves drag and flip alone — those are not pointer state", () => {
    const keys = Object.keys(defaultVarStyle());
    expect(keys).not.toContain("--tc-drx");
    expect(keys).not.toContain("--tc-dry");
    expect(keys).not.toContain("--tc-flip");
  });
});

describe("dragVars", () => {
  it("accumulates from the rotation held at drag start", () => {
    const { drx, dry } = dragVars({ dx: 100, dy: -50, drx0: 10, dry0: 20 });
    expect(dry).toBeCloseTo(20 + 100 * 0.55);
    expect(drx).toBeCloseTo(10 + 50 * 0.4);
  });

  it("clamps drx on both sides so the card never tumbles past its edge", () => {
    expect(dragVars({ dx: 0, dy: -10000, drx0: 0, dry0: 0 }).drx).toBe(
      DRX_CLAMP_DEG,
    );
    expect(dragVars({ dx: 0, dy: 10000, drx0: 0, dry0: 0 }).drx).toBe(
      -DRX_CLAMP_DEG,
    );
  });

  it("leaves dry unbounded so the card can spin continuously", () => {
    const { dry } = dragVars({ dx: 10000, dy: 0, drx0: 0, dry0: 0 });
    expect(dry).toBeGreaterThan(360 * 3);
  });
});

describe("snapDry", () => {
  it("settles on the nearest whole turn", () => {
    expect(snapDry(0)).toBe(0);
    expect(snapDry(170)).toBe(0);
    expect(snapDry(190)).toBe(360);
    expect(snapDry(-190)).toBe(-360);
    expect(snapDry(900)).toBe(1080);
  });

  it("always lands on a multiple of 360, so a face is square-on", () => {
    for (const angle of [37, -412, 1234, -5, 719]) {
      // `%` yields -0 for negative multiples, so compare the magnitude.
      expect(Math.abs(snapDry(angle) % 360)).toBe(0);
    }
  });
});

describe("shadowTransform", () => {
  it("slides the shadow opposite the tilt", () => {
    const right = shadowTransform({ nx: 1, ny: 0, hyp: 1 });
    expect(right.transform).toContain("-26.0px");
    const left = shadowTransform({ nx: -1, ny: 0, hyp: 1 });
    expect(left.transform).toContain("26.0px");
  });

  it("darkens as the pointer approaches the edge", () => {
    expect(Number(shadowTransform({ nx: 0, ny: 0, hyp: 0 }).opacity)).toBe(0.5);
    expect(Number(shadowTransform({ nx: 0, ny: 0, hyp: 1 }).opacity)).toBe(
      0.75,
    );
  });
});

describe("transitionMs", () => {
  it("scales every phase by the duration multiplier", () => {
    expect(transitionMs("hover")).toBe(90);
    expect(transitionMs("leave")).toBe(680);
    expect(transitionMs("snap")).toBe(760);
    expect(transitionMs("leave", 0.5)).toBe(340);
    expect(transitionMs("hover", 2)).toBe(180);
  });

  it("keeps dragging instantaneous at any speed", () => {
    // The card has to track the finger exactly; a transition here reads as lag.
    expect(transitionMs("drag")).toBe(0);
    expect(transitionMs("drag", 2)).toBe(0);
  });
});

describe("normalizeVars", () => {
  it("adds the leading dashes when they are missing", () => {
    expect(normalizeVars({ "--tc-accent": "red", "tc-l-holo": "0.7" })).toEqual(
      {
        "--tc-accent": "red",
        "--tc-l-holo": "0.7",
      },
    );
  });

  it("passes values through without interpreting them", () => {
    // The library does not know what any of these variables mean; that is the
    // whole point of the vars escape hatch.
    const weird = { "--anything": "repeating-linear-gradient(112deg, red 0%)" };
    expect(normalizeVars(weird)).toEqual(weird);
  });

  it("returns an empty object when nothing is supplied", () => {
    expect(normalizeVars()).toEqual({});
    expect(normalizeVars({})).toEqual({});
  });
});

describe("interaction constants", () => {
  it("keeps the click threshold small enough that a tap is not a drag", () => {
    expect(CLICK_THRESHOLD_PX).toBe(6);
  });
});
