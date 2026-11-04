import { describe, expect, it } from "vitest";
import { CroupierCore, type CroupierSnapshot } from "@edv4h/croupier-core";
import {
  createValuesCardConfig,
  HAND_SIZE,
  type ValuesCardState,
} from "@edv4h/croupier-plugin-values-card";
import {
  toValuesCardAction,
  toWireEvents,
  toWireGameSnapshot,
  toWireResultPlayers,
  type WireGameEvent,
  type WireGameSnapshot,
} from "../src/index.js";

type NumCard = { id: number; name: string };
type Snap = CroupierSnapshot<ValuesCardState<NumCard>>;

const cards = (n: number): NumCard[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `card-${i + 1}` }));

function newGame(players: string[], deckExtra: number, seed = 1) {
  const config = createValuesCardConfig<NumCard>({
    cards: cards(players.length * HAND_SIZE + deckExtra),
  });
  return new CroupierCore(config, players, { seed });
}

const snap = (engine: CroupierCore<ValuesCardState<NumCard>>, logLimit?: number): Snap =>
  engine.toSnapshot(logLimit === undefined ? undefined : { logLimit });

const turnPlayer = (s: Snap) => s.game.playerOrder[s.game.currentPlayerIndex];

function eventsOf(prev: Snap | null, next: Snap, viewer: string): WireGameEvent[] {
  const result = toWireEvents(prev, next, viewer);
  if (result.kind !== "events") throw new Error(`resync: ${result.reason}`);
  return result.events;
}

describe("toWireGameSnapshot", () => {
  it("reveals only the viewer's hand", () => {
    const engine = newGame(["A", "B"], 5);
    const s = snap(engine);
    const forA = toWireGameSnapshot(s.game, "A");

    expect(forA.deck_remaining).toBe(5);
    expect(forA.turn_player_id).toBe("A");
    expect(forA.your_hand).toEqual(s.game.players.A.hand.map((c) => c.id));
    expect(forA.hand_counts).toEqual({ A: HAND_SIZE, B: HAND_SIZE });
    expect(forA.discards).toEqual([]);
  });

  it("gives a spectator an empty hand", () => {
    const engine = newGame(["A", "B"], 5);
    expect(toWireGameSnapshot(snap(engine).game, "watcher").your_hand).toEqual([]);
  });
});

describe("toWireEvents", () => {
  it("draw from the deck: everyone sees card_drawn, only the drawer gets hand_updated", () => {
    const engine = newGame(["A", "B"], 5);
    const s0 = snap(engine);
    engine.dispatch("A", "drawFromDeck");
    const s1 = snap(engine);

    expect(eventsOf(s0, s1, "A")).toEqual([
      { type: "card_drawn", payload: { player_id: "A", from: "deck", deck_remaining: 4 } },
      { type: "hand_updated", payload: { cards: s1.game.players.A.hand.map((c) => c.id) } },
    ]);
    expect(eventsOf(s0, s1, "B")).toEqual([
      { type: "card_drawn", payload: { player_id: "A", from: "deck", deck_remaining: 4 } },
    ]);
  });

  it("discard: card_discarded, the discarder's hand, then the next turn", () => {
    const engine = newGame(["A", "B"], 5);
    engine.dispatch("A", "drawFromDeck");
    const s1 = snap(engine);
    const card = s1.game.players.A.hand[0];
    engine.dispatch("A", "discardCard", { cardId: card.id });
    const s2 = snap(engine);

    expect(eventsOf(s1, s2, "A")).toEqual([
      { type: "card_discarded", payload: { player_id: "A", card_id: card.id } },
      { type: "hand_updated", payload: { cards: s2.game.players.A.hand.map((c) => c.id) } },
      { type: "turn_changed", payload: { player_id: "B" } },
    ]);
    expect(eventsOf(s1, s2, "B").map((e) => e.type)).toEqual(["card_discarded", "turn_changed"]);
  });

  it("drawing from the discard pile names the card", () => {
    const engine = newGame(["A", "B"], 5);
    engine.dispatch("A", "drawFromDeck");
    const thrown = snap(engine).game.players.A.hand[2];
    engine.dispatch("A", "discardCard", { cardId: thrown.id });
    const s2 = snap(engine);
    engine.dispatch("B", "drawFromDiscard", { cardId: thrown.id });
    const s3 = snap(engine);

    expect(eventsOf(s2, s3, "A")).toEqual([
      {
        type: "card_drawn",
        payload: { player_id: "B", from: "discard", card_id: thrown.id, deck_remaining: 4 },
      },
    ]);
  });

  it("the discard that ends the game announces finishing instead of the next turn", () => {
    const engine = newGame(["A", "B"], 1);
    engine.dispatch("A", "drawFromDeck");
    const s1 = snap(engine);
    engine.dispatch("A", "discardCard", { cardId: s1.game.players.A.hand[0].id });
    const s2 = snap(engine);

    expect(s2.game.endReason).toBe("deckEmpty");
    expect(eventsOf(s1, s2, "B").map((e) => e.type)).toEqual([
      "card_discarded",
      "room_status_changed",
    ]);
    expect(eventsOf(s1, s2, "B").at(-1)).toEqual({
      type: "room_status_changed",
      payload: { status: "finishing" },
    });
  });

  it("tells several actions in one step, in order", () => {
    const engine = newGame(["A", "B"], 6);
    const s0 = snap(engine);
    engine.dispatch("A", "drawFromDeck");
    const a = snap(engine).game.players.A.hand[0];
    engine.dispatch("A", "discardCard", { cardId: a.id });
    engine.dispatch("B", "drawFromDiscard", { cardId: a.id });
    const b = snap(engine).game.players.B.hand[1];
    engine.dispatch("B", "discardCard", { cardId: b.id });
    const s1 = snap(engine);

    expect(eventsOf(s0, s1, "B").map((e) => e.type)).toEqual([
      "card_drawn",
      "card_discarded",
      "turn_changed",
      "card_drawn",
      "hand_updated",
      "card_discarded",
      "hand_updated",
      "turn_changed",
    ]);
  });

  it("asks for a resync when it can't tell the step", () => {
    const engine = newGame(["A", "B"], 5);
    const s0 = snap(engine);
    engine.dispatch("A", "drawFromDeck");
    engine.dispatch("A", "discardCard", { cardId: snap(engine).game.players.A.hand[0].id });

    expect(toWireEvents(null, snap(engine), "A")).toMatchObject({ kind: "resync" });
    // only the last entry is kept, but two actions happened
    expect(toWireEvents(s0, snap(engine, 1), "A")).toEqual({
      kind: "resync",
      reason: "log truncated",
    });
    // a new game (fewer actions than before)
    expect(toWireEvents(snap(engine), s0, "A")).toEqual({
      kind: "resync",
      reason: "game was reset",
    });
    // the log doesn't explain the state
    const forged: Snap = { ...snap(engine), game: structuredClone(s0.game) };
    expect(toWireEvents(s0, forged, "A")).toMatchObject({ kind: "resync" });
  });

  it("maps non-numeric card ids with toWireCardId", () => {
    type NamedCard = { id: string };
    const named: NamedCard[] = Array.from({ length: 15 }, (_, i) => ({ id: `value-${i + 1}` }));
    const engine = new CroupierCore(createValuesCardConfig<NamedCard>({ cards: named }), ["A", "B"], {
      seed: 3,
    });
    const toWireCardId = (c: NamedCard) => Number(c.id.slice("value-".length));
    const s0 = engine.toSnapshot();
    engine.dispatch("A", "drawFromDeck");
    const s1 = engine.toSnapshot();

    const result = toWireEvents(s0, s1, "A", { toWireCardId });
    expect(result.kind).toBe("events");
    const hand = result.kind === "events" ? result.events.at(-1) : undefined;
    expect(hand).toEqual({
      type: "hand_updated",
      payload: { cards: s1.game.players.A.hand.map(toWireCardId) },
    });
    expect(() => toWireGameSnapshot(s1.game, "A")).toThrow(/toWireCardId/);
  });
});

describe("toValuesCardAction", () => {
  it("maps commands to actions the engine accepts", () => {
    const engine = newGame(["A", "B"], 5);
    expect(
      toValuesCardAction({ type: "draw_card", payload: { from: "deck" } }, snap(engine).game, "A"),
    ).toEqual({ action: "drawFromDeck" });
    engine.dispatch("A", "drawFromDeck");
    const card = snap(engine).game.players.A.hand[3];

    const discard = toValuesCardAction(
      { type: "discard_card", payload: { card_id: card.id } },
      snap(engine).game,
      "A",
    );
    expect(discard).toEqual({ action: "discardCard", payload: { cardId: card.id } });
    expect(engine.dispatch("A", discard!.action, discard!.payload).ok).toBe(true);

    expect(
      toValuesCardAction(
        { type: "draw_card", payload: { from: "discard", card_id: card.id } },
        snap(engine).game,
        "B",
      ),
    ).toEqual({ action: "drawFromDiscard", payload: { cardId: card.id } });
  });

  it("returns null when the named card isn't there", () => {
    const engine = newGame(["A", "B"], 5);
    const game = snap(engine).game;
    expect(
      toValuesCardAction({ type: "draw_card", payload: { from: "discard", card_id: 1 } }, game, "A"),
    ).toBeNull();
    const notInHand = game.deck[0].id;
    expect(
      toValuesCardAction({ type: "discard_card", payload: { card_id: notInHand } }, game, "A"),
    ).toBeNull();
  });
});

/** A client keeping only what the WS gives it: the snapshot, then events. */
function applyEvent(model: WireGameSnapshot, viewer: string, event: WireGameEvent): void {
  switch (event.type) {
    case "card_drawn": {
      model.deck_remaining = event.payload.deck_remaining;
      model.hand_counts[event.payload.player_id] += 1;
      if (event.payload.from === "discard") {
        model.discards = model.discards.filter((d) => d.card_id !== event.payload.card_id);
      }
      break;
    }
    case "hand_updated":
      model.your_hand = [...event.payload.cards];
      break;
    case "card_discarded":
      model.hand_counts[event.payload.player_id] -= 1;
      model.discards.push({ card_id: event.payload.card_id, player_id: event.payload.player_id });
      break;
    case "turn_changed":
      model.turn_player_id = event.payload.player_id;
      break;
    case "room_status_changed":
      break;
  }
  void viewer;
}

describe("whole games", () => {
  for (const seed of [1, 2, 3, 4]) {
    it(`clients that apply the events stay in step with the engine (seed ${seed})`, () => {
      const players = ["A", "B", "C"];
      const engine = newGame(players, 12, seed);
      let prev = snap(engine);
      const viewers = [...players, "watcher"];
      const models = new Map(viewers.map((v) => [v, toWireGameSnapshot(prev.game, v)]));
      let steps = 0;

      while (snap(engine).game.endReason === null && steps < 200) {
        const current = snap(engine);
        const pid = turnPlayer(current);
        // alternate between the deck and the discard pile, and batch every third turn
        const pool = current.game.discardPool;
        if (steps % 2 === 1 && pool.length > 0) {
          engine.dispatch(pid, "drawFromDiscard", { cardId: pool[pool.length - 1].card.id });
        } else {
          engine.dispatch(pid, "drawFromDeck");
        }
        const hand = snap(engine).game.players[pid].hand;
        engine.dispatch(pid, "discardCard", { cardId: hand[(steps + seed) % hand.length].id });
        steps++;
        if (steps % 3 === 0 && snap(engine).game.endReason === null) continue;

        const next = snap(engine, 30);
        for (const v of viewers) {
          const model = models.get(v)!;
          for (const event of eventsOf(prev, next, v)) applyEvent(model, v, event);
          const expected = toWireGameSnapshot(next.game, v);
          if (next.game.endReason === null) {
            expect(model).toEqual(expected);
          } else {
            expect({ ...model, turn_player_id: expected.turn_player_id }).toEqual(expected);
          }
        }
        prev = next;
      }

      expect(prev.game.endReason).not.toBeNull();
      expect(toWireResultPlayers(prev.game).map((p) => p.player_id)).toEqual(players);
    });
  }
});
