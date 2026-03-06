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
  { id: "v26", name: "正義" },
  { id: "v27", name: "平和" },
  { id: "v28", name: "美しさ" },
  { id: "v29", name: "ユーモア" },
  { id: "v30", name: "冒険" },
  { id: "v31", name: "安定" },
  { id: "v32", name: "独立" },
  { id: "v33", name: "知恵" },
  { id: "v34", name: "寛容" },
  { id: "v35", name: "リーダーシップ" },
  { id: "v36", name: "共感" },
  { id: "v37", name: "効率" },
  { id: "v38", name: "品質" },
  { id: "v39", name: "柔軟性" },
  { id: "v40", name: "誇り" },
  { id: "v41", name: "素直さ" },
  { id: "v42", name: "節制" },
  { id: "v43", name: "愛情" },
  { id: "v44", name: "自律" },
  { id: "v45", name: "環境" },
  { id: "v46", name: "伝統" },
  { id: "v47", name: "革新" },
  { id: "v48", name: "奉仕" },
  { id: "v49", name: "達成感" },
  { id: "v50", name: "集中力" },
  { id: "v51", name: "直感" },
  { id: "v52", name: "誠意" },
  { id: "v53", name: "礼儀" },
  { id: "v54", name: "団結" },
  { id: "v55", name: "希望" },
  { id: "v56", name: "幸福" },
  { id: "v57", name: "調和" },
  { id: "v58", name: "粘り強さ" },
  { id: "v59", name: "感性" },
  { id: "v60", name: "合理性" },
  { id: "v61", name: "透明性" },
  { id: "v62", name: "主体性" },
  { id: "v63", name: "利他" },
  { id: "v64", name: "探求心" },
  { id: "v65", name: "遊び心" },
  { id: "v66", name: "覚悟" },
  { id: "v67", name: "受容" },
  { id: "v68", name: "シンプル" },
  { id: "v69", name: "つながり" },
  { id: "v70", name: "自然体" },
];

const HAND_SIZE = 5;

export interface ValuesCardOptions {
  theme?: string;
  cards?: Card[];
  /** Timeout per turn in ms. */
  turnTimeoutMs?: number;
}

export function createValuesCardConfig(
  options: ValuesCardOptions = {},
): CroupierConfig<ValuesCardState> {
  const { theme = "人生で大事な5つの価値観", cards = DEFAULT_VALUES_CARDS, turnTimeoutMs } =
    options;

  // Custom turn order that tracks currentPlayerIndex (pure — reads from ctx.game)
  const valuesCardTurnOrder = custom<ValuesCardState>({
    first: (ctx) => {
      return ctx.game.playerOrder[ctx.game.currentPlayerIndex];
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
        lastRoundTurnsLeft: null,
      };
    },

    actions: {
      drawFromDeck: {
        execute: (game, playerId) => {
          const card = game.deck.shift()!;
          game.players[playerId].hand.push(card);
        },
        validate: (game, playerId) => {
          if (game.deck.length === 0) return "Deck is empty";
          if (game.players[playerId].hand.length !== HAND_SIZE)
            return "Already drew a card";
          return true;
        },
      },

      drawFromDiscard: {
        execute: (game, playerId, payload) => {
          const { cardId } = payload as { cardId: string };
          const idx = game.discardPool.findIndex(
            (e) => e.card.id === cardId,
          );
          const entry = game.discardPool.splice(idx, 1)[0];
          game.players[playerId].hand.push(entry.card);
        },
        validate: (game, playerId, payload) => {
          const { cardId } = payload as { cardId: string };
          if (game.players[playerId].hand.length !== HAND_SIZE)
            return "Already drew a card";
          if (!game.discardPool.find((e) => e.card.id === cardId))
            return "Card not found in discard pool";
          return true;
        },
      },

      discardCard: {
        execute: (game, playerId, payload) => {
          const { cardId } = payload as { cardId: string };
          const hand = game.players[playerId].hand;
          const idx = hand.findIndex((c) => c.id === cardId);
          const card = hand.splice(idx, 1)[0];
          game.discardPool.push({ card, discardedBy: playerId });

          // Advance to next player
          game.currentPlayerIndex =
            (game.currentPlayerIndex + 1) % game.playerOrder.length;
          game.turnCount++;
          // Start last round countdown after the turn that emptied the deck
          if (game.deck.length === 0 && game.lastRoundTurnsLeft === null) {
            game.lastRoundTurnsLeft = game.playerOrder.length;
          } else if (game.lastRoundTurnsLeft !== null) {
            game.lastRoundTurnsLeft--;
          }
        },
        validate: (game, playerId, payload) => {
          const { cardId } = payload as { cardId: string };
          if (game.players[playerId].hand.length !== HAND_SIZE + 1)
            return "Must draw a card first";
          if (!game.players[playerId].hand.find((c) => c.id === cardId))
            return "Card not in hand";
          return true;
        },
      },
    },

    phases: {
      playerTurn: {
        turnOrder: valuesCardTurnOrder,
        turnTimeoutMs,
        stages: {
          waitingForDraw: {
            allowedActions: ["drawFromDeck", "drawFromDiscard"],
            always: [
              {
                target: "waitingForDiscard",
                guard: (ctx) => {
                  // Check if current player has 6 cards (drew one)
                  const currentPlayer =
                    ctx.game.playerOrder[ctx.game.currentPlayerIndex];
                  return ctx.game.players[currentPlayer].hand.length > HAND_SIZE;
                },
              },
            ],
          },
          waitingForDiscard: {
            allowedActions: ["discardCard"],
            always: [
              {
                target: "__done__",
                guard: (ctx) => {
                  // Check if current player is back to 5 cards
                  // Note: after discard, currentPlayerIndex has already advanced
                  // So we check the *previous* player
                  const prevIdx =
                    (ctx.game.currentPlayerIndex - 1 + ctx.game.playerOrder.length) %
                    ctx.game.playerOrder.length;
                  const prevPlayer = ctx.game.playerOrder[prevIdx];
                  return ctx.game.players[prevPlayer].hand.length === HAND_SIZE;
                },
              },
            ],
          },
        },
        initialStage: "waitingForDraw",
        transitions: [
          {
            target: "playerTurn",
            guard: () => true, // loop back
          },
        ],
      },
    },

    initialPhase: "playerTurn",

    endConditions: [
      {
        guard: (ctx) =>
          ctx.game.lastRoundTurnsLeft !== null &&
          ctx.game.lastRoundTurnsLeft <= 0,
        result: (ctx) => ({
          reason: "All cards have been exchanged",
          summary: Object.fromEntries(
            ctx.game.playerOrder.map((pid: PlayerId) => [
              pid,
              ctx.game.players[pid].hand.map((c: Card) => c.name),
            ]),
          ),
        }),
      },
    ],

    view: {
      playerView: (state, playerId) => {
        const gameOver =
          state.lastRoundTurnsLeft !== null &&
          state.lastRoundTurnsLeft <= 0;
        const view: any = {
          theme: state.theme,
          deckCount: countOnly(state.deck),
          discardPool: state.discardPool,
          currentPlayerIndex: state.currentPlayerIndex,
          playerOrder: state.playerOrder,
          turnCount: state.turnCount,
          lastRound: state.lastRoundTurnsLeft !== null,
          players: {},
        };

        for (const [pid, pState] of Object.entries(state.players)) {
          if (pid === playerId || gameOver) {
            // Show own hand always; show all hands when game is over
            view.players[pid] = { hand: pState.hand };
          } else {
            // Other players' hands are hidden — only show count
            view.players[pid] = { handCount: pState.hand.length };
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
