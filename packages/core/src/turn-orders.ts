import type { CroupierContext, GameState, PlayerId, TurnOrder } from "./types.js";

/**
 * Round-robin: cycles through players in order.
 * `first()` returns players[0], `next()` returns the next player in the list.
 * Returns null when all players have acted once (one full cycle).
 */
export const ROUND_ROBIN: TurnOrder = {
  first(ctx: CroupierContext): PlayerId {
    return ctx.players[0];
  },
  next(ctx: CroupierContext): PlayerId | null {
    if (!ctx.lastPlayer) return ctx.players[0];
    const idx = ctx.players.indexOf(ctx.lastPlayer);
    const nextIdx = idx + 1;
    if (nextIdx >= ctx.players.length) {
      return null; // cycle complete
    }
    return ctx.players[nextIdx];
  },
};

/**
 * Alternating: two players take turns, each getting a full turn before switching.
 * `first()` returns players[0], `next()` swaps between the two.
 * Returns null after the current player acts (signaling end of their turn).
 */
export const ALTERNATING: TurnOrder = {
  first(ctx: CroupierContext): PlayerId {
    return ctx.players[0];
  },
  next(_ctx: CroupierContext): PlayerId | null {
    // In alternating mode, a single action ends the turn
    // The phase machine will swap the active player on re-entry
    return null;
  },
};

/**
 * Simultaneous: all players act at the same time (barrier sync).
 * `first()` returns all players, `next()` returns null (no turn progression).
 */
export const SIMULTANEOUS: TurnOrder = {
  first(ctx: CroupierContext): PlayerId[] {
    return [...ctx.players];
  },
  next(ctx: CroupierContext): PlayerId[] | null {
    // In simultaneous mode, all players can act.
    // The phase will transition when a condition is met (e.g. all voted).
    return [...ctx.players];
  },
};

/**
 * Create a custom turn order with first/next functions.
 */
export function custom<S extends GameState = GameState>(
  order: TurnOrder<S>,
): TurnOrder<S> {
  return order;
}
