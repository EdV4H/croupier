import { describe, expect, it } from "vitest";
import { CroupierCore } from "@croupier/core";
import { createDigitalTCGConfig } from "../src/index.js";
import type { TCGState } from "../src/types.js";

function createGame() {
  const config = createDigitalTCGConfig();
  return new CroupierCore(config, ["P1", "P2"], { seed: 42 });
}

describe("Digital TCG", () => {
  describe("setup", () => {
    it("initializes players with correct life", () => {
      const engine = createGame();
      const state = engine.getState() as TCGState;
      expect(state.players.P1.life).toBe(20);
      expect(state.players.P2.life).toBe(20);
    });

    it("deals initial hand of 3 cards", () => {
      const engine = createGame();
      const state = engine.getState() as TCGState;
      expect(state.players.P1.hand).toHaveLength(3);
      expect(state.players.P2.hand).toHaveLength(3);
    });

    it("remaining cards are in deck", () => {
      const engine = createGame();
      const state = engine.getState() as TCGState;
      // 10 cards total, 3 in hand
      expect(state.players.P1.deck).toHaveLength(7);
      expect(state.players.P2.deck).toHaveLength(7);
    });

    it("P1 goes first", () => {
      const engine = createGame();
      const state = engine.getState() as TCGState;
      expect(state.activePlayer).toBe("P1");
      expect(engine.getEngineState().currentPlayers).toBe("P1");
    });

    it("starts with 1 mana for first player", () => {
      const engine = createGame();
      const state = engine.getState() as TCGState;
      expect(state.players.P1.maxMana).toBe(1);
      expect(state.players.P1.currentMana).toBe(1);
      expect(state.players.P2.maxMana).toBe(0);
      expect(state.players.P2.currentMana).toBe(0);
    });
  });

  describe("endTurn", () => {
    it("swaps active player", () => {
      const engine = createGame();
      engine.dispatch("P1", "endTurn");
      const state = engine.getState() as TCGState;
      expect(state.activePlayer).toBe("P2");
    });

    it("increases mana for next player", () => {
      const engine = createGame();
      engine.dispatch("P1", "endTurn");
      const state = engine.getState() as TCGState;
      expect(state.players.P2.maxMana).toBe(1);
      expect(state.players.P2.currentMana).toBe(1);
    });

    it("draws a card for next player", () => {
      const engine = createGame();
      engine.dispatch("P1", "endTurn");
      const state = engine.getState() as TCGState;
      expect(state.players.P2.hand).toHaveLength(4); // 3 initial + 1 drawn
      expect(state.players.P2.deck).toHaveLength(6);
    });

    it("increments turn count", () => {
      const engine = createGame();
      engine.dispatch("P1", "endTurn");
      expect((engine.getState() as TCGState).turnCount).toBe(1);
    });
  });

  describe("playCard", () => {
    it("plays a creature to the board", () => {
      const engine = createGame();
      // End turns to get mana
      engine.dispatch("P1", "endTurn");
      engine.dispatch("P2", "endTurn"); // P1 gets 1 mana

      const state = engine.getState() as TCGState;
      // Find a 1-cost card
      const cheapCard = state.players.P1.hand.find((c) => c.cost <= 1);
      if (cheapCard) {
        const result = engine.dispatch("P1", "playCard", {
          cardId: cheapCard.id,
        });
        expect(result.ok).toBe(true);
        const after = engine.getState() as TCGState;
        expect(after.players.P1.board).toHaveLength(1);
        expect(after.players.P1.currentMana).toBe(
          state.players.P1.currentMana - cheapCard.cost,
        );
      }
    });

    it("rejects playing when not enough mana", () => {
      const engine = createGame();
      const state = engine.getState() as TCGState;
      // P1 starts with 1 mana — find a card costing more than 1
      const expensiveCard = state.players.P1.hand.find((c) => c.cost > 1);
      if (expensiveCard) {
        const result = engine.dispatch("P1", "playCard", {
          cardId: expensiveCard.id,
        });
        expect(result.ok).toBe(false);
      }
    });

    it("rejects playing from wrong player", () => {
      const engine = createGame();
      const state = engine.getState() as TCGState;
      const card = state.players.P2.hand[0];
      const result = engine.dispatch("P2", "playCard", {
        cardId: card.id,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("attack", () => {
    it("can attack opponent face", () => {
      const engine = createGame();
      // Build up: end turn twice to get mana, play a creature, wait a turn
      engine.dispatch("P1", "endTurn"); // P2 gets 1 mana
      engine.dispatch("P2", "endTurn"); // P1 gets 1 mana

      let state = engine.getState() as TCGState;
      const cheapCard = state.players.P1.hand.find((c) => c.cost <= 1);
      if (!cheapCard) return; // skip if no cheap card

      engine.dispatch("P1", "playCard", { cardId: cheapCard.id });
      engine.dispatch("P1", "endTurn"); // P2's turn
      engine.dispatch("P2", "endTurn"); // back to P1, creature loses sickness

      state = engine.getState() as TCGState;
      const creature = state.players.P1.board[0];
      if (creature) {
        const result = engine.dispatch("P1", "attack", {
          attackerId: creature.card.id,
          targetId: "face",
        });
        expect(result.ok).toBe(true);
        const after = engine.getState() as TCGState;
        expect(after.players.P2.life).toBe(20 - creature.card.attack);
      }
    });

    it("rejects attacking with summoning sickness", () => {
      const engine = createGame();
      engine.dispatch("P1", "endTurn");
      engine.dispatch("P2", "endTurn"); // P1 gets 1 mana

      const state = engine.getState() as TCGState;
      const cheapCard = state.players.P1.hand.find((c) => c.cost <= 1);
      if (!cheapCard) return;

      engine.dispatch("P1", "playCard", { cardId: cheapCard.id });
      const after = engine.getState() as TCGState;
      const creature = after.players.P1.board[0];
      if (creature) {
        const result = engine.dispatch("P1", "attack", {
          attackerId: creature.card.id,
          targetId: "face",
        });
        expect(result.ok).toBe(false);
        expect(result.error).toContain("summoning sickness");
      }
    });
  });

  describe("interrupts (life <= 0)", () => {
    it("ends game when life reaches 0", () => {
      const config = createDigitalTCGConfig({ initialLife: 1 });
      const engine = new CroupierCore(config, ["P1", "P2"], { seed: 42 });

      // Give P1 mana and a creature
      engine.dispatch("P1", "endTurn");
      engine.dispatch("P2", "endTurn"); // P1 gets 1 mana

      let state = engine.getState() as TCGState;
      const cheapCard = state.players.P1.hand.find((c) => c.cost <= 1);
      if (!cheapCard) return;

      engine.dispatch("P1", "playCard", { cardId: cheapCard.id });
      engine.dispatch("P1", "endTurn");
      engine.dispatch("P2", "endTurn"); // creature loses sickness

      state = engine.getState() as TCGState;
      const creature = state.players.P1.board[0];
      if (creature) {
        engine.dispatch("P1", "attack", {
          attackerId: creature.card.id,
          targetId: "face",
        });
        expect(engine.getEngineState().finished).toBe(true);
        expect(engine.getEngineState().result?.winner).toBe("P1");
      }
    });
  });

  describe("structured results", () => {
    it("result includes playerResults and rankings when game ends", () => {
      const config = createDigitalTCGConfig({ initialLife: 1 });
      const engine = new CroupierCore(config, ["P1", "P2"], { seed: 42 });

      // Give P1 mana and a creature
      engine.dispatch("P1", "endTurn");
      engine.dispatch("P2", "endTurn");

      let state = engine.getState() as TCGState;
      const cheapCard = state.players.P1.hand.find((c) => c.cost <= 1);
      if (!cheapCard) return;

      engine.dispatch("P1", "playCard", { cardId: cheapCard.id });
      engine.dispatch("P1", "endTurn");
      engine.dispatch("P2", "endTurn");

      state = engine.getState() as TCGState;
      const creature = state.players.P1.board[0];
      if (creature) {
        engine.dispatch("P1", "attack", {
          attackerId: creature.card.id,
          targetId: "face",
        });
        expect(engine.getEngineState().finished).toBe(true);
        const result = engine.getEngineState().result;
        expect(result).toBeDefined();
        expect(result!.playerResults).toBeDefined();
        expect(result!.rankings).toBeDefined();
        expect(result!.playerResults!.P1.rank).toBe(1);
        expect(result!.playerResults!.P2.rank).toBe(2);
        expect(result!.playerResults!.P2.stats!.finalLife).toBeLessThanOrEqual(0);
        expect(result!.playerResults!.P1.stats!.cardsPlayed).toBeDefined();
      }
    });
  });

  describe("state masking", () => {
    it("hides opponent hand", () => {
      const engine = createGame();
      const view = engine.getPlayerView("P1") as any;
      expect(view.players.P1.hand).toHaveLength(3);
      expect(view.players.P1.hand[0]).toHaveProperty("id");
      expect(view.players.P2.hand).toHaveLength(3);
      expect(view.players.P2.hand[0]).toEqual({ hidden: true });
    });

    it("shows deck as count only", () => {
      const engine = createGame();
      const view = engine.getPlayerView("P1") as any;
      expect(view.players.P1.deckCount).toBe(7);
      expect(view.players.P1.deck).toBeUndefined();
    });

    it("shows board and graveyard for both players", () => {
      const engine = createGame();
      const view = engine.getPlayerView("P1") as any;
      expect(view.players.P1.board).toEqual([]);
      expect(view.players.P2.board).toEqual([]);
      expect(view.players.P1.graveyard).toEqual([]);
      expect(view.players.P2.graveyard).toEqual([]);
    });
  });
});
