import {
  type BotStrategy,
  type CroupierConfig,
  type CroupierContext,
  type EngineState,
  type PlayerId,
  countOnly,
  custom,
} from "@croupier/core";
import type {
  BaseCard,
  Card,
  CardId,
  ValuesCardEndMode,
  ValuesCardEndReason,
  ValuesCardResult,
  ValuesCardState,
} from "./types.js";

export type {
  BaseCard,
  Card,
  CardId,
  DiscardEntry,
  DrawnCard,
  PlayerState,
  ValuesCardEndMode,
  ValuesCardEndReason,
  ValuesCardResult,
  ValuesCardState,
} from "./types.js";

/** Default set of value cards (demo use; production masters are injected via `cards`) */
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
  /** Card master. Defaults to DEFAULT_VALUES_CARDS. */
  cards?: C[];
  /** Timeout per turn in ms. */
  turnTimeoutMs?: number;
  /** How the game ends when the deck runs out. Default: `deckEmpty` (renew spec). */
  endMode?: ValuesCardEndMode;
  /** End the game after this many completed turns. */
  maxTurns?: number;
  /**
   * Extra end condition, checked after every completed turn (i.e. after a discard).
   * Return true to end the game.
   */
  shouldEnd?: (game: ValuesCardState<C>) => boolean;
  /** Strategy used for bot players and turn-timeout takeover. Default: valuesCardAutoPlayStrategy */
  bot?: BotStrategy<ValuesCardState<C>>;
}

function getCardId(payload: unknown): CardId | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const { cardId } = payload as { cardId?: unknown };
  return typeof cardId === "string" || typeof cardId === "number"
    ? cardId
    : undefined;
}

/** Whether the current player has finished their turn (no card drawn yet). */
function isTurnBoundary(game: ValuesCardState<BaseCard>): boolean {
  return game.drawnCard === null && game.turnCount > 0;
}

/** Determine whether the game is over, and why. Pure — derived from state only. */
function getEndReason<C extends BaseCard>(
  game: ValuesCardState<C>,
  shouldEnd?: (game: ValuesCardState<C>) => boolean,
): ValuesCardEndReason | null {
  if (!isTurnBoundary(game)) return null;
  if (game.endMode === "deckEmpty" && game.deck.length === 0) return "deckEmpty";
  if (
    game.endMode === "lastRound" &&
    game.lastRoundTurnsLeft !== null &&
    game.lastRoundTurnsLeft <= 0
  ) {
    return "lastRound";
  }
  if (game.maxTurns !== null && game.turnCount >= game.maxTurns) return "maxTurns";
  if (shouldEnd?.(game)) return "custom";
  return null;
}

const END_REASON_TEXT: Record<ValuesCardEndReason, string> = {
  deckEmpty: "The deck has run out",
  lastRound: "All cards have been exchanged",
  maxTurns: "Turn limit reached",
  custom: "End condition met",
};

function buildResult<C extends BaseCard>(
  game: ValuesCardState<C>,
  endReason: ValuesCardEndReason,
): ValuesCardResult<C> {
  const finalHands: Record<PlayerId, C[]> = {};
  const playerResults: ValuesCardResult<C>["playerResults"] = {};
  const summary: Record<PlayerId, string[]> = {};
  for (const pid of game.playerOrder) {
    const hand = game.players[pid].hand;
    finalHands[pid] = hand.map((c) => ({ ...c }));
    summary[pid] = hand.map((c) => c.name);
    playerResults[pid] = {
      stats: {
        finalHand: hand.map((c) => c.name),
        finalHandCardIds: hand.map((c) => c.id),
      },
    };
  }
  return {
    reason: END_REASON_TEXT[endReason],
    endReason,
    theme: game.theme,
    finalHands,
    turnCount: game.turnCount,
    playerResults,
    summary,
  };
}

export function createValuesCardConfig<C extends BaseCard = Card>(
  options: ValuesCardOptions<C> = {},
): CroupierConfig<ValuesCardState<C>> {
  const {
    theme = "人生で大事な5つの価値観",
    cards = DEFAULT_VALUES_CARDS as unknown as C[],
    turnTimeoutMs,
    endMode = "deckEmpty",
    maxTurns,
    shouldEnd,
    bot = valuesCardAutoPlayStrategy as BotStrategy<ValuesCardState<C>>,
  } = options;

  type S = ValuesCardState<C>;

  // Custom turn order that tracks currentPlayerIndex (pure — reads from ctx.game)
  const valuesCardTurnOrder = custom<S>({
    first: (ctx) => {
      return ctx.game.playerOrder[ctx.game.currentPlayerIndex];
    },
    next: () => null, // single action per turn handled by stages
  });

  const draw = (game: S, playerId: PlayerId, card: C, source: "deck" | "discard") => {
    game.players[playerId].hand.push(card);
    game.drawnCard = { cardId: card.id, source };
  };

  return {
    name: "values-card",

    setup: (ctx) => {
      if (cards.length < ctx.players.length * HAND_SIZE) {
        throw new Error(
          `Values Card needs at least ${ctx.players.length * HAND_SIZE} cards for ${ctx.players.length} players (got ${cards.length})`,
        );
      }
      const deck = ctx.random.shuffle([...cards]);
      const players: Record<PlayerId, { hand: C[] }> = {};
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
        endMode,
        maxTurns: maxTurns ?? null,
        drawnCard: null,
        lastRoundTurnsLeft: null,
      };
    },

    actions: {
      drawFromDeck: {
        execute: (game, playerId) => {
          draw(game, playerId, game.deck.shift()!, "deck");
        },
        validate: (game) => {
          if (game.drawnCard !== null) return "Already drew a card";
          if (game.deck.length === 0) return "Deck is empty";
          return true;
        },
      },

      drawFromDiscard: {
        execute: (game, playerId, payload) => {
          const cardId = getCardId(payload);
          const idx = game.discardPool.findIndex((e) => e.card.id === cardId);
          const entry = game.discardPool.splice(idx, 1)[0];
          draw(game, playerId, entry.card, "discard");
        },
        validate: (game, _playerId, payload) => {
          if (game.drawnCard !== null) return "Already drew a card";
          const cardId = getCardId(payload);
          if (cardId === undefined) return "cardId is required";
          if (!game.discardPool.some((e) => e.card.id === cardId))
            return "Card not found in discard pool";
          return true;
        },
      },

      discardCard: {
        execute: (game, playerId, payload) => {
          const cardId = getCardId(payload);
          const hand = game.players[playerId].hand;
          const idx = hand.findIndex((c) => c.id === cardId);
          const card = hand.splice(idx, 1)[0];
          game.discardPool.push({ card, discardedBy: playerId });

          // Advance to next player
          game.drawnCard = null;
          game.currentPlayerIndex =
            (game.currentPlayerIndex + 1) % game.playerOrder.length;
          game.turnCount++;
          if (game.endMode === "lastRound") {
            // Start last round countdown after the turn that emptied the deck
            if (game.deck.length === 0 && game.lastRoundTurnsLeft === null) {
              game.lastRoundTurnsLeft = game.playerOrder.length;
            } else if (game.lastRoundTurnsLeft !== null) {
              game.lastRoundTurnsLeft--;
            }
          }
        },
        validate: (game, playerId, payload) => {
          if (game.drawnCard === null) return "Must draw a card first";
          const cardId = getCardId(payload);
          if (cardId === undefined) return "cardId is required";
          if (!game.players[playerId].hand.some((c) => c.id === cardId))
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
                guard: (ctx) => ctx.game.drawnCard !== null,
              },
            ],
          },
          waitingForDiscard: {
            allowedActions: ["discardCard"],
            always: [
              {
                target: "__done__",
                guard: (ctx) => ctx.game.drawnCard === null,
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
        guard: (ctx: CroupierContext<S>) => getEndReason(ctx.game, shouldEnd) !== null,
        result: (ctx: CroupierContext<S>) =>
          buildResult(ctx.game, getEndReason(ctx.game, shouldEnd)!),
      },
    ],

    view: {
      playerView: (state, playerId) => {
        const gameOver = getEndReason(state, shouldEnd) !== null;
        const isCurrent =
          state.playerOrder[state.currentPlayerIndex] === playerId;
        const view: any = {
          theme: state.theme,
          deckCount: countOnly(state.deck),
          discardPool: state.discardPool,
          currentPlayerIndex: state.currentPlayerIndex,
          playerOrder: state.playerOrder,
          turnCount: state.turnCount,
          endMode: state.endMode,
          maxTurns: state.maxTurns,
          lastRound: state.lastRoundTurnsLeft !== null,
          // Only the drawing player knows which card they drew
          drawnCard: isCurrent ? state.drawnCard : null,
          gameOver,
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
 * Auto-play strategy matching renew-values-card (used on disconnect / turn timeout):
 * - With 5 cards: draw from the deck (never from the discard pool)
 * - With 6 cards: discard the card drawn this turn
 *
 * If the deck is empty (only possible in `lastRound` mode), it takes back the most
 * recently discarded card and discards it again, leaving every hand unchanged.
 */
export const valuesCardAutoPlayStrategy: BotStrategy<ValuesCardState<BaseCard>> = {
  decide(playerId: PlayerId, playerView: unknown, _engineState: EngineState) {
    const view = playerView as any;
    const hand = view.players?.[playerId]?.hand as BaseCard[] | undefined;
    if (!hand) return null;

    if (hand.length > HAND_SIZE) {
      const drawnId: CardId | undefined = view.drawnCard?.cardId;
      const target =
        drawnId !== undefined && hand.some((c) => c.id === drawnId)
          ? drawnId
          : hand[hand.length - 1].id; // drawn cards are appended
      return { action: "discardCard", payload: { cardId: target } };
    }

    if (hand.length === HAND_SIZE) {
      if (view.deckCount > 0) {
        return { action: "drawFromDeck" };
      }
      const pool = view.discardPool as { card: BaseCard }[];
      if (pool.length > 0) {
        return {
          action: "drawFromDiscard",
          payload: { cardId: pool[pool.length - 1].card.id },
        };
      }
    }

    return null;
  },
};

/**
 * Simple bot for demo play: draws from the deck (or the discard pool once the deck
 * is empty) and discards a random card.
 */
export const valuesCardRandomBotStrategy: BotStrategy<ValuesCardState<BaseCard>> = {
  decide(playerId: PlayerId, playerView: unknown, _engineState: EngineState) {
    const view = playerView as any;
    const hand = view.players?.[playerId]?.hand as BaseCard[] | undefined;
    if (!hand) return null;

    // If hand has 6 cards, need to discard
    if (hand.length > HAND_SIZE) {
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
      const pool = view.discardPool as { card: BaseCard }[];
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
