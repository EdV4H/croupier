import { afterEach, describe, expect, it, vi } from "vitest";
import { CroupierCore, executeBotTakeover } from "@edv4h/croupier-core";
import {
  DEFAULT_VALUES_CARDS,
  HAND_SIZE,
  createValuesCardConfig,
  valuesCardAutoPlayStrategy,
  valuesCardRandomBotStrategy,
  type ValuesCardOptions,
} from "../src/index.js";
import type {
  BaseCard,
  Card,
  ValuesCardResult,
  ValuesCardState,
} from "../src/types.js";

function createGame(numPlayers = 3, options: ValuesCardOptions = {}) {
  const players = Array.from({ length: numPlayers }, (_, i) => `P${i + 1}`);
  const config = createValuesCardConfig({ theme: "Test Theme", ...options });
  return new CroupierCore(config, players, { seed: 42 });
}

function makeCards(n: number): Card[] {
  return Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Card ${i}` }));
}

function state<C extends BaseCard>(engine: CroupierCore<ValuesCardState<C>>) {
  return engine.getState();
}

function currentPlayer<C extends BaseCard>(engine: CroupierCore<ValuesCardState<C>>) {
  const s = state(engine);
  return s.playerOrder[s.currentPlayerIndex];
}

/** Draw from the deck and discard the first card in hand */
function playDeckTurn<C extends BaseCard>(engine: CroupierCore<ValuesCardState<C>>) {
  const p = currentPlayer(engine);
  expect(engine.dispatch(p, "drawFromDeck").ok).toBe(true);
  const cardId = state(engine).players[p].hand[0].id;
  expect(engine.dispatch(p, "discardCard", { cardId }).ok).toBe(true);
}

/** Draw the latest discard and discard the first card in hand */
function playDiscardTurn<C extends BaseCard>(engine: CroupierCore<ValuesCardState<C>>) {
  const p = currentPlayer(engine);
  const pool = state(engine).discardPool;
  expect(
    engine.dispatch(p, "drawFromDiscard", { cardId: pool[pool.length - 1].card.id }).ok,
  ).toBe(true);
  const cardId = state(engine).players[p].hand[0].id;
  expect(engine.dispatch(p, "discardCard", { cardId }).ok).toBe(true);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Values Card", () => {
  // ==========================================================
  // 配布
  // ==========================================================
  describe("setup (deal)", () => {
    it("deals 5 cards to each player", () => {
      const s = state(createGame(3));
      for (const p of ["P1", "P2", "P3"]) {
        expect(s.players[p].hand).toHaveLength(HAND_SIZE);
      }
    });

    it("removes dealt cards from deck without duplicates", () => {
      const s = state(createGame(3));
      // 70 cards total, 15 dealt (5 per player)
      expect(s.deck).toHaveLength(55);
      const all = [...s.deck, ...Object.values(s.players).flatMap((p) => p.hand)];
      expect(new Set(all.map((c) => c.id)).size).toBe(DEFAULT_VALUES_CARDS.length);
    });

    it("shuffles deterministically by seed", () => {
      expect(state(createGame(3)).deck).toEqual(state(createGame(3)).deck);
      const other = new CroupierCore(
        createValuesCardConfig(),
        ["P1", "P2", "P3"],
        { seed: 7 },
      );
      expect(state(other).deck).not.toEqual(state(createGame(3)).deck);
    });

    it("starts in playerTurn / waitingForDraw with P1", () => {
      const engine = createGame();
      const es = engine.getEngineState();
      expect(es.phase).toBe("playerTurn");
      expect(es.stage).toBe("waitingForDraw");
      expect(es.currentPlayers).toBe("P1");
      expect(state(engine).drawnCard).toBeNull();
    });

    it("keeps the theme given from outside", () => {
      expect(state(createGame(3, { theme: "チームで大事にしたいこと" })).theme).toBe(
        "チームで大事にしたいこと",
      );
    });

    it("throws when there are not enough cards to deal", () => {
      expect(() => createGame(3, { cards: makeCards(14) })).toThrow(/at least 15/);
    });
  });

  // ==========================================================
  // 山札から取得
  // ==========================================================
  describe("draw from deck", () => {
    it("moves the top card of the deck to the end of the hand", () => {
      const engine = createGame();
      const before = state(engine);
      const top = before.deck[0];

      expect(engine.dispatch("P1", "drawFromDeck").ok).toBe(true);

      const after = state(engine);
      expect(after.players.P1.hand).toHaveLength(6);
      expect(after.players.P1.hand[5]).toEqual(top);
      expect(after.deck).toHaveLength(before.deck.length - 1);
      expect(after.drawnCard).toEqual({ cardId: top.id, source: "deck" });
    });

    it("transitions to waitingForDiscard after drawing", () => {
      const engine = createGame();
      engine.dispatch("P1", "drawFromDeck");
      expect(engine.getEngineState().stage).toBe("waitingForDiscard");
    });
  });

  // ==========================================================
  // 捨て札から取得
  // ==========================================================
  describe("draw from discard", () => {
    it("picks up a card from the discard pool", () => {
      const engine = createGame();
      playDeckTurn(engine);

      const discarded = state(engine).discardPool[0].card;
      const result = engine.dispatch("P2", "drawFromDiscard", { cardId: discarded.id });
      expect(result.ok).toBe(true);

      const s = state(engine);
      expect(s.players.P2.hand).toHaveLength(6);
      expect(s.players.P2.hand[5]).toEqual(discarded);
      expect(s.discardPool).toHaveLength(0);
      expect(s.drawnCard).toEqual({ cardId: discarded.id, source: "discard" });
      expect(engine.getEngineState().stage).toBe("waitingForDiscard");
    });

    it("can pick any card in the pool, not only the latest", () => {
      const engine = createGame();
      playDeckTurn(engine); // P1
      playDeckTurn(engine); // P2
      const oldest = state(engine).discardPool[0].card;
      expect(engine.dispatch("P3", "drawFromDiscard", { cardId: oldest.id }).ok).toBe(true);
      expect(state(engine).discardPool.map((e) => e.card.id)).not.toContain(oldest.id);
    });

    it("rejects cards that are not in the pool", () => {
      const engine = createGame();
      playDeckTurn(engine);
      const r = engine.dispatch("P2", "drawFromDiscard", { cardId: "nope" });
      expect(r).toEqual({ ok: false, error: "Card not found in discard pool" });
    });
  });

  // ==========================================================
  // 捨てる
  // ==========================================================
  describe("discard", () => {
    it("removes card from hand and adds to discard pool", () => {
      const engine = createGame();
      engine.dispatch("P1", "drawFromDeck");
      const card = state(engine).players.P1.hand[0];

      engine.dispatch("P1", "discardCard", { cardId: card.id });

      const s = state(engine);
      expect(s.players.P1.hand).toHaveLength(5);
      expect(s.discardPool).toEqual([{ card, discardedBy: "P1" }]);
      expect(s.drawnCard).toBeNull();
      expect(s.turnCount).toBe(1);
    });

    it("can discard the card that was just drawn", () => {
      const engine = createGame();
      const handBefore = state(engine).players.P1.hand;
      engine.dispatch("P1", "drawFromDeck");
      const drawn = state(engine).drawnCard!.cardId;
      expect(engine.dispatch("P1", "discardCard", { cardId: drawn }).ok).toBe(true);
      expect(state(engine).players.P1.hand).toEqual(handBefore);
    });

    it("advances to next player and wraps around", () => {
      const engine = createGame(3);
      playDeckTurn(engine);
      expect(engine.getEngineState().currentPlayers).toBe("P2");
      expect(engine.getEngineState().stage).toBe("waitingForDraw");
      playDeckTurn(engine);
      playDeckTurn(engine);
      expect(engine.getEngineState().currentPlayers).toBe("P1");
    });
  });

  // ==========================================================
  // 手番違反
  // ==========================================================
  describe("turn violations", () => {
    it("rejects drawing when not your turn", () => {
      const engine = createGame();
      expect(engine.dispatch("P2", "drawFromDeck").ok).toBe(false);
      expect(state(engine).players.P2.hand).toHaveLength(5);
    });

    it("rejects discarding when not your turn", () => {
      const engine = createGame();
      engine.dispatch("P1", "drawFromDeck");
      const r = engine.dispatch("P2", "discardCard", {
        cardId: state(engine).players.P2.hand[0].id,
      });
      expect(r.ok).toBe(false);
    });

    it("rejects discarding before drawing", () => {
      const engine = createGame();
      const r = engine.dispatch("P1", "discardCard", {
        cardId: state(engine).players.P1.hand[0].id,
      });
      expect(r.ok).toBe(false);
    });

    it("rejects drawing twice (deck or discard)", () => {
      const engine = createGame();
      playDeckTurn(engine);
      engine.dispatch("P2", "drawFromDeck");
      expect(engine.dispatch("P2", "drawFromDeck").ok).toBe(false);
      const pooled = state(engine).discardPool[0].card.id;
      expect(engine.dispatch("P2", "drawFromDiscard", { cardId: pooled }).ok).toBe(false);
    });

    it("rejects discarding a card that is not in hand", () => {
      const engine = createGame();
      engine.dispatch("P1", "drawFromDeck");
      const other = state(engine).players.P2.hand[0].id;
      expect(engine.dispatch("P1", "discardCard", { cardId: other })).toEqual({
        ok: false,
        error: "Card not in hand",
      });
    });

    it("rejects malformed payloads", () => {
      const engine = createGame();
      playDeckTurn(engine);
      expect(engine.dispatch("P2", "drawFromDiscard").ok).toBe(false);
      engine.dispatch("P2", "drawFromDeck");
      expect(engine.dispatch("P2", "discardCard", {}).ok).toBe(false);
      expect(engine.dispatch("P2", "discardCard", { cardId: { x: 1 } }).ok).toBe(false);
    });

    it("rejects any action after the game ends", () => {
      const engine = createGame(2, { cards: makeCards(11) });
      playDeckTurn(engine);
      expect(engine.getEngineState().finished).toBe(true);
      expect(engine.dispatch("P2", "drawFromDiscard", {
        cardId: state(engine).discardPool[0].card.id,
      }).ok).toBe(false);
    });
  });

  // ==========================================================
  // 終了（deckEmpty: renew 仕様）
  // ==========================================================
  describe("game end (deckEmpty, default)", () => {
    it("ends on the discard of the turn in which the deck ran out", () => {
      // 12 cards, 10 dealt → 2 in deck
      const engine = createGame(2, { cards: makeCards(12) });
      playDeckTurn(engine); // P1: deck 1
      expect(engine.getEngineState().finished).toBe(false);

      engine.dispatch("P2", "drawFromDeck"); // deck 0
      expect(state(engine).deck).toHaveLength(0);
      expect(engine.getEngineState().finished).toBe(false);

      const cardId = state(engine).players.P2.hand[0].id;
      engine.dispatch("P2", "discardCard", { cardId });
      expect(engine.getEngineState().finished).toBe(true);
      expect(engine.getEngineState().result?.endReason).toBe("deckEmpty");
    });

    it("does not end while the deck has cards, even with discard-only turns", () => {
      const engine = createGame(2, { cards: makeCards(12) });
      playDeckTurn(engine);
      for (let i = 0; i < 10; i++) playDiscardTurn(engine);
      expect(engine.getEngineState().finished).toBe(false);
      expect(state(engine).deck).toHaveLength(1);
    });

    it("result contains theme and final hands in hand order", () => {
      const engine = createGame(2, { cards: makeCards(11), theme: "大事な価値観" });
      const p1Before = state(engine).players.P1.hand;
      engine.dispatch("P1", "drawFromDeck");
      const drawn = state(engine).players.P1.hand[5];
      // Discard the 2nd card so the order shifts
      engine.dispatch("P1", "discardCard", { cardId: p1Before[1].id });

      const result = engine.getResult() as ValuesCardResult<Card>;
      expect(result.theme).toBe("大事な価値観");
      expect(result.finalHands.P1).toEqual([
        p1Before[0],
        p1Before[2],
        p1Before[3],
        p1Before[4],
        drawn,
      ]);
      expect(result.finalHands.P2).toEqual(state(engine).players.P2.hand);
      expect(result.playerResults.P1.stats.finalHand).toEqual(
        result.finalHands.P1.map((c) => c.name),
      );
      expect(result.playerResults.P1.stats.finalHandCardIds).toEqual(
        result.finalHands.P1.map((c) => c.id),
      );
      expect(result.summary.P1).toEqual(result.finalHands.P1.map((c) => c.name));
      expect(result.turnCount).toBe(1);
    });

    it("reveals every hand in the player view once the game is over", () => {
      const engine = createGame(2, { cards: makeCards(11) });
      expect((engine.getPlayerView("P1") as any).players.P2.hand).toBeUndefined();
      playDeckTurn(engine);
      const view = engine.getPlayerView("P1") as any;
      expect(view.gameOver).toBe(true);
      expect(view.players.P2.hand).toEqual(state(engine).players.P2.hand);
    });
  });

  // ==========================================================
  // 終了（lastRound: 従来方式）
  // ==========================================================
  describe("game end (lastRound)", () => {
    it("gives every player one more turn after the deck runs out", () => {
      const engine = createGame(2, { cards: makeCards(12), endMode: "lastRound" });

      playDeckTurn(engine);
      playDeckTurn(engine);

      // Deck is empty but game is NOT over yet — last round begins
      expect(state(engine).deck).toHaveLength(0);
      expect(state(engine).lastRoundTurnsLeft).toBe(2);
      expect(engine.getEngineState().finished).toBe(false);
      expect((engine.getPlayerView("P1") as any).lastRound).toBe(true);

      playDiscardTurn(engine);
      expect(engine.getEngineState().finished).toBe(false);
      playDiscardTurn(engine);

      const es = engine.getEngineState();
      expect(es.finished).toBe(true);
      expect(es.result?.reason).toBe("All cards have been exchanged");
      expect(es.result?.endReason).toBe("lastRound");
    });
  });

  // ==========================================================
  // 追加の終了条件（IN-170 対策の口）
  // ==========================================================
  describe("extra end conditions", () => {
    it("maxTurns ends the game after N completed turns", () => {
      const engine = createGame(3, { maxTurns: 4 });
      for (let i = 0; i < 3; i++) playDeckTurn(engine);
      expect(engine.getEngineState().finished).toBe(false);
      engine.dispatch("P1", "drawFromDeck");
      expect(engine.getEngineState().finished).toBe(false); // not mid-turn
      engine.dispatch("P1", "discardCard", { cardId: state(engine).drawnCard!.cardId });
      expect(engine.getEngineState().finished).toBe(true);
      expect(engine.getResult()?.endReason).toBe("maxTurns");
    });

    it("maxTurns stops a game where everyone only draws from the discard pool", () => {
      const engine = createGame(2, { maxTurns: 10 });
      playDeckTurn(engine);
      while (!engine.getEngineState().finished) playDiscardTurn(engine);
      expect(state(engine).turnCount).toBe(10);
      expect(state(engine).deck.length).toBeGreaterThan(0);
    });

    it("shouldEnd is checked after each completed turn", () => {
      const shouldEnd = vi.fn((g: ValuesCardState) => g.discardPool.length >= 2);
      const engine = createGame(3, { shouldEnd });
      playDeckTurn(engine);
      expect(engine.getEngineState().finished).toBe(false);
      playDeckTurn(engine);
      expect(engine.getEngineState().finished).toBe(true);
      const result = engine.getResult() as ValuesCardResult<Card>;
      expect(result.endReason).toBe("custom");
      expect(result.theme).toBe("Test Theme");
      expect(Object.keys(result.finalHands)).toEqual(["P1", "P2", "P3"]);
    });
  });

  // ==========================================================
  // 自動操作（切断 / 手番放置）
  // ==========================================================
  describe("auto play (renew spec)", () => {
    it("is the default bot strategy", () => {
      expect(createValuesCardConfig().bot).toBe(valuesCardAutoPlayStrategy);
    });

    it("draws from the deck and discards that same card", async () => {
      const engine = createGame();
      playDeckTurn(engine); // put something in the discard pool
      const before = state(engine);
      const top = before.deck[0];

      const r1 = await executeBotTakeover(engine, engine.getConfig().bot!);
      expect(r1[0].decision).toEqual({ action: "drawFromDeck" });
      const r2 = await executeBotTakeover(engine, engine.getConfig().bot!);
      expect(r2[0].decision).toEqual({ action: "discardCard", payload: { cardId: top.id } });

      const after = state(engine);
      expect(after.players.P2.hand).toEqual(before.players.P2.hand);
      expect(after.discardPool.at(-1)).toEqual({ card: top, discardedBy: "P2" });
      expect(engine.getEngineState().currentPlayers).toBe("P3");
    });

    it("never draws from the discard pool while the deck has cards", () => {
      const engine = createGame();
      playDeckTurn(engine);
      const decision = valuesCardAutoPlayStrategy.decide(
        "P2",
        engine.getPlayerView("P2"),
        engine.getEngineState(),
      );
      expect(decision).toEqual({ action: "drawFromDeck" });
    });

    it("discards the drawn card if the player drew manually, even from the discard pool", async () => {
      const engine = createGame();
      playDeckTurn(engine);
      const picked = state(engine).discardPool[0].card;
      engine.dispatch("P2", "drawFromDiscard", { cardId: picked.id });

      const r = await executeBotTakeover(engine, engine.getConfig().bot!);
      expect(r[0].decision).toEqual({ action: "discardCard", payload: { cardId: picked.id } });
      expect(state(engine).discardPool.at(-1)?.card).toEqual(picked);
    });

    it("plays a whole game to completion on its own", async () => {
      const engine = createGame(4);
      let guard = 0;
      while (!engine.getEngineState().finished && guard++ < 500) {
        await executeBotTakeover(engine, engine.getConfig().bot!);
      }
      expect(engine.getEngineState().finished).toBe(true);
      expect(engine.getResult()?.endReason).toBe("deckEmpty");
      // Hands never change under auto play
      const initial = state(createGame(4));
      for (const p of ["P1", "P2", "P3", "P4"]) {
        expect(state(engine).players[p].hand).toEqual(initial.players[p].hand);
      }
    });

    it("falls back to re-discarding the latest discard when the deck is empty (lastRound)", async () => {
      const engine = createGame(2, { cards: makeCards(11), endMode: "lastRound" });
      playDeckTurn(engine); // deck now empty, last round starts
      const latest = state(engine).discardPool.at(-1)!.card;
      const handBefore = state(engine).players.P2.hand;

      await executeBotTakeover(engine, engine.getConfig().bot!);
      await executeBotTakeover(engine, engine.getConfig().bot!);

      expect(state(engine).players.P2.hand).toEqual(handBefore);
      expect(state(engine).discardPool.at(-1)).toEqual({ card: latest, discardedBy: "P2" });
    });

    it("only the drawing player sees drawnCard", () => {
      const engine = createGame();
      engine.dispatch("P1", "drawFromDeck");
      expect((engine.getPlayerView("P1") as any).drawnCard).not.toBeNull();
      expect((engine.getPlayerView("P2") as any).drawnCard).toBeNull();
    });
  });

  describe("random bot", () => {
    it("can be injected via options", () => {
      const config = createValuesCardConfig({ bot: valuesCardRandomBotStrategy });
      expect(config.bot).toBe(valuesCardRandomBotStrategy);
    });
  });

  // ==========================================================
  // ジェネリックなカード
  // ==========================================================
  describe("custom card masters", () => {
    interface MasterCard {
      id: number;
      name: string;
      imageUrl: string;
      effectType: "normal" | "rare";
    }

    const master: MasterCard[] = Array.from({ length: 70 }, (_, i) => ({
      id: i + 1,
      name: `価値観${i + 1}`,
      imageUrl: `https://example.com/${i + 1}.png`,
      effectType: i % 10 === 0 ? "rare" : "normal",
    }));

    function createMasterGame() {
      const config = createValuesCardConfig<MasterCard>({ cards: master, theme: "T" });
      return new CroupierCore(config, ["A", "B", "C"], { seed: 1 });
    }

    it("keeps numeric ids and extra attributes", () => {
      const engine = createMasterGame();
      const hand = state(engine).players.A.hand;
      expect(typeof hand[0].id).toBe("number");
      expect(hand[0].imageUrl).toMatch(/^https:/);
      expect(["normal", "rare"]).toContain(hand[0].effectType);
    });

    it("accepts numeric card ids in payloads", () => {
      const engine = createMasterGame();
      engine.dispatch("A", "drawFromDeck");
      const id = state(engine).players.A.hand[0].id;
      expect(engine.dispatch("A", "discardCard", { cardId: id }).ok).toBe(true);
      expect(engine.dispatch("B", "drawFromDiscard", { cardId: id }).ok).toBe(true);
      // String form of a numeric id does not match
      expect(engine.dispatch("B", "discardCard", { cardId: String(id) }).ok).toBe(false);
    });

    it("returns full master cards in the result", async () => {
      const engine = createMasterGame();
      while (!engine.getEngineState().finished) {
        await executeBotTakeover(engine, engine.getConfig().bot!);
      }
      const result = engine.getResult() as ValuesCardResult<MasterCard>;
      expect(result.finalHands.A[0]).toHaveProperty("imageUrl");
      expect(result.playerResults.A.stats.finalHandCardIds.every((id) => typeof id === "number")).toBe(true);
    });
  });
});
