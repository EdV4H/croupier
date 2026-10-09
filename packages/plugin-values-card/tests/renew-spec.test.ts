/**
 * Behaviour required by renew-values-card (Values Card Online renewal),
 * covering its game-service cases: dealing, drawing from deck / discard pool,
 * turn violations, game end and auto-play.
 */
import { describe, expect, it } from "vitest";
import { CroupierCore, executeBotTakeover } from "@edv4h/croupier-core";
import {
  createValuesCardConfig,
  valuesCardAutoPlayStrategy,
  type ValuesCardOptions,
  type ValuesCardResult,
  type ValuesCardState,
} from "../src/index.js";

/** Card master shaped like DB records: numeric ids plus extra attributes */
interface MasterCard {
  id: number;
  title: string;
  imageUrl: string;
  effectType: "normal" | "rare";
}

const MASTER: MasterCard[] = Array.from({ length: 70 }, (_, i) => ({
  id: i + 1,
  title: `価値観${i + 1}`,
  imageUrl: `https://example.com/cards/${i + 1}.png`,
  effectType: i % 10 === 0 ? "rare" : "normal",
}));

type State = ValuesCardState<MasterCard>;

function createGame(
  players = ["A", "B", "C"],
  options: ValuesCardOptions<MasterCard> = {},
) {
  const config = createValuesCardConfig<MasterCard>({
    theme: "チームで大事にしたいこと",
    cards: MASTER,
    ...options,
  });
  return new CroupierCore(config, players, { seed: 7 });
}

function current(engine: CroupierCore<State>) {
  return engine.getEngineState().currentPlayers as string;
}

/** Play one normal turn: draw from deck, discard the first card in hand */
function playTurn(engine: CroupierCore<State>) {
  const p = current(engine);
  expect(engine.dispatch(p, "drawFromDeck").ok).toBe(true);
  const hand = engine.getState().players[p].hand;
  expect(engine.dispatch(p, "discardCard", { cardId: hand[0].id }).ok).toBe(true);
}

describe("renew-values-card spec", () => {
  describe("dealing", () => {
    it("deals 5 cards to each player from the injected master and leaves the rest in the deck", () => {
      const engine = createGame(["A", "B", "C", "D"]);
      const state = engine.getState();
      for (const p of ["A", "B", "C", "D"]) {
        expect(state.players[p].hand).toHaveLength(5);
      }
      expect(state.deck).toHaveLength(70 - 20);
      const all = [...state.deck, ...Object.values(state.players).flatMap((p) => p.hand)];
      expect(new Set(all.map((c) => c.id)).size).toBe(70);
    });

    it("keeps card attributes and numeric ids intact", () => {
      const engine = createGame();
      const card = engine.getState().players.A.hand[0];
      expect(typeof card.id).toBe("number");
      expect(card).toEqual(MASTER.find((m) => m.id === card.id));
    });

    it("starts with the first player waiting to draw", () => {
      const engine = createGame();
      expect(current(engine)).toBe("A");
      expect(engine.getEngineState().stage).toBe("waitingForDraw");
    });
  });

  describe("drawing from the deck", () => {
    it("moves the top card of the deck to the end of the hand", () => {
      const engine = createGame();
      const top = engine.getState().deck[0];
      expect(engine.dispatch("A", "drawFromDeck").ok).toBe(true);
      const state = engine.getState();
      expect(state.players.A.hand).toHaveLength(6);
      expect(state.players.A.hand[5]).toEqual(top);
      expect(state.drawnCardId).toBe(top.id);
      expect(engine.getEngineState().stage).toBe("waitingForDiscard");
    });

    it("shows the drawn card only to the drawer", () => {
      const engine = createGame();
      engine.dispatch("A", "drawFromDeck");
      const drawn = engine.getState().drawnCardId;
      expect((engine.getPlayerView("A") as any).drawnCardId).toBe(drawn);
      expect((engine.getPlayerView("B") as any).drawnCardId).toBeNull();
      expect((engine.getPlayerView("B") as any).players.A).toEqual({ handCount: 6 });
    });
  });

  describe("drawing from the discard pool", () => {
    it("takes the chosen card (by numeric id) out of the pool", () => {
      const engine = createGame();
      playTurn(engine); // A discards
      const discarded = engine.getState().discardPool[0].card;

      expect(engine.dispatch("B", "drawFromDiscard", { cardId: discarded.id }).ok).toBe(true);
      const state = engine.getState();
      expect(state.discardPool).toHaveLength(0);
      expect(state.players.B.hand.at(-1)).toEqual(discarded);
      expect(state.drawnCardId).toBe(discarded.id);
    });

    it("rejects a card that is not in the pool", () => {
      const engine = createGame();
      playTurn(engine);
      expect(engine.dispatch("B", "drawFromDiscard", { cardId: 9999 }).ok).toBe(false);
      expect(engine.dispatch("B", "drawFromDiscard").ok).toBe(false);
    });

    it("records who discarded each card", () => {
      const engine = createGame();
      playTurn(engine);
      playTurn(engine);
      expect(engine.getState().discardPool.map((e) => e.discardedBy)).toEqual(["A", "B"]);
    });
  });

  describe("turn violations", () => {
    it("rejects actions from a player whose turn it is not", () => {
      const engine = createGame();
      expect(engine.dispatch("B", "drawFromDeck").ok).toBe(false);
      engine.dispatch("A", "drawFromDeck");
      const bCard = engine.getState().players.B.hand[0];
      expect(engine.dispatch("B", "discardCard", { cardId: bCard.id }).ok).toBe(false);
    });

    it("rejects discarding before drawing", () => {
      const engine = createGame();
      const card = engine.getState().players.A.hand[0];
      expect(engine.dispatch("A", "discardCard", { cardId: card.id }).ok).toBe(false);
    });

    it("rejects drawing twice in one turn", () => {
      const engine = createGame();
      engine.dispatch("A", "drawFromDeck");
      expect(engine.dispatch("A", "drawFromDeck").ok).toBe(false);
    });

    it("rejects discarding a card that is not in hand", () => {
      const engine = createGame();
      engine.dispatch("A", "drawFromDeck");
      const bCard = engine.getState().players.B.hand[0];
      expect(engine.dispatch("A", "discardCard", { cardId: bCard.id }).ok).toBe(false);
    });

    it("leaves state untouched on a rejected action", () => {
      const engine = createGame();
      const before = engine.getState();
      engine.dispatch("B", "drawFromDeck");
      expect(engine.getState()).toEqual(before);
      expect(engine.getRevision()).toBe(0);
    });

    it("passes the turn in order and wraps around", () => {
      const engine = createGame();
      const order: string[] = [];
      for (let i = 0; i < 4; i++) {
        order.push(current(engine));
        playTurn(engine);
      }
      expect(order).toEqual(["A", "B", "C", "A"]);
    });
  });

  describe("game end (deckEmpty rule, default)", () => {
    // 2 players × 5 cards + 2 in the deck
    const small = MASTER.slice(0, 12);

    it("ends on the discard of the turn in which the deck ran out", () => {
      const engine = createGame(["A", "B"], { cards: small });
      playTurn(engine); // deck 2 → 1
      expect(engine.getEngineState().finished).toBe(false);

      const p = current(engine);
      engine.dispatch(p, "drawFromDeck"); // deck 1 → 0
      expect(engine.getEngineState().finished).toBe(false); // must still discard
      const hand = engine.getState().players[p].hand;
      engine.dispatch(p, "discardCard", { cardId: hand[2].id });

      expect(engine.getEngineState().finished).toBe(true);
      const result = engine.getResult() as ValuesCardResult<MasterCard>;
      expect(result.endReason).toBe("deckEmpty");
    });

    it("does not end while players keep drawing from the discard pool and the deck has cards", () => {
      const engine = createGame(["A", "B"], { cards: small });
      playTurn(engine);
      for (let i = 0; i < 6; i++) {
        const p = current(engine);
        const pool = engine.getState().discardPool;
        engine.dispatch(p, "drawFromDiscard", { cardId: pool[0].card.id });
        engine.dispatch(p, "discardCard", { cardId: engine.getState().players[p].hand[0].id });
      }
      expect(engine.getEngineState().finished).toBe(false);
      expect(engine.getState().deck).toHaveLength(1);
    });

    it("puts the theme and every final hand (in order) into the result", () => {
      const engine = createGame(["A", "B"], { cards: small });
      playTurn(engine);
      playTurn(engine);
      const state = engine.getState();
      const result = engine.getEngineState().result as ValuesCardResult<MasterCard>;

      expect(result.theme).toBe("チームで大事にしたいこと");
      expect(result.finalHands.A).toEqual(state.players.A.hand);
      expect(result.finalHands.B).toEqual(state.players.B.hand);
      expect(result.playerResults.A.stats.finalHand).toEqual(state.players.A.hand);
      expect(result.turnCount).toBe(2);
    });

    it("reveals every hand once the game is over and rejects further actions", () => {
      const engine = createGame(["A", "B"], { cards: small });
      playTurn(engine);
      playTurn(engine);
      expect((engine.getPlayerView("A") as any).players.B.hand).toHaveLength(5);
      expect(engine.dispatch(current(engine), "drawFromDeck").ok).toBe(false);
    });

    it("keeps the hand order the player ended with", () => {
      const engine = createGame(["A", "B"], { cards: small });
      const before = engine.getState().players.A.hand.map((c) => c.id);
      engine.dispatch("A", "drawFromDeck");
      const drawn = engine.getState().drawnCardId!;
      engine.dispatch("A", "discardCard", { cardId: before[1] });
      expect(engine.getState().players.A.hand.map((c) => c.id)).toEqual([
        before[0], before[2], before[3], before[4], drawn,
      ]);
    });
  });

  describe("other end rules", () => {
    it("lastRound rule gives every player one more turn after the deck runs out", () => {
      const engine = createGame(["A", "B"], { cards: MASTER.slice(0, 11), endRule: "lastRound" });
      playTurn(engine); // deck runs out
      expect(engine.getEngineState().finished).toBe(false);
      for (let i = 0; i < 2; i++) {
        const p = current(engine);
        engine.dispatch(p, "drawFromDiscard", { cardId: engine.getState().discardPool[0].card.id });
        engine.dispatch(p, "discardCard", { cardId: engine.getState().players[p].hand[0].id });
      }
      expect(engine.getEngineState().finished).toBe(true);
      expect((engine.getResult() as ValuesCardResult<MasterCard>).endReason).toBe("lastRound");
    });

    it("maxTurns ends the game after that many turns", () => {
      const engine = createGame(["A", "B"], { maxTurns: 3 });
      playTurn(engine);
      playTurn(engine);
      expect(engine.getEngineState().finished).toBe(false);
      playTurn(engine);
      expect(engine.getEngineState().finished).toBe(true);
      expect((engine.getResult() as ValuesCardResult<MasterCard>).endReason).toBe("maxTurns");
    });

    it("shouldEnd adds a custom end check after each discard", () => {
      const engine = createGame(["A", "B"], {
        shouldEnd: (game) => game.discardPool.length >= 2,
      });
      playTurn(engine);
      playTurn(engine);
      expect(engine.getEngineState().finished).toBe(true);
      expect((engine.getResult() as ValuesCardResult<MasterCard>).endReason).toBe("custom");
    });
  });

  describe("auto-play (disconnect / idle)", () => {
    it("draws from the deck and discards the card it just drew", async () => {
      const engine = createGame();
      // Put a card into the discard pool so drawing from it would be possible
      playTurn(engine);
      const handBefore = engine.getState().players.B.hand;
      const top = engine.getState().deck[0];

      const first = await executeBotTakeover(engine, valuesCardAutoPlayStrategy as any);
      expect(first).toEqual([{ playerId: "B", decision: { action: "drawFromDeck" } }]);
      const second = await executeBotTakeover(engine, valuesCardAutoPlayStrategy as any);
      expect(second).toEqual([
        { playerId: "B", decision: { action: "discardCard", payload: { cardId: top.id } } },
      ]);

      const state = engine.getState();
      expect(state.players.B.hand).toEqual(handBefore);
      expect(state.discardPool.at(-1)).toEqual({ card: top, discardedBy: "B" });
      expect(current(engine)).toBe("C");
    });

    it("discards the card the player drew themselves before going idle", async () => {
      const engine = createGame();
      playTurn(engine);
      const fromPool = engine.getState().discardPool[0].card;
      engine.dispatch("B", "drawFromDiscard", { cardId: fromPool.id });

      await executeBotTakeover(engine, valuesCardAutoPlayStrategy as any);
      expect(engine.getState().discardPool.at(-1)?.card).toEqual(fromPool);
    });

    it("never draws from the discard pool while the deck has cards", () => {
      const engine = createGame();
      playTurn(engine);
      const decision = valuesCardAutoPlayStrategy.decide(
        "B",
        engine.getPlayerView("B"),
        engine.getEngineState(),
      );
      expect(decision).toEqual({ action: "drawFromDeck" });
    });

    it("does nothing for a player whose turn it is not", () => {
      const engine = createGame();
      expect(
        valuesCardAutoPlayStrategy.decide("B", engine.getPlayerView("B"), engine.getEngineState()),
      ).toBeNull();
    });

    it("plays a whole game to the end with auto-play only", async () => {
      const engine = createGame(["A", "B", "C"]);
      for (let i = 0; i < 200 && !engine.getEngineState().finished; i++) {
        await executeBotTakeover(engine, valuesCardAutoPlayStrategy as any);
      }
      expect(engine.getEngineState().finished).toBe(true);
      expect((engine.getResult() as ValuesCardResult<MasterCard>).endReason).toBe("deckEmpty");
    });
  });
});
