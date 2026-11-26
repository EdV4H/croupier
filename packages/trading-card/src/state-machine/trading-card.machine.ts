import { createMachine } from "@zag-js/core";
import type { TradingCardSchema } from "./trading-card.types";

/**
 * Only the discrete half of `TradingCard` lives here. Pointer position, tilt,
 * glare and drag angle are written straight to CSS variables by the React root
 * and never reach this machine — a pointer move must not cause a transition.
 */
export const machine = createMachine<TradingCardSchema>({
  initialState() {
    return "idle";
  },

  context({ bindable, prop }) {
    return {
      flipped: bindable<boolean>(() => ({
        defaultValue: prop("flipped") ?? prop("defaultFlipped") ?? false,
      })),
    };
  },

  props({ props }) {
    return {
      flippable: true,
      defaultFlipped: false,
      ...props,
    };
  },

  watch({ track, action, prop }) {
    track([() => prop("flipped")], () => {
      action(["syncFlipped"]);
    });
  },

  // FLIP.TOGGLE / SET_FLIPPED are accepted in every state: a click can land
  // while hovering, while dragging (below the click threshold), or from the
  // flip trigger with the pointer nowhere near the card.
  on: {
    "FLIP.TOGGLE": [
      { guard: "isFlipControlled", actions: ["invokeOnFlipToggle"] },
      { guard: "isFlippable", actions: ["toggleFlipped"] },
    ],
    SET_FLIPPED: [
      // A `SET_FLIPPED` with nothing to set is not an instruction to show the
      // front. `Boolean(undefined)` used to make it one, quietly flipping the
      // card and firing `onFlipChange` for a face nobody asked for.
      { guard: "hasNoFlippedPayload", actions: [] },
      { guard: "isFlipControlled", actions: ["invokeOnFlipSet"] },
      { guard: "isFlippable", actions: ["setFlipped"] },
    ],
    // The consumer's own value coming back in. Written, never reported —
    // echoing it would tell them what they just told us.
    "CONTROLLED.FLIP": {
      actions: ["applyFlipped"],
    },
  },

  states: {
    idle: {
      on: {
        POINTER_ENTER: { target: "hovering" },
        DRAG_START: { target: "dragging" },
      },
    },
    hovering: {
      on: {
        POINTER_LEAVE: { target: "idle" },
        DRAG_START: { target: "dragging" },
      },
    },
    dragging: {
      on: {
        // Resolve to `hovering` rather than `idle`: releasing the pointer over
        // the card leaves it hovered, and a real leave will follow if it isn't.
        DRAG_END: { target: "hovering" },
        POINTER_LEAVE: { target: "idle" },
      },
    },
  },

  implementations: {
    guards: {
      isFlipControlled: ({ prop }) => prop("flipped") !== undefined,
      isFlippable: ({ prop }) => prop("flippable") !== false,
      hasNoFlippedPayload: ({ event }) => typeof event.flipped !== "boolean",
    },
    actions: {
      /**
       * Uncontrolled writes report the value they wrote, rather than reading it
       * back out of context.
       *
       * A `context.set` is not visible to the actions that run after it in the
       * same transition — the snapshot they see is the one from before. Setting
       * and then reporting as two actions therefore announced the *previous*
       * face on every flip: a card turning to its back told the consumer
       * `{ flipped: false }`.
       */
      toggleFlipped: ({ context, prop }) => {
        const next = !context.get("flipped");
        context.set("flipped", next);
        prop("onFlipChange")?.({ flipped: next });
      },
      setFlipped: ({ context, prop, event }) => {
        // Guaranteed a boolean by `hasNoFlippedPayload`.
        const next = event.flipped as boolean;
        context.set("flipped", next);
        prop("onFlipChange")?.({ flipped: next });
      },
      /** Controlled sync. Writes only — see `CONTROLLED.FLIP`. */
      applyFlipped: ({ context, event }) => {
        context.set("flipped", Boolean(event.flipped));
      },
      // Controlled: context is not written, so report the value the consumer
      // would have to set for the toggle to take effect.
      invokeOnFlipToggle: ({ prop, context }) => {
        if (prop("flippable") === false) return;
        prop("onFlipChange")?.({ flipped: !context.get("flipped") });
      },
      invokeOnFlipSet: ({ prop, event }) => {
        if (prop("flippable") === false) return;
        prop("onFlipChange")?.({ flipped: event.flipped as boolean });
      },
      syncFlipped: ({ prop, context, send }) => {
        const flipped = prop("flipped");
        if (flipped !== undefined && flipped !== context.get("flipped")) {
          send({ type: "CONTROLLED.FLIP", flipped });
        }
      },
    },
  },
});
