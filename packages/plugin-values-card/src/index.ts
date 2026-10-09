import {
  type BotStrategy,
  type CroupierConfig,
  type CroupierContext,
  type PlayerId,
  countOnly,
  custom,
} from "@edv4h/croupier-core";
import type {
  BaseCard,
  Card,
  CardId,
  ValuesCardEndReason,
  ValuesCardEndRule,
  ValuesCardResult,
  ValuesCardState,
} from "./types.js";

export type {
  BaseCard,
  Card,
  CardId,
  DiscardEntry,
  PlayerState,
  ValuesCardEndReason,
  ValuesCardEndRule,
  ValuesCardResult,
  ValuesCardState,
} from "./types.js";

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

export const HAND_SIZE = 5;

export interface ValuesCardOptions<C extends BaseCard = Card> {
  /** Theme decided before the game starts (e.g. by the host) */
  theme?: string;
  /** Card master. Defaults to DEFAULT_VALUES_CARDS (demo list). */
  cards?: C[];
  /** Timeout per turn in ms. */
  turnTimeoutMs?: number;
  /** How the game ends. Default: "deckEmpty" (renew-values-card spec). */
  endRule?: ValuesCardEndRule;
  /** End the game after this many completed turns (safety cap, e.g. when nobody draws from the deck). */
  maxTurns?: number;
  /** Extra end check evaluated after every discard. Return true to end the game. */
  shouldEnd?: (game: ValuesCardState<C>) => boolean;
  /** Strategy for bots and turn-timeout takeover. Default: valuesCardAutoPlayStrategy. */
  bot?: BotStrategy<ValuesCardState<C>>;
}

const END_REASON_TEXT: Record<ValuesCardEndReason, string> = {
  deckEmpty: "The deck ran out",
  lastRound: "All cards have been exchanged",
  maxTurns: "Turn limit reached",
  custom: "Game ended",
};

function currentPlayerOf<C extends BaseCard>(game: ValuesCardState<C>): PlayerId {
  return game.playerOrder[game.currentPlayerIndex];
}

/** Build the end-of-game result: theme and each player's final hand in hand order */
export function buildValuesCardResult<C extends BaseCard>(
  game: ValuesCardState<C>,
): ValuesCardResult<C> {
  const endReason = game.endReason ?? "custom";
  const finalHands: Record<PlayerId, C[]> = {};
  const playerResults: Record<PlayerId, { stats: { finalHand: C[] } }> = {};
  for (const pid of game.playerOrder) {
    finalHands[pid] = game.players[pid].hand.map((c) => ({ ...c }));
    playerResults[pid] = { stats: { finalHand: game.players[pid].hand.map((c) => ({ ...c })) } };
  }
  return {
    reason: END_REASON_TEXT[endReason],
    endReason,
    theme: game.theme,
    finalHands,
    playerResults,
    turnCount: game.turnCount,
    summary: Object.fromEntries(
      game.playerOrder.map((pid) => [
        pid,
        game.players[pid].hand.map((c) => ("name" in c ? (c as { name: unknown }).name : c.id)),
      ]),
    ),
  };
}

export function createValuesCardConfig<C extends BaseCard = Card>(
  options: ValuesCardOptions<C> = {},
): CroupierConfig<ValuesCardState<C>> {
  const {
    theme = "人生で大事な5つの価値観",
    cards = DEFAULT_VALUES_CARDS as unknown as C[],
    turnTimeoutMs,
    endRule = "deckEmpty",
    maxTurns,
    shouldEnd,
    bot = valuesCardAutoPlayStrategy as unknown as BotStrategy<ValuesCardState<C>>,
  } = options;

  type S = ValuesCardState<C>;

  // Custom turn order that tracks currentPlayerIndex (pure — reads from ctx.game)
  const valuesCardTurnOrder = custom<S>({
    first: (ctx) => currentPlayerOf(ctx.game),
    next: () => null, // single action per turn handled by stages
  });

  /** Decide whether the game is over after a discard */
  function endReasonAfterDiscard(game: S, deckEmptiedThisTurn: boolean): ValuesCardEndReason | null {
    if (endRule === "deckEmpty") {
      if (deckEmptiedThisTurn) return "deckEmpty";
    } else if (game.lastRoundTurnsLeft !== null && game.lastRoundTurnsLeft <= 0) {
      return "lastRound";
    }
    if (maxTurns !== undefined && game.turnCount >= maxTurns) return "maxTurns";
    if (shouldEnd?.(game)) return "custom";
    return null;
  }

  return {
    name: "values-card",

    setup: (ctx) => {
      const deck = ctx.random.shuffle([...cards]);
      const players: S["players"] = {};
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
        drawnCardId: null,
        endReason: null,
      };
    },

    actions: {
      drawFromDeck: {
        execute: (game, playerId) => {
          const card = game.deck.shift()!;
          game.players[playerId].hand.push(card);
          game.drawnCardId = card.id;
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
          const { cardId } = payload as { cardId: CardId };
          const idx = game.discardPool.findIndex((e) => e.card.id === cardId);
          const entry = game.discardPool.splice(idx, 1)[0];
          game.players[playerId].hand.push(entry.card);
          game.drawnCardId = entry.card.id;
        },
        validate: (game, playerId, payload) => {
          const cardId = (payload as { cardId?: CardId } | undefined)?.cardId;
          if (game.players[playerId].hand.length !== HAND_SIZE)
            return "Already drew a card";
          if (!game.discardPool.find((e) => e.card.id === cardId))
            return "Card not found in discard pool";
          return true;
        },
      },

      discardCard: {
        execute: (game, playerId, payload) => {
          const { cardId } = payload as { cardId: CardId };
          const hand = game.players[playerId].hand;
          const idx = hand.findIndex((c) => c.id === cardId);
          const card = hand.splice(idx, 1)[0];
          game.discardPool.push({ card, discardedBy: playerId });
          game.drawnCardId = null;

          // Advance to next player
          game.currentPlayerIndex =
            (game.currentPlayerIndex + 1) % game.playerOrder.length;
          game.turnCount++;

          const deckEmptiedThisTurn = game.deck.length === 0 && game.lastRoundTurnsLeft === null;
          if (endRule === "lastRound") {
            // Start last round countdown after the turn that emptied the deck
            if (deckEmptiedThisTurn) {
              game.lastRoundTurnsLeft = game.playerOrder.length;
            } else if (game.lastRoundTurnsLeft !== null) {
              game.lastRoundTurnsLeft--;
            }
          }

          game.endReason = endReasonAfterDiscard(game, deckEmptiedThisTurn);
        },
        validate: (game, playerId, payload) => {
          const cardId = (payload as { cardId?: CardId } | undefined)?.cardId;
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
                // Current player has 6 cards (drew one)
                guard: (ctx) =>
                  ctx.game.players[currentPlayerOf(ctx.game)].hand.length > HAND_SIZE,
              },
            ],
          },
          waitingForDiscard: {
            allowedActions: ["discardCard"],
            always: [
              {
                target: "__done__",
                guard: (ctx) => {
                  // After discard, currentPlayerIndex has already advanced,
                  // so check that the *previous* player is back to 5 cards
                  const n = ctx.game.playerOrder.length;
                  const prevPlayer = ctx.game.playerOrder[(ctx.game.currentPlayerIndex - 1 + n) % n];
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
        guard: (ctx: CroupierContext<S>) => ctx.game.endReason !== null,
        result: (ctx: CroupierContext<S>) => buildValuesCardResult(ctx.game),
      },
    ],

    getResult: (game) => buildValuesCardResult(game),

    view: {
      playerView: (state, playerId) => {
        const gameOver = state.endReason !== null;
        const isCurrent = currentPlayerOf(state) === playerId;
        const view: any = {
          theme: state.theme,
          deckCount: countOnly(state.deck),
          discardPool: state.discardPool,
          currentPlayerIndex: state.currentPlayerIndex,
          playerOrder: state.playerOrder,
          turnCount: state.turnCount,
          lastRound: state.lastRoundTurnsLeft !== null,
          // Only the drawer knows which card came from the deck
          drawnCardId: isCurrent ? state.drawnCardId : null,
          endReason: state.endReason,
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

    bot,
  };
}

/**
 * Auto-play used for disconnected / idle players (renew-values-card spec):
 * with 5 cards, draw from the deck; then discard the card that was just drawn.
 * Never draws from the discard pool while the deck has cards. When the deck is empty
 * (only reachable with the "lastRound" rule) it takes the newest discard and gives it back.
 */
export const valuesCardAutoPlayStrategy: BotStrategy<ValuesCardState<BaseCard>> = {
  decide(playerId: PlayerId, playerView: unknown) {
    const view = playerView as any;
    const me = view.players?.[playerId];
    if (!me?.hand || view.endReason) return null;
    if (view.playerOrder[view.currentPlayerIndex] !== playerId) return null;

    const hand = me.hand as BaseCard[];

    if (hand.length > HAND_SIZE) {
      const drawn = hand.find((c) => c.id === view.drawnCardId) ?? hand[hand.length - 1];
      return { action: "discardCard", payload: { cardId: drawn.id } };
    }

    if (hand.length === HAND_SIZE) {
      if (view.deckCount > 0) return { action: "drawFromDeck" };
      const pool = view.discardPool as { card: BaseCard }[];
      if (pool.length > 0) {
        return { action: "drawFromDiscard", payload: { cardId: pool[pool.length - 1].card.id } };
      }
    }

    return null;
  },
};

/**
 * Demo bot that plays with some variety: draws from the deck (or the discard pool
 * once the deck is empty) and discards a random card.
 */
export const valuesCardRandomBotStrategy: BotStrategy<ValuesCardState<BaseCard>> = {
  decide(playerId: PlayerId, playerView: unknown) {
    const view = playerView as any;
    const me = view.players?.[playerId];
    if (!me?.hand) return null;

    const hand = me.hand as BaseCard[];

    if (hand.length > HAND_SIZE) {
      const discardIdx = Math.floor(Math.random() * hand.length);
      return { action: "discardCard", payload: { cardId: hand[discardIdx].id } };
    }

    if (hand.length === HAND_SIZE) {
      if (view.deckCount > 0) return { action: "drawFromDeck" };
      const pool = view.discardPool as { card: BaseCard }[];
      if (pool.length > 0) {
        return { action: "drawFromDiscard", payload: { cardId: pool[0].card.id } };
      }
    }

    return null;
  },
};
