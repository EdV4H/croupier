import type { CommonProperties, DirectionProperty } from "@zag-js/types";

export interface TradingCardFlipChangeDetails {
  flipped: boolean;
}

export interface TradingCardProps extends DirectionProperty, CommonProperties {
  /** Whether the card shows its back face (controlled). */
  flipped?: boolean;
  /**
   * Whether the card starts flipped (uncontrolled).
   * @default false
   */
  defaultFlipped?: boolean;
  /** Called whenever the face changes, from a click or the flip trigger. */
  onFlipChange?: (details: TradingCardFlipChangeDetails) => void;
  /**
   * Whether the card can be flipped at all.
   * @default true
   */
  flippable?: boolean;
}

export interface TradingCardSchema {
  props: Partial<TradingCardProps>;
  /**
   * Discrete interaction state. Deliberately coarse: everything continuous
   * (tilt, glare, drag angle) lives in CSS variables written straight to the
   * DOM, never in React or the machine.
   */
  state: "idle" | "hovering" | "dragging";
  context: {
    flipped: boolean;
  };
  guard: "isFlipControlled" | "isFlippable" | "hasNoFlippedPayload";
  action: string;
  effect: never;
}

/** Discrete API backed directly by the state machine. */
export interface TradingCardMachineApi {
  /** Current machine state. */
  state: TradingCardSchema["state"];
  /** Whether the back face is showing. */
  flipped: boolean;
  /** Whether the pointer is currently over the card. */
  isHovering: boolean;
  /** Whether a drag is in progress. */
  isDragging: boolean;
  /** Whether flipping is enabled. */
  flippable: boolean;

  /** Toggle between the front and back face. */
  toggleFlip(): void;
  /** Show a specific face. */
  setFlipped(flipped: boolean): void;

  pointerEnter(): void;
  pointerLeave(): void;
  dragStart(): void;
  dragEnd(): void;
}

/**
 * Full context API consumed by the parts — the machine API plus the two
 * environment queries the React layer owns.
 */
export interface TradingCardApi extends TradingCardMachineApi {
  /** Whether the user asked for reduced motion. Tilt and reveal are off. */
  reducedMotion: boolean;
  /** Whether the device has a real hover-capable pointer. Tilt is off if not. */
  hoverCapable: boolean;
}
