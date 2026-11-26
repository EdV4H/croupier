import type { Service } from "@zag-js/core";
import type {
  TradingCardMachineApi,
  TradingCardSchema,
} from "./trading-card.types";

export function connect(
  service: Service<TradingCardSchema>,
): TradingCardMachineApi {
  const { send, context, state, prop } = service;

  const currentState = state.get() as TradingCardSchema["state"];
  const flipped = context.get("flipped") as boolean;

  return {
    state: currentState,
    flipped,
    isHovering: currentState === "hovering",
    isDragging: currentState === "dragging",
    flippable: prop("flippable") !== false,

    toggleFlip() {
      send({ type: "FLIP.TOGGLE" });
    },
    setFlipped(next: boolean) {
      send({ type: "SET_FLIPPED", flipped: next });
    },

    pointerEnter() {
      send({ type: "POINTER_ENTER" });
    },
    pointerLeave() {
      send({ type: "POINTER_LEAVE" });
    },
    dragStart() {
      send({ type: "DRAG_START" });
    },
    dragEnd() {
      send({ type: "DRAG_END" });
    },
  };
}
