import { describe, expect, it } from "vitest";
import { CroupierCore } from "@croupier/core";
import { createTexasHoldemConfig } from "../src/index.js";
import type { HoldemState } from "../src/types.js";

function createGame(numPlayers = 3) {
  const players = Array.from({ length: numPlayers }, (_, i) => `P${i + 1}`);
  const config = createTexasHoldemConfig({
    smallBlind: 1,
    bigBlind: 2,
    startingStack: 100,
  });
  return new CroupierCore(config, players, { seed: 42 });
}

describe("Texas Hold'em", () => {
  describe("setup", () => {
    it("deals 2 hole cards to each player", () => {
      const engine = createGame();
      const state = engine.getState() as HoldemState;
      for (const pid of state.playerOrder) {
        expect(state.players[pid].holeCards).toHaveLength(2);
      }
    });

    it("sets up correct stack sizes", () => {
      const engine = createGame();
      const state = engine.getState() as HoldemState;
      // P2 posts SB (1), P3 posts BB (2)
      expect(state.players.P2.stack).toBe(99); // 100 - 1 (SB)
      expect(state.players.P3.stack).toBe(98); // 100 - 2 (BB)
      expect(state.players.P1.stack).toBe(100); // No blind
    });

    it("starts in preFlop phase", () => {
      const engine = createGame();
      expect(engine.getEngineState().phase).toBe("preFlop");
    });

    it("posts blinds and adds to pot", () => {
      const engine = createGame();
      const state = engine.getState() as HoldemState;
      expect(state.pot).toBe(3); // SB(1) + BB(2)
      expect(state.currentHighestBet).toBe(2);
    });

    it("first to act is after BB", () => {
      const engine = createGame();
      const state = engine.getState() as HoldemState;
      // Dealer=P1(0), SB=P2(1), BB=P3(2), first to act=P1(0)
      expect(engine.getEngineState().currentPlayers).toBe("P1");
    });
  });

  describe("basic actions", () => {
    it("allows fold", () => {
      const engine = createGame();
      const result = engine.dispatch("P1", "fold");
      expect(result.ok).toBe(true);
      const state = engine.getState() as HoldemState;
      expect(state.players.P1.status).toBe("folded");
    });

    it("allows call", () => {
      const engine = createGame();
      const result = engine.dispatch("P1", "call");
      expect(result.ok).toBe(true);
      const state = engine.getState() as HoldemState;
      expect(state.players.P1.currentBet).toBe(2);
      expect(state.pot).toBe(5); // 3 + 2
    });

    it("allows raise", () => {
      const engine = createGame();
      const result = engine.dispatch("P1", "raise", { amount: 4 });
      expect(result.ok).toBe(true);
      const state = engine.getState() as HoldemState;
      expect(state.currentHighestBet).toBe(4);
    });

    it("rejects check when there's a bet to match", () => {
      const engine = createGame();
      // P1 has no bet but BB is 2
      const result = engine.dispatch("P1", "check");
      expect(result.ok).toBe(false);
    });

    it("rejects action from wrong player", () => {
      const engine = createGame();
      const result = engine.dispatch("P2", "fold");
      expect(result.ok).toBe(false);
    });
  });

  describe("betting rounds", () => {
    it("transitions to flop when all call", () => {
      const engine = createGame();
      engine.dispatch("P1", "call");     // P1 calls BB
      engine.dispatch("P2", "call");     // P2 (SB) calls to 2
      engine.dispatch("P3", "check");    // P3 (BB) checks
      expect(engine.getEngineState().phase).toBe("flop");
      const state = engine.getState() as HoldemState;
      expect(state.communityCards).toHaveLength(3);
    });

    it("transitions through all phases", () => {
      const engine = createGame();

      // Pre-flop: everyone calls
      engine.dispatch("P1", "call");
      engine.dispatch("P2", "call");
      engine.dispatch("P3", "check");
      expect(engine.getEngineState().phase).toBe("flop");

      // Flop: everyone checks
      engine.dispatch("P2", "check");
      engine.dispatch("P3", "check");
      engine.dispatch("P1", "check");
      expect(engine.getEngineState().phase).toBe("turn");
      expect((engine.getState() as HoldemState).communityCards).toHaveLength(4);

      // Turn: everyone checks
      engine.dispatch("P2", "check");
      engine.dispatch("P3", "check");
      engine.dispatch("P1", "check");
      expect(engine.getEngineState().phase).toBe("river");
      expect((engine.getState() as HoldemState).communityCards).toHaveLength(5);

      // River: everyone checks
      engine.dispatch("P2", "check");
      engine.dispatch("P3", "check");
      engine.dispatch("P1", "check");

      // After showdown, game continues to next hand (preFlop)
      const es = engine.getEngineState();
      expect(es.phase).toBe("preFlop");
      expect(es.finished).toBe(false);
    });
  });

  describe("all fold", () => {
    it("awards pot and starts next hand when all but one fold", () => {
      const engine = createGame();
      engine.dispatch("P1", "fold");
      engine.dispatch("P2", "fold");
      // P3 wins the hand, but game continues (all players still have chips)
      const es = engine.getEngineState();
      expect(es.finished).toBe(false);
      expect(es.phase).toBe("preFlop"); // new hand started
    });

    it("awards pot to last remaining player", () => {
      const engine = createGame();
      engine.dispatch("P1", "fold");
      engine.dispatch("P2", "fold");
      const state = engine.getState() as HoldemState;
      // Pot was awarded to P3, then new hand started with new blinds
      // P3 had 98 (after BB) + 3 (pot) = 101, then new hand blinds posted
      // Dealer moved from 0 to 1, so SB=P3(idx2), BB=P1(idx0)
      // P3 posts SB: 101 - 1 = 100
      expect(state.players.P3.stack).toBe(100);
    });
  });

  describe("all-in", () => {
    it("allows going all-in", () => {
      const engine = createGame();
      const result = engine.dispatch("P1", "allIn");
      expect(result.ok).toBe(true);
      const state = engine.getState() as HoldemState;
      expect(state.players.P1.status).toBe("allIn");
      expect(state.players.P1.stack).toBe(0);
    });
  });

  describe("state masking", () => {
    it("hides opponent hole cards", () => {
      const engine = createGame();
      const view = engine.getPlayerView("P1") as any;
      expect(view.players.P1.holeCards).toHaveLength(2);
      expect(view.players.P1.holeCards[0]).toHaveProperty("suit");
      expect(view.players.P2.holeCards).toHaveLength(2);
      expect(view.players.P2.holeCards[0]).toEqual({ hidden: true });
    });

    it("shows community cards to all", () => {
      const engine = createGame();
      // Go to flop
      engine.dispatch("P1", "call");
      engine.dispatch("P2", "call");
      engine.dispatch("P3", "check");

      const view = engine.getPlayerView("P1") as any;
      expect(view.communityCards).toHaveLength(3);
      expect(view.communityCards[0]).toHaveProperty("suit");
    });

    it("shows deck as count", () => {
      const engine = createGame();
      const view = engine.getPlayerView("P1") as any;
      expect(typeof view.deckCount).toBe("number");
      expect(view.deck).toBeUndefined();
    });
  });
});
