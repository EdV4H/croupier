import {
  type BotStrategy,
  type CroupierConfig,
  type EngineState,
  type PlayerId,
  ROUND_ROBIN,
  countOnly,
  custom,
} from "@croupier/core";
import type { Card, ValuesCardState } from "./types.js";

export type { Card, DiscardEntry, PlayerState, ValuesCardState } from "./types.js";

/** Default set of value cards */
export const DEFAULT_VALUES_CARDS: Card[] = [
  { id: "v01", name: "誠実さ" },
  { id: "v02", name: "挑戦" },
  { id: "v03", name: "創造性" },
  { id: "v04", name: "成長" },
  { id: "v05", name: "感謝" },
  { id: "v06", name: "信頼" },
  { id: "v07", name: "自由" },
  { id: "v08", name: "情熱" },
  { id: "v09", name: "協力" },
  { id: "v10", name: "責任" },
  { id: "v11", name: "尊重" },
  { id: "v12", name: "公平" },
  { id: "v13", name: "思いやり" },
  { id: "v14", name: "勇気" },
  { id: "v15", name: "忍耐" },
  { id: "v16", name: "楽しさ" },
  { id: "v17", name: "好奇心" },
  { id: "v18", name: "謙虚" },
  { id: "v19", name: "多様性" },
  { id: "v20", name: "バランス" },
  { id: "v21", name: "健康" },
  { id: "v22", name: "家族" },
  { id: "v23", name: "友情" },
  { id: "v24", name: "学び" },
  { id: "v25", name: "貢献" },
];

const HAND_SIZE = 5;

export interface ValuesCardOptions {
  theme?: string;
  cards?: Card[];
}

export function createValuesCardConfig(
  options: ValuesCardOptions = {},
): CroupierConfig<ValuesCardState> {
  const { theme = "人生で大事な5つの価値観", cards = DEFAULT_VALUES_CARDS } =
    options;

  // Custom turn order that tracks currentPlayerIndex
  const valuesCardTurnOrder = custom({
    first: (ctx) => {
      const state = ctx.state as ValuesCardState;
      return state.playerOrder[state.currentPlayerIndex];
    },
    next: () => null, // single action per turn handled by stages
  });

  return {
    name: "values-card",

    setup: (ctx) => {
      const deck = ctx.random.shuffle([...cards]);
      const players: Record<PlayerId, { hand: Card[] }> = {};
      const playerOrder = [...ctx.players];

      // Deal 5 cards to each player
      for (const p of playerOrder) {
        players[p] = { hand: deck.splice(0, HAND_SIZE) };
      }

      return {
        theme,
        deck,
        discardPool: [],
        currentPlayerIndex: 0,
        players,
        playerOrder,
        turnCount: 0,
      };
    },

    actions: {
      drawFromDeck: {
        execute: (state, playerId) => {
          const card = state.deck.shift()!;
          state.players[playerId].hand.push(card);
        },
        validate: (state, playerId) => {
          if (state.deck.length === 0) return "Deck is empty";
          if (state.players[playerId].hand.length !== HAND_SIZE)
            return "Already drew a card";
          return true;
        },
      },

      drawFromDiscard: {
        execute: (state, playerId, payload) => {
          const { cardId } = payload as { cardId: string };
          const idx = state.discardPool.findIndex(
            (e) => e.card.id === cardId,
          );
          const entry = state.discardPool.splice(idx, 1)[0];
          state.players[playerId].hand.push(entry.card);
        },
        validate: (state, playerId, payload) => {
          const { cardId } = payload as { cardId: string };
          if (state.players[playerId].hand.length !== HAND_SIZE)
            return "Already drew a card";
          if (!state.discardPool.find((e) => e.card.id === cardId))
            return "Card not found in discard pool";
          return true;
        },
      },

      discardCard: {
        execute: (state, playerId, payload) => {
          const { cardId } = payload as { cardId: string };
          const hand = state.players[playerId].hand;
          const idx = hand.findIndex((c) => c.id === cardId);
          const card = hand.splice(idx, 1)[0];
          state.discardPool.push({ card, discardedBy: playerId });

          // Advance to next player
          state.currentPlayerIndex =
            (state.currentPlayerIndex + 1) % state.playerOrder.length;
          state.turnCount++;
        },
        validate: (state, playerId, payload) => {
          const { cardId } = payload as { cardId: string };
          if (state.players[playerId].hand.length !== HAND_SIZE + 1)
            return "Must draw a card first";
          if (!state.players[playerId].hand.find((c) => c.id === cardId))
            return "Card not in hand";
          return true;
        },
      },
    },

    phases: {
      playerTurn: {
        turnOrder: valuesCardTurnOrder,
        stages: {
          waitingForDraw: {
            allowedActions: ["drawFromDeck", "drawFromDiscard"],
            next: (state, ctx) => {
              // Check if current player has 6 cards (drew one)
              const currentPlayer =
                state.playerOrder[state.currentPlayerIndex];
              return state.players[currentPlayer].hand.length > HAND_SIZE
                ? "waitingForDiscard"
                : null;
            },
          },
          waitingForDiscard: {
            allowedActions: ["discardCard"],
            next: (state) => {
              // Check if current player is back to 5 cards
              // Note: after discard, currentPlayerIndex has already advanced
              // So we check the *previous* player
              const prevIdx =
                (state.currentPlayerIndex - 1 + state.playerOrder.length) %
                state.playerOrder.length;
              const prevPlayer = state.playerOrder[prevIdx];
              return state.players[prevPlayer].hand.length === HAND_SIZE
                ? "__end__"
                : null;
            },
          },
        },
        initialStage: "waitingForDraw",
        next: (state) => {
          // Check if deck is empty → go to presentation
          if (state.deck.length === 0) {
            return "presentation";
          }
          return "playerTurn"; // loop back
        },
      },

      presentation: {
        allowedActions: [],
        // No actions needed — game effectively ends here
      },
    },

    initialPhase: "playerTurn",

    endIf: (state) => {
      // Game ends when we enter presentation phase
      // (handled by phase machine — presentation has no actions)
      return null;
    },

    view: {
      playerView: (state, playerId) => {
        const view: any = {
          theme: state.theme,
          deckCount: countOnly(state.deck),
          discardPool: state.discardPool,
          currentPlayerIndex: state.currentPlayerIndex,
          playerOrder: state.playerOrder,
          turnCount: state.turnCount,
          players: {},
        };

        for (const [pid, pState] of Object.entries(state.players)) {
          if (pid === playerId) {
            view.players[pid] = { hand: pState.hand };
          } else {
            // Other players' hands are visible (values are public choices)
            // but in a real game you might want to hide them until presentation
            view.players[pid] = { hand: pState.hand };
          }
        }

        return view;
      },
    },

    bot: valuesCardBotStrategy,
  };
}

const valuesCardBotStrategy: BotStrategy<ValuesCardState> = {
  decide(playerId: PlayerId, playerView: unknown, engineState: EngineState) {
    const view = playerView as any;
    const me = view.players?.[playerId];
    if (!me) return null;

    const hand = me.hand as any[];

    // If hand has 6 cards, need to discard
    if (hand.length > HAND_SIZE) {
      // Discard a random card
      const discardIdx = Math.floor(Math.random() * hand.length);
      return {
        action: "discardCard",
        payload: { cardId: hand[discardIdx].id },
      };
    }

    // If hand has 5 cards, need to draw
    if (hand.length === HAND_SIZE) {
      if (view.deckCount > 0) {
        return { action: "drawFromDeck" };
      }
      // If deck is empty, draw from discard pool
      const pool = view.discardPool as any[];
      if (pool.length > 0) {
        return {
          action: "drawFromDiscard",
          payload: { cardId: pool[0].card.id },
        };
      }
    }

    return null;
  },
};
