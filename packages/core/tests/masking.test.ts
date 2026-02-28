import { describe, expect, it } from "vitest";
import { CroupierCore } from "../src/croupier-core.js";
import { ROUND_ROBIN } from "../src/turn-orders.js";
import { countOnly, maskArray } from "../src/util/clone.js";
import type { CroupierConfig, GameState } from "../src/types.js";

interface CardState extends GameState {
  deck: string[];
  players: Record<string, { hand: string[] }>;
}

function cardConfig(): CroupierConfig<CardState> {
  return {
    name: "card-game",
    setup: (ctx) => {
      const players: Record<string, { hand: string[] }> = {};
      for (const p of ctx.players) {
        players[p] = { hand: [`${p}_card1`, `${p}_card2`] };
      }
      return {
        deck: ["A", "B", "C", "D", "E"],
        players,
      };
    },
    actions: {
      play: { execute: () => {} },
    },
    phases: {
      main: {
        allowedActions: ["play"],
        turnOrder: ROUND_ROBIN,
      },
    },
    view: {
      playerView: (state, playerId) => {
        const view: any = {
          deckCount: countOnly(state.deck),
          players: {},
        };
        for (const [pid, pState] of Object.entries(state.players)) {
          if (pid === playerId) {
            view.players[pid] = { hand: pState.hand };
          } else {
            view.players[pid] = {
              hand: maskArray(pState.hand, { hidden: true }),
            };
          }
        }
        return view;
      },
    },
  };
}

describe("State Masking", () => {
  it("getPlayerView shows own hand", () => {
    const engine = new CroupierCore(cardConfig(), ["P1", "P2"]);
    const view = engine.getPlayerView("P1") as any;
    expect(view.players.P1.hand).toEqual(["P1_card1", "P1_card2"]);
  });

  it("getPlayerView hides opponent hand", () => {
    const engine = new CroupierCore(cardConfig(), ["P1", "P2"]);
    const view = engine.getPlayerView("P1") as any;
    expect(view.players.P2.hand).toEqual([
      { hidden: true },
      { hidden: true },
    ]);
  });

  it("getPlayerView replaces deck with count", () => {
    const engine = new CroupierCore(cardConfig(), ["P1", "P2"]);
    const view = engine.getPlayerView("P1") as any;
    expect(view.deckCount).toBe(5);
    expect(view.deck).toBeUndefined();
  });

  it("different players get different views", () => {
    const engine = new CroupierCore(cardConfig(), ["P1", "P2"]);
    const viewP1 = engine.getPlayerView("P1") as any;
    const viewP2 = engine.getPlayerView("P2") as any;

    // P1 sees own hand, P2 sees own hand
    expect(viewP1.players.P1.hand[0]).toBe("P1_card1");
    expect(viewP2.players.P2.hand[0]).toBe("P2_card1");

    // But each hides the other's hand
    expect(viewP1.players.P2.hand[0]).toEqual({ hidden: true });
    expect(viewP2.players.P1.hand[0]).toEqual({ hidden: true });
  });

  it("getPlayerView returns clone (mutations don't affect state)", () => {
    const engine = new CroupierCore(cardConfig(), ["P1", "P2"]);
    const view = engine.getPlayerView("P1") as any;
    view.players.P1.hand.push("INJECTED");
    const realState = engine.getState();
    expect(realState.players.P1.hand).toHaveLength(2);
  });
});

describe("Utility: maskArray", () => {
  it("replaces elements with placeholder", () => {
    expect(maskArray([1, 2, 3])).toEqual([
      { hidden: true },
      { hidden: true },
      { hidden: true },
    ]);
  });

  it("uses custom placeholder", () => {
    expect(maskArray(["a", "b"], "?")).toEqual(["?", "?"]);
  });
});

describe("Utility: countOnly", () => {
  it("returns array length", () => {
    expect(countOnly([1, 2, 3, 4, 5])).toBe(5);
  });

  it("returns 0 for empty array", () => {
    expect(countOnly([])).toBe(0);
  });
});
