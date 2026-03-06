import { describe, expect, it } from "vitest";
import { CroupierCore } from "@croupier/core";
import { createValuesCardConfig } from "../src/index.js";
import type { ValuesCardState } from "../src/types.js";

function createGame(numPlayers = 3) {
  const players = Array.from({ length: numPlayers }, (_, i) => `P${i + 1}`);
  const config = createValuesCardConfig({ theme: "Test Theme" });
  return new CroupierCore(config, players, { seed: 42 });
}

describe("Values Card", () => {
  describe("setup", () => {
    it("deals 5 cards to each player", () => {
      const engine = createGame(3);
      const state = engine.getState() as ValuesCardState;
      for (const p of ["P1", "P2", "P3"]) {
        expect(state.players[p].hand).toHaveLength(5);
      }
    });

    it("removes dealt cards from deck", () => {
      const engine = createGame(3);
      const state = engine.getState() as ValuesCardState;
      // 70 cards total, 15 dealt (5 per player)
      expect(state.deck).toHaveLength(55);
    });

    it("starts in playerTurn phase with waitingForDraw stage", () => {
      const engine = createGame();
      const es = engine.getEngineState();
      expect(es.phase).toBe("playerTurn");
      expect(es.stage).toBe("waitingForDraw");
    });

    it("P1 is the first player", () => {
      const engine = createGame();
      expect(engine.getEngineState().currentPlayers).toBe("P1");
    });
  });

  describe("draw from deck", () => {
    it("draws a card from the deck to hand", () => {
      const engine = createGame();
      const stateBefore = engine.getState() as ValuesCardState;
      const deckBefore = stateBefore.deck.length;

      const result = engine.dispatch("P1", "drawFromDeck");
      expect(result.ok).toBe(true);

      const stateAfter = engine.getState() as ValuesCardState;
      expect(stateAfter.players.P1.hand).toHaveLength(6);
      expect(stateAfter.deck).toHaveLength(deckBefore - 1);
    });

    it("transitions to waitingForDiscard after drawing", () => {
      const engine = createGame();
      engine.dispatch("P1", "drawFromDeck");
      expect(engine.getEngineState().stage).toBe("waitingForDiscard");
    });
  });

  describe("draw from discard", () => {
    it("picks up a card from the discard pool", () => {
      const engine = createGame();

      // P1 draws and discards to create a discard
      engine.dispatch("P1", "drawFromDeck");
      const state = engine.getState() as ValuesCardState;
      const cardToDiscard = state.players.P1.hand[0];
      engine.dispatch("P1", "discardCard", { cardId: cardToDiscard.id });

      // P2 draws from discard
      const stateAfterDiscard = engine.getState() as ValuesCardState;
      const discardedCard = stateAfterDiscard.discardPool[0].card;
      const result = engine.dispatch("P2", "drawFromDiscard", {
        cardId: discardedCard.id,
      });
      expect(result.ok).toBe(true);

      const stateAfterPick = engine.getState() as ValuesCardState;
      expect(stateAfterPick.players.P2.hand).toHaveLength(6);
      expect(
        stateAfterPick.players.P2.hand.find(
          (c) => c.id === discardedCard.id,
        ),
      ).toBeDefined();
    });
  });

  describe("discard", () => {
    it("removes card from hand and adds to discard pool", () => {
      const engine = createGame();
      engine.dispatch("P1", "drawFromDeck");

      const state = engine.getState() as ValuesCardState;
      const cardToDiscard = state.players.P1.hand[0];

      engine.dispatch("P1", "discardCard", { cardId: cardToDiscard.id });

      const stateAfter = engine.getState() as ValuesCardState;
      expect(stateAfter.players.P1.hand).toHaveLength(5);
      expect(stateAfter.discardPool).toHaveLength(1);
      expect(stateAfter.discardPool[0].card.id).toBe(cardToDiscard.id);
      expect(stateAfter.discardPool[0].discardedBy).toBe("P1");
    });

    it("advances to next player after discard", () => {
      const engine = createGame();
      engine.dispatch("P1", "drawFromDeck");

      const state = engine.getState() as ValuesCardState;
      const cardToDiscard = state.players.P1.hand[0];
      engine.dispatch("P1", "discardCard", { cardId: cardToDiscard.id });

      // Should be P2's turn now
      expect(engine.getEngineState().currentPlayers).toBe("P2");
      expect(engine.getEngineState().stage).toBe("waitingForDraw");
    });
  });

  describe("validation", () => {
    it("rejects drawing when not your turn", () => {
      const engine = createGame();
      const result = engine.dispatch("P2", "drawFromDeck");
      expect(result.ok).toBe(false);
    });

    it("rejects discarding before drawing", () => {
      const engine = createGame();
      const state = engine.getState() as ValuesCardState;
      const result = engine.dispatch("P1", "discardCard", {
        cardId: state.players.P1.hand[0].id,
      });
      expect(result.ok).toBe(false);
    });

    it("rejects drawing twice", () => {
      const engine = createGame();
      engine.dispatch("P1", "drawFromDeck");
      const result = engine.dispatch("P1", "drawFromDeck");
      expect(result.ok).toBe(false);
    });
  });

  describe("full game scenario", () => {
    it("plays through until deck is empty", () => {
      // Use only 2 players with a small deck for a quicker test
      const smallCards = Array.from({ length: 12 }, (_, i) => ({
        id: `c${i}`,
        name: `Card ${i}`,
      }));
      const config = createValuesCardConfig({
        theme: "Test",
        cards: smallCards,
      });
      const engine = new CroupierCore(config, ["P1", "P2"], { seed: 1 });

      // 12 cards, 10 dealt (5 each), 2 remaining
      let state = engine.getState() as ValuesCardState;
      expect(state.deck).toHaveLength(2);

      // Play 2 turns to exhaust the deck
      for (let turn = 0; turn < 2; turn++) {
        state = engine.getState() as ValuesCardState;
        const currentPlayer =
          state.playerOrder[state.currentPlayerIndex];

        engine.dispatch(currentPlayer, "drawFromDeck");

        state = engine.getState() as ValuesCardState;
        const cardToDiscard = state.players[currentPlayer].hand[0];
        engine.dispatch(currentPlayer, "discardCard", {
          cardId: cardToDiscard.id,
        });
      }

      // Deck is empty but game is NOT over yet — last round begins
      state = engine.getState() as ValuesCardState;
      expect(state.deck).toHaveLength(0);
      expect(state.lastRoundTurnsLeft).toBe(2); // both players get one more turn
      expect(engine.getEngineState().finished).toBe(false);

      // Play the last round: each player draws from discard and discards
      for (let turn = 0; turn < 2; turn++) {
        state = engine.getState() as ValuesCardState;
        const currentPlayer =
          state.playerOrder[state.currentPlayerIndex];

        // Draw from discard pool
        const pickCard = state.discardPool[0].card;
        engine.dispatch(currentPlayer, "drawFromDiscard", {
          cardId: pickCard.id,
        });

        state = engine.getState() as ValuesCardState;
        const cardToDiscard = state.players[currentPlayer].hand[0];
        engine.dispatch(currentPlayer, "discardCard", {
          cardId: cardToDiscard.id,
        });
      }

      // Now game should be finished
      const es = engine.getEngineState();
      expect(es.finished).toBe(true);
      expect(es.result?.reason).toBe("All cards have been exchanged");
    });
  });
});
