/**
 * Pure optics for `TradingCard`. No DOM, no React — every export is a plain
 * function over plain values, so the whole pointer-to-CSS-variable contract is
 * unit-testable without rendering anything.
 *
 * The caller (the React `Root`) is responsible for writing the results onto the
 * element with `style.setProperty`; nothing here touches a node.
 */

/** Pointer travel below this many px on release counts as a click, not a drag. */
export const CLICK_THRESHOLD_PX = 6;
/** Drag-accumulated X rotation is clamped to ±this, so the card never flips over. */
export const DRX_CLAMP_DEG = 70;
/** Horizontal pointer travel is multiplied by this to get Y rotation. */
export const DRAG_SCALE_X = 0.55;
/** Vertical pointer travel is multiplied by this to get X rotation. */
export const DRAG_SCALE_Y = 0.4;

/** Transition while the pointer is moving over the card — near-instant tracking. */
export const HOVER_MS = 90;
/** Transition when the pointer leaves — a slow ease back to rest. */
export const LEAVE_MS = 680;
/** Transition while dragging — none, the card must track the finger exactly. */
export const DRAG_MS = 0;
/** Transition when snapping back after a drag or a flip. */
export const SNAP_MS = 760;

export const DEFAULT_TILT_MAX = 14;
export const DEFAULT_HOVER_SCALE = 1.04;
export const DEFAULT_MOTION_SPEED = 1;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * Collapse `-0` to `0`. Signed zero falls out of the arithmetic whenever the
 * pointer sits exactly on an axis, and would otherwise be written as
 * `-0.00deg`, which reads like a bug in DevTools.
 */
const unsign = (v: number) => (v === 0 ? 0 : v);

export interface OpticsRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PointerVarsInput {
  /** Bounding box of the card root. */
  rect: OpticsRect;
  clientX: number;
  clientY: number;
  /** @default 14 */
  tiltMax?: number;
  /** @default 1.04 */
  hoverScale?: number;
  /** When true, everything collapses to the neutral resting state. */
  reducedMotion?: boolean;
  /** When false (touch), everything collapses to the neutral resting state. */
  hoverCapable?: boolean;
}

export interface PointerVarsResult {
  /** Pointer X within the card, 0–100. **Unitless** — see the note below. */
  px: number;
  /** Pointer Y within the card, 0–100. **Unitless**. */
  py: number;
  /** Tilt around X in degrees. */
  rx: number;
  /** Tilt around Y in degrees. */
  ry: number;
  /** Normalized distance from the center, 0–1. Zero at the center. */
  hyp: number;
  /** Hover scale factor. */
  sc: number;
  /** Center-relative X, -1–1. Used by the shadow. */
  nx: number;
  /** Center-relative Y, -1–1. Used by the shadow. */
  ny: number;
}

/**
 * Neutral resting values — what the card looks like with the pointer away.
 * Also what {@link pointerVars} returns under reduced motion or on touch.
 */
const REST: PointerVarsResult = {
  px: 50,
  py: 50,
  rx: 0,
  ry: 0,
  hyp: 0,
  sc: 1,
  nx: 0,
  ny: 0,
};

/**
 * Convert a pointer position into the card's CSS-variable values.
 *
 * `px` / `py` are deliberately **unitless numbers**: the layer CSS multiplies
 * them (`calc(var(--tc-px) * 1%)`). Writing them with a unit silently
 * invalidates that `calc()` and the layer disappears without an error.
 *
 * Under `reducedMotion` or on a device without hover, the full neutral state is
 * returned — killing `hyp` also switches the glare off, since its opacity
 * multiplies by it.
 */
export function pointerVars(input: PointerVarsInput): PointerVarsResult {
  const {
    rect,
    clientX,
    clientY,
    tiltMax = DEFAULT_TILT_MAX,
    hoverScale = DEFAULT_HOVER_SCALE,
    reducedMotion = false,
    hoverCapable = true,
  } = input;

  if (reducedMotion || !hoverCapable) return { ...REST };

  const width = rect.width || 1;
  const height = rect.height || 1;
  const px = clamp(((clientX - rect.left) / width) * 100, 0, 100);
  const py = clamp(((clientY - rect.top) / height) * 100, 0, 100);
  const nx = (px - 50) / 50;
  const ny = (py - 50) / 50;

  return {
    px: unsign(px),
    py: unsign(py),
    rx: unsign(-ny * tiltMax),
    ry: unsign(nx * tiltMax),
    hyp: Math.min(1, Math.hypot(nx, ny)),
    sc: hoverScale,
    nx: unsign(nx),
    ny: unsign(ny),
  };
}

/** The neutral pointer variables, ready to write on pointer leave. */
export function defaultVarStyle(): Record<string, string> {
  return {
    "--tc-px": "50",
    "--tc-py": "50",
    "--tc-rx": "0deg",
    "--tc-ry": "0deg",
    "--tc-hyp": "0",
    "--tc-sc": "1",
  };
}

export interface DragVarsInput {
  /** Pointer X travel since the drag started. */
  dx: number;
  /** Pointer Y travel since the drag started. */
  dy: number;
  /** Accumulated X rotation at drag start. */
  drx0: number;
  /** Accumulated Y rotation at drag start. */
  dry0: number;
}

/**
 * Accumulate free rotation from a drag. `drx` is clamped so the card cannot
 * tumble past its edge; `dry` is unbounded so it can spin continuously.
 */
export function dragVars({ dx, dy, drx0, dry0 }: DragVarsInput): {
  drx: number;
  dry: number;
} {
  return {
    drx: clamp(drx0 - dy * DRAG_SCALE_Y, -DRX_CLAMP_DEG, DRX_CLAMP_DEG),
    dry: dry0 + dx * DRAG_SCALE_X,
  };
}

/**
 * Snap free rotation to the nearest whole turn on release, so the card always
 * comes to rest showing a face square-on rather than edge-on.
 */
export function snapDry(dry: number): number {
  return unsign(Math.round(dry / 360) * 360);
}

export interface ShadowTransformResult {
  transform: string;
  opacity: string;
}

/**
 * Shadow offset and density for the current tilt. The shadow slides opposite
 * the tilt and darkens as the pointer approaches the card's edge.
 */
export function shadowTransform({
  nx,
  ny,
  hyp,
}: Pick<PointerVarsResult, "nx" | "ny" | "hyp">): ShadowTransformResult {
  return {
    transform: `translate3d(${(-nx * 26).toFixed(1)}px, ${(26 + ny * 18).toFixed(1)}px, 0) scale(0.95)`,
    opacity: (0.5 + hyp * 0.25).toFixed(3),
  };
}

export type TransitionPhase = "hover" | "leave" | "drag" | "snap";

/**
 * Transition duration in ms for a given interaction phase.
 *
 * `speed` is a **duration** multiplier, not a rate: `0.5` halves the duration.
 */
export function transitionMs(
  phase: TransitionPhase,
  speed: number = DEFAULT_MOTION_SPEED,
): number {
  const base =
    phase === "hover"
      ? HOVER_MS
      : phase === "leave"
        ? LEAVE_MS
        : phase === "drag"
          ? DRAG_MS
          : SNAP_MS;
  return Math.round(base * speed);
}

/**
 * Normalize consumer-supplied custom properties: add the leading `--` when it
 * is missing. Values are passed through verbatim and never interpreted — the
 * library does not know what any of these variables mean.
 */
export function normalizeVars(
  vars?: Record<string, string>,
): Record<string, string> {
  if (!vars) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    out[key.startsWith("--") ? key : `--${key}`] = value;
  }
  return out;
}
