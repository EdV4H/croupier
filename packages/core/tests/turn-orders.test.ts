import { describe, expect, it } from "vitest";
import {
  ALTERNATING,
  ROUND_ROBIN,
  SIMULTANEOUS,
  custom,
} from "../src/turn-orders.js";
import type { CroupierContext } from "../src/types.js";

function makeCtx(
  overrides: Partial<CroupierContext> = {},
): CroupierContext {
  return {
    game: {},
    players: ["P1", "P2", "P3"],
    currentPlayers: [],
    lastPlayer: null,
    actionCount: 0,
    result: null,
    log: [],
    ...overrides,
  };
}

describe("ROUND_ROBIN", () => {
  it("first() returns players[0]", () => {
    expect(ROUND_ROBIN.first(makeCtx())).toBe("P1");
  });

  it("next() cycles through players", () => {
    expect(ROUND_ROBIN.next(makeCtx({ lastPlayer: "P1" }))).toBe("P2");
    expect(ROUND_ROBIN.next(makeCtx({ lastPlayer: "P2" }))).toBe("P3");
  });

  it("next() returns null after last player", () => {
    expect(ROUND_ROBIN.next(makeCtx({ lastPlayer: "P3" }))).toBeNull();
  });

  it("next() returns first player when no lastPlayer", () => {
    expect(ROUND_ROBIN.next(makeCtx())).toBe("P1");
  });
});

describe("ALTERNATING", () => {
  it("first() returns players[0]", () => {
    expect(ALTERNATING.first(makeCtx())).toBe("P1");
  });

  it("next() always returns null (single action per turn)", () => {
    expect(ALTERNATING.next(makeCtx({ lastPlayer: "P1" }))).toBeNull();
  });
});

describe("SIMULTANEOUS", () => {
  it("first() returns all players", () => {
    expect(SIMULTANEOUS.first(makeCtx())).toEqual(["P1", "P2", "P3"]);
  });

  it("next() returns all players (barrier sync)", () => {
    expect(SIMULTANEOUS.next(makeCtx({ lastPlayer: "P1" }))).toEqual([
      "P1",
      "P2",
      "P3",
    ]);
  });
});

describe("custom()", () => {
  it("creates a turn order from first/next functions", () => {
    const myOrder = custom({
      first: (ctx) => ctx.players[ctx.players.length - 1],
      next: () => null,
    });
    expect(myOrder.first(makeCtx())).toBe("P3");
    expect(myOrder.next(makeCtx())).toBeNull();
  });
});
