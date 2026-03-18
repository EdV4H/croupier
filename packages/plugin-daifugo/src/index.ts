import {
  type BotDecision,
  type BotStrategy,
  type CroupierConfig,
  type EngineState,
  type PlayerId,
  SIMULTANEOUS,
  countOnly,
  custom,
  maskArray,
} from "@croupier/core";
import {
  beatsCurrentPile,
  classifyCards,
  createDeck,
  findAllValidPlays,
  findDiamondThree,
  getBestCards,
  isJoker,
  isValidPlay,
} from "./cards.js";
import {
  assignRanks,
  checkCapitalFall,
  checkElevenBack,
  checkFiveSkip,
  checkNineReverse,
  checkRestrictedFinish,
  checkSevenPass,
  checkSpadeThreeReturn,
  checkSuitLock,
  checkTenDiscard,
  getExchangePairs,
  isEightCut,
  isRevolutionPlay,
  scoreForPosition,
} from "./rules.js";
import type { Card, DaifugoRules, DaifugoState, PlayedCards, PlayerState } from "./types.js";
import { DEFAULT_RULES } from "./types.js";

export type {
  Card,
  CardRank,
  DaifugoRank,
  DaifugoRules,
  DaifugoState,
  PlayType,
  PlayedCards,
  PlayerState,
  Suit,
} from "./types.js";
export { DEFAULT_RULES } from "./types.js";
export {
  beatsCurrentPile,
  classifyCards,
  createDeck,
  findAllValidPlays,
  findDiamondThree,
  getBestCards,
  getCardStrength,
  isValidPlay,
} from "./cards.js";
export {
  assignRanks,
  checkCapitalFall,
  checkElevenBack,
  checkFiveSkip,
  checkNineReverse,
  checkRestrictedFinish,
  checkSevenPass,
  checkSpadeThreeReturn,
  checkSuitLock,
  checkTenDiscard,
  getExchangePairs,
  isEightCut,
  isRevolutionPlay,
  scoreForPosition,
} from "./rules.js";
import { getCardStrength } from "./cards.js";

export interface DaifugoOptions {
  maxRounds?: number;
  turnTimeoutMs?: number;
  rules?: Partial<DaifugoRules>;
}

/** Get active (not finished) players. */
function getActivePlayers(state: DaifugoState): PlayerId[] {
  return state.playerOrder.filter((pid) => state.players[pid].finishOrder === null);
}

/** Get the next player index in play direction, skipping finished players. */
function nextActiveIndex(state: DaifugoState, fromIndex: number, skip: number = 0): number {
  const len = state.playerOrder.length;
  let idx = fromIndex;
  let skipped = 0;
  for (let i = 0; i < len * 2; i++) {
    idx = (idx + state.playDirection + len) % len;
    const pid = state.playerOrder[idx];
    if (state.players[pid].finishOrder !== null) continue;
    if (skipped < skip) {
      skipped++;
      continue;
    }
    return idx;
  }
  return fromIndex;
}

/** Clear the trick (field). */
function clearTrick(state: DaifugoState): void {
  state.currentPile = null;
  state.lastPlayedBy = null;
  state.passedPlayers = [];
  state.trickSuitLock = null;
  state.trickElevenBack = false;
}

/** Check if the round is over (all but one finished). */
function isRoundOver(state: DaifugoState): boolean {
  const active = getActivePlayers(state);
  return active.length <= 1;
}

/** Deal cards for a new round. */
function dealCards(state: DaifugoState, shuffledDeck: Card[]): void {
  const total = state.playerOrder.length;
  const cardsPerPlayer = Math.floor(shuffledDeck.length / total);
  const remainder = shuffledDeck.length % total;

  let idx = 0;
  for (const pid of state.playerOrder) {
    state.players[pid].hand = shuffledDeck.slice(idx, idx + cardsPerPlayer);
    idx += cardsPerPlayer;
  }
  state.extraCards = shuffledDeck.slice(idx);
}

export function createDaifugoConfig(
  options: DaifugoOptions = {},
): CroupierConfig<DaifugoState> {
  const {
    maxRounds = 5,
    turnTimeoutMs,
    rules: rulesOverride,
  } = options;

  const rules: DaifugoRules = { ...DEFAULT_RULES, ...rulesOverride };

  const daifugoTurnOrder = custom<DaifugoState>({
    first: (ctx) => {
      const active = getActivePlayers(ctx.game);
      if (active.length === 0) return ctx.game.playerOrder[0];
      return ctx.game.playerOrder[ctx.game.currentPlayerIndex];
    },
    next: (ctx) => {
      const active = getActivePlayers(ctx.game);
      if (active.length <= 1) return null;

      // 8-cut / spade-3 return: same player continues on empty field
      if (ctx.game.samePlayerNext) {
        ctx.game.samePlayerNext = false;
        return ctx.game.playerOrder[ctx.game.currentPlayerIndex];
      }

      // 5-skip: skip N players
      if (ctx.game.skipCount > 0) {
        const skip = ctx.game.skipCount;
        ctx.game.skipCount = 0;
        const newIdx = nextActiveIndex(ctx.game, ctx.game.currentPlayerIndex, skip);
        ctx.game.currentPlayerIndex = newIdx;
        return ctx.game.playerOrder[newIdx];
      }

      // Check if all active players except lastPlayedBy passed (trick ends)
      if (ctx.game.currentPile) {
        const others = active.filter((pid) => pid !== ctx.game.lastPlayedBy);
        const allOthersPassed = others.every((pid) => ctx.game.passedPlayers.includes(pid));
        if (allOthersPassed && others.length > 0 && ctx.game.lastPlayedBy) {
          clearTrick(ctx.game);
          const lastIdx = ctx.game.playerOrder.indexOf(ctx.game.lastPlayedBy);
          ctx.game.currentPlayerIndex = lastIdx;
          return ctx.game.lastPlayedBy;
        }
      }

      // Find next active, un-passed player
      const len = ctx.game.playerOrder.length;
      let idx = ctx.game.currentPlayerIndex;
      for (let i = 0; i < len; i++) {
        idx = (idx + ctx.game.playDirection + len) % len;
        const pid = ctx.game.playerOrder[idx];
        if (ctx.game.players[pid].finishOrder !== null) continue;
        if (ctx.game.passedPlayers.includes(pid)) continue;
        ctx.game.currentPlayerIndex = idx;
        return pid;
      }
      return null;
    },
  });

  return {
    name: "daifugo",

    setup: (ctx) => {
      const deck = ctx.random.shuffle(createDeck());
      const players: Record<PlayerId, PlayerState> = {};
      for (const pid of ctx.players) {
        players[pid] = {
          hand: [],
          rank: null,
          finishOrder: null,
          passed: false,
          score: 0,
        };
      }

      const state: DaifugoState = {
        rules,
        players,
        playerOrder: [...ctx.players],
        currentPlayerIndex: 0,
        playDirection: 1,
        currentPile: null,
        lastPlayedBy: null,
        passedPlayers: [],
        trickSuitLock: null,
        trickElevenBack: false,
        roundNumber: 1,
        maxRounds,
        isRevolution: false,
        finishCount: 0,
        finishedPlayers: [],
        extraCards: [],
        exchangeGiven: {},
        exchangePending: false,
        previousRanks: null,
        pendingAction: null,
        samePlayerNext: false,
        skipCount: 0,
      };

      dealCards(state, deck);

      // First round: diamond 3 holder goes first
      const d3Holder = findDiamondThree(state.players);
      if (d3Holder) {
        state.currentPlayerIndex = state.playerOrder.indexOf(d3Holder);
      }

      return state;
    },

    actions: {
      playCards: {
        execute: (game, playerId, payload) => {
          const { cardIds } = payload as { cardIds: string[] };
          const player = game.players[playerId];
          const cards = cardIds.map((id) => player.hand.find((c) => c.id === id)!);

          // Determine effective revolution state (considering 11-back within trick)
          const effectiveRevolution = game.trickElevenBack ? !game.isRevolution : game.isRevolution;

          const play = classifyCards(cards, effectiveRevolution, game.rules.sequence)!;

          // 1. Remove cards from hand
          player.hand = player.hand.filter((c) => !cardIds.includes(c.id));

          // 2. Set pile
          const previousPile = game.currentPile;
          game.currentPile = play;
          game.lastPlayedBy = playerId;
          game.passedPlayers = [];

          // 3. Suit lock check
          if (game.rules.suitLock && previousPile) {
            const lockSuit = checkSuitLock(play, previousPile, game.rules);
            if (lockSuit) {
              game.trickSuitLock = lockSuit;
            } else if (game.trickSuitLock) {
              // If suit lock was active but new card doesn't match, it's already validated
            }
          }

          // 4. 11-back check
          if (checkElevenBack(cards, game.rules)) {
            game.trickElevenBack = true;
          }

          // 5. Revolution check (pure quad only)
          if (isRevolutionPlay(cards, game.rules)) {
            game.isRevolution = !game.isRevolution;
          }

          // 6. 8-cut check
          let eightCutTriggered = false;
          if (isEightCut(cards, game.rules)) {
            clearTrick(game);
            game.samePlayerNext = true;
            eightCutTriggered = true;
          }

          // 7. Spade 3 return check
          if (!eightCutTriggered && previousPile && checkSpadeThreeReturn(play, previousPile, game.rules)) {
            clearTrick(game);
            game.samePlayerNext = true;
          }

          // 8. Check finish
          if (player.hand.length === 0) {
            // Restricted finish check
            if (checkRestrictedFinish(cards, game.rules)) {
              // Penalty: force to last place
              player.finishOrder = game.playerOrder.length;
              game.finishCount++;
              game.finishedPlayers.push(playerId);
            } else {
              game.finishCount++;
              player.finishOrder = game.finishCount;
              game.finishedPlayers.push(playerId);
            }
          }

          // 9. 5-skip
          const skipCount = checkFiveSkip(cards, game.rules);
          if (skipCount > 0) {
            game.skipCount = skipCount;
          }

          // 10. 9-reverse
          if (checkNineReverse(cards, game.rules)) {
            game.playDirection = (game.playDirection * -1) as 1 | -1;
          }

          // 11. 7-pass
          const sevenCount = checkSevenPass(cards, game.rules);
          if (sevenCount > 0 && player.hand.length > 0) {
            game.pendingAction = { type: "sevenPass", count: sevenCount, playerId };
          }

          // 12. 10-discard
          const tenCount = checkTenDiscard(cards, game.rules);
          if (tenCount > 0 && player.hand.length > 0) {
            game.pendingAction = { type: "tenDiscard", count: tenCount, playerId };
          }
        },

        validate: (game, playerId, payload) => {
          const { cardIds } = payload as { cardIds: string[] };
          if (!cardIds || cardIds.length === 0) return "Must play at least one card";

          const player = game.players[playerId];

          // Check all cards are in hand
          for (const id of cardIds) {
            if (!player.hand.some((c) => c.id === id)) return `Card ${id} not in hand`;
          }

          const cards = cardIds.map((id) => player.hand.find((c) => c.id === id)!);
          const effectiveRevolution = game.trickElevenBack ? !game.isRevolution : game.isRevolution;

          // Suit lock validation
          if (game.trickSuitLock && game.currentPile) {
            const nonJokers = cards.filter((c) => !isJoker(c));
            if (nonJokers.length > 0 && nonJokers.some((c) => c.suit !== game.trickSuitLock)) {
              // Allow spade-3 return even under suit lock
              if (!checkSpadeThreeReturn(
                classifyCards(cards, effectiveRevolution, game.rules.sequence)!,
                game.currentPile,
                game.rules,
              )) {
                return `Suit lock active: must play ${game.trickSuitLock}`;
              }
            }
          }

          const play = isValidPlay(cards, game.currentPile, effectiveRevolution, game.rules.sequence);
          if (!play) return "Invalid play — cards don't beat the current pile";

          return true;
        },
      },

      pass: {
        execute: (game, playerId) => {
          game.passedPlayers.push(playerId);
          // next() in turnOrder handles trick-end detection and player advancement
        },

        validate: (game, _playerId) => {
          if (game.currentPile === null) return "Cannot pass on empty field";
          return true;
        },
      },

      giveCards: {
        execute: (game, playerId, payload) => {
          const { cardIds } = payload as { cardIds: string[] };
          const player = game.players[playerId];
          const cards = cardIds.map((id) => player.hand.find((c) => c.id === id)!);

          // Remove from hand
          player.hand = player.hand.filter((c) => !cardIds.includes(c.id));
          game.exchangeGiven[playerId] = cards;

          // Check if all exchanges are complete
          const exchangePairs = getExchangePairs(game.previousRanks!);
          const allDone = exchangePairs.every(
            (pair) => game.exchangeGiven[pair.high] && game.exchangeGiven[pair.low],
          );

          if (allDone) {
            // Perform exchanges
            for (const pair of exchangePairs) {
              const highCards = game.exchangeGiven[pair.high];
              const lowCards = game.exchangeGiven[pair.low];
              // Give high's cards to low, low's cards to high
              game.players[pair.low].hand.push(...highCards);
              game.players[pair.high].hand.push(...lowCards);
            }
            game.exchangePending = false;
          }
        },

        validate: (game, playerId, payload) => {
          const { cardIds } = payload as { cardIds: string[] };
          if (!game.previousRanks) return "No exchange needed";

          const rank = game.previousRanks[playerId];
          const exchangePairs = getExchangePairs(game.previousRanks);

          // Find the exchange pair this player is in
          const pair = exchangePairs.find((p) => p.high === playerId || p.low === playerId);
          if (!pair) return "Not involved in exchange";

          const expectedCount = pair.count;
          if (cardIds.length !== expectedCount) {
            return `Must give exactly ${expectedCount} card(s)`;
          }

          // daihinmin/hinmin must give best cards
          if (rank === "daihinmin" || rank === "hinmin") {
            const effectiveRevolution = game.isRevolution;
            const bestCards = getBestCards(game.players[playerId].hand, expectedCount, effectiveRevolution);
            const bestIds = new Set(bestCards.map((c) => c.id));
            const givenIds = new Set(cardIds);
            for (const id of bestIds) {
              if (!givenIds.has(id)) return "Must give your strongest cards";
            }
          }

          // Check cards exist in hand
          for (const id of cardIds) {
            if (!game.players[playerId].hand.some((c) => c.id === id)) {
              return `Card ${id} not in hand`;
            }
          }

          return true;
        },
        unrestricted: true,
      },

      selectCardsToPass: {
        execute: (game, playerId, payload) => {
          const { cardIds } = payload as { cardIds: string[] };
          const player = game.players[playerId];
          const cards = cardIds.map((id) => player.hand.find((c) => c.id === id)!);

          // Remove from player's hand
          player.hand = player.hand.filter((c) => !cardIds.includes(c.id));

          // Give to next player
          const currentIdx = game.playerOrder.indexOf(playerId);
          const nextIdx = nextActiveIndex(game, currentIdx);
          const nextPlayer = game.playerOrder[nextIdx];
          game.players[nextPlayer].hand.push(...cards);

          game.pendingAction = null;
        },

        validate: (game, playerId, payload) => {
          const { cardIds } = payload as { cardIds: string[] };
          if (!game.pendingAction || game.pendingAction.type !== "sevenPass") {
            return "No seven-pass pending";
          }
          if (cardIds.length !== game.pendingAction.count) {
            return `Must pass exactly ${game.pendingAction.count} card(s)`;
          }
          for (const id of cardIds) {
            if (!game.players[playerId].hand.some((c) => c.id === id)) {
              return `Card ${id} not in hand`;
            }
          }
          return true;
        },
      },

      selectCardsToDiscard: {
        execute: (game, playerId, payload) => {
          const { cardIds } = payload as { cardIds: string[] };
          const player = game.players[playerId];

          // Remove from hand (discard)
          player.hand = player.hand.filter((c) => !cardIds.includes(c.id));
          game.pendingAction = null;

          // Check if player finished
          if (player.hand.length === 0) {
            game.finishCount++;
            player.finishOrder = game.finishCount;
            game.finishedPlayers.push(playerId);
          }
        },

        validate: (game, playerId, payload) => {
          const { cardIds } = payload as { cardIds: string[] };
          if (!game.pendingAction || game.pendingAction.type !== "tenDiscard") {
            return "No ten-discard pending";
          }
          if (cardIds.length !== game.pendingAction.count) {
            return `Must discard exactly ${game.pendingAction.count} card(s)`;
          }
          for (const id of cardIds) {
            if (!game.players[playerId].hand.some((c) => c.id === id)) {
              return `Card ${id} not in hand`;
            }
          }
          return true;
        },
      },
    },

    phases: {
      cardExchange: {
        turnOrder: SIMULTANEOUS as any,
        allowedActions: ["giveCards"],
        turnTimeoutMs,
        onEnter: (game) => {
          game.exchangeGiven = {};

          // Skip if round 1 or no previous ranks
          if (game.roundNumber === 1 || !game.previousRanks) {
            game.exchangePending = false;
            return;
          }

          const pairs = getExchangePairs(game.previousRanks);
          if (pairs.length === 0) {
            game.exchangePending = false;
            return;
          }

          game.exchangePending = true;
        },
        always: [
          {
            target: "playRound",
            guard: (ctx) => !ctx.game.exchangePending,
          },
        ],
      },

      playRound: {
        turnOrder: daifugoTurnOrder,
        allowedActions: ["playCards", "pass", "selectCardsToPass", "selectCardsToDiscard"],
        turnTimeoutMs,
        onEnter: (game) => {
          // Reset trick state
          clearTrick(game);
          game.playDirection = 1;
          game.finishCount = 0;
          game.finishedPlayers = [];
          game.pendingAction = null;

          // Reset player states
          for (const pid of game.playerOrder) {
            game.players[pid].finishOrder = null;
            game.players[pid].passed = false;
          }

          // Determine first player
          if (game.roundNumber === 1) {
            const d3Holder = findDiamondThree(game.players);
            if (d3Holder) {
              game.currentPlayerIndex = game.playerOrder.indexOf(d3Holder);
            }
          } else if (game.previousRanks) {
            // daihinmin goes first
            const daihinmin = Object.entries(game.previousRanks).find(
              ([, rank]) => rank === "daihinmin",
            );
            if (daihinmin) {
              game.currentPlayerIndex = game.playerOrder.indexOf(daihinmin[0]);
            }
          }
        },
        transitions: [
          {
            target: "roundEnd",
            guard: (ctx) => isRoundOver(ctx.game),
          },
        ],
      },

      roundEnd: {
        allowedActions: [],
        onEnter: (game) => {
          // Assign the last remaining player
          const active = getActivePlayers(game);
          for (const pid of active) {
            game.finishCount++;
            game.players[pid].finishOrder = game.finishCount;
            game.finishedPlayers.push(pid);
          }

          // Assign ranks
          const ranks = assignRanks(game.finishedPlayers, game.playerOrder);
          for (const [pid, rank] of Object.entries(ranks)) {
            game.players[pid].rank = rank;
          }

          // Capital fall check
          if (game.rules.capitalFall && game.previousRanks) {
            for (const pid of game.playerOrder) {
              const finishOrder = game.players[pid].finishOrder!;
              if (checkCapitalFall(pid, game.previousRanks, finishOrder - 1, game.playerOrder.length, game.rules)) {
                // Demote to daihinmin
                game.players[pid].rank = "daihinmin";
                // Find current daihinmin and promote to heimin
                for (const [otherId, r] of Object.entries(ranks)) {
                  if (otherId !== pid && r === "daihinmin") {
                    game.players[otherId].rank = "heimin";
                  }
                }
              }
            }
          }

          // Score
          for (let i = 0; i < game.finishedPlayers.length; i++) {
            const pid = game.finishedPlayers[i];
            game.players[pid].score += scoreForPosition(i, game.playerOrder.length);
          }

          // Save ranks for next round
          game.previousRanks = {};
          for (const pid of game.playerOrder) {
            game.previousRanks[pid] = game.players[pid].rank!;
          }

          game.roundNumber++;

          // Re-deal for next round (if not over)
          if (game.roundNumber <= game.maxRounds) {
            const deck: Card[] = [];
            // Collect all cards
            for (const pid of game.playerOrder) {
              deck.push(...game.players[pid].hand);
              game.players[pid].hand = [];
            }
            deck.push(...game.extraCards);
            // Shuffle and re-deal
            const shuffled = shuffleArray(deck);
            dealCards(game, shuffled);
          }
        },
        always: [
          {
            target: "cardExchange",
            guard: (ctx) => ctx.game.roundNumber <= ctx.game.maxRounds,
          },
        ],
      },
    },

    initialPhase: "playRound",

    endConditions: [
      {
        guard: (ctx) => ctx.game.roundNumber > ctx.game.maxRounds,
        result: (ctx) => {
          const sorted = [...ctx.game.playerOrder].sort(
            (a, b) => ctx.game.players[b].score - ctx.game.players[a].score,
          );

          const playerResults: Record<string, { rank: number; score: number; stats: Record<string, unknown> }> = {};
          sorted.forEach((pid, idx) => {
            const p = ctx.game.players[pid];
            playerResults[pid] = {
              rank: idx + 1,
              score: p.score,
              stats: { finalRank: p.rank, totalScore: p.score },
            };
          });

          return {
            winner: sorted[0],
            reason: "全ラウンド終了",
            playerResults,
            rankings: sorted,
          };
        },
      },
    ],

    getResult: (game) => {
      const sorted = [...game.playerOrder].sort(
        (a, b) => game.players[b].score - game.players[a].score,
      );
      const playerResults: Record<string, { rank: number; score: number; stats: Record<string, unknown> }> = {};
      sorted.forEach((pid, idx) => {
        const p = game.players[pid];
        playerResults[pid] = {
          rank: idx + 1,
          score: p.score,
          stats: { finalRank: p.rank, totalScore: p.score },
        };
      });
      return { playerResults, rankings: sorted };
    },

    view: {
      playerView: (state, playerId) => {
        const view: any = {
          rules: state.rules,
          currentPile: state.currentPile,
          lastPlayedBy: state.lastPlayedBy,
          passedPlayers: state.passedPlayers,
          isRevolution: state.isRevolution,
          trickSuitLock: state.trickSuitLock,
          trickElevenBack: state.trickElevenBack,
          roundNumber: state.roundNumber,
          maxRounds: state.maxRounds,
          finishedPlayers: state.finishedPlayers,
          playDirection: state.playDirection,
          playerOrder: state.playerOrder,
          currentPlayerIndex: state.currentPlayerIndex,
          exchangePending: state.exchangePending,
          pendingAction: state.pendingAction,
          players: {},
        };

        for (const [pid, pState] of Object.entries(state.players)) {
          view.players[pid] = {
            handCount: countOnly(pState.hand),
            hand: pid === playerId ? pState.hand : maskArray(pState.hand, { hidden: true }),
            rank: pState.rank,
            finishOrder: pState.finishOrder,
            score: pState.score,
          };
        }

        return view;
      },
    },

    bot: daifugoBotStrategy,
  };
}

/** Simple Fisher-Yates shuffle. */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Safe fallback: if the field has cards → pass, otherwise play weakest single.
 * Used when the main bot logic fails or produces an invalid play.
 */
function botFallback(hand: Card[], currentPile: PlayedCards | null, isRevolution: boolean): BotDecision {
  if (currentPile) {
    return { action: "pass" };
  }
  const sorted = [...hand].sort(
    (a, b) => getCardStrength(a.rank, isRevolution) - getCardStrength(b.rank, isRevolution),
  );
  return { action: "playCards", payload: { cardIds: [sorted[0].id] } };
}

const daifugoBotStrategy: BotStrategy<DaifugoState> = {
  decide(playerId: PlayerId, playerView: unknown, engineState: EngineState) {
    const view = playerView as any;
    const me = view.players?.[playerId];
    if (!me) return null;

    const hand = me.hand as Card[] | undefined;
    if (!hand || !Array.isArray(hand) || hand.length === 0) return null;

    try {
      return botDecideInner(playerId, view, engineState, hand);
    } catch {
      // Any unexpected error → safe fallback to avoid stall
      return botFallback(hand, view.currentPile, !!view.isRevolution);
    }
  },

  fallback(playerId: PlayerId, playerView: unknown, _engineState: EngineState) {
    const view = playerView as any;
    const me = view.players?.[playerId];
    const hand = me?.hand as Card[] | undefined;
    if (!hand || !Array.isArray(hand) || hand.length === 0) return null;
    return botFallback(hand, view.currentPile, !!view.isRevolution);
  },
};

function botDecideInner(
  playerId: PlayerId,
  view: any,
  engineState: EngineState,
  hand: Card[],
): BotDecision | null {
  const me = view.players?.[playerId];

  // Card exchange phase
  if (engineState.phase === "cardExchange") {
    if (!view.exchangePending) return null;
    const rank = me.rank;

    let count = 0;
    if (rank === "daifugo" || rank === "daihinmin") count = 2;
    else if (rank === "fugo" || rank === "hinmin") count = 1;
    if (count === 0) return null;

    const effectiveRevolution = view.isRevolution;
    if (rank === "daihinmin" || rank === "hinmin") {
      const best = getBestCards(hand, count, effectiveRevolution);
      return { action: "giveCards", payload: { cardIds: best.map((c: Card) => c.id) } };
    } else {
      const sorted = [...hand].sort(
        (a: Card, b: Card) => getCardStrength(a.rank, effectiveRevolution) - getCardStrength(b.rank, effectiveRevolution),
      );
      const weakest = sorted.slice(0, count);
      return { action: "giveCards", payload: { cardIds: weakest.map((c: Card) => c.id) } };
    }
  }

  // 7-pass pending
  if (view.pendingAction?.type === "sevenPass" && view.pendingAction.playerId === playerId) {
    const count = view.pendingAction.count;
    const toPass = hand.slice(0, Math.min(count, hand.length));
    return { action: "selectCardsToPass", payload: { cardIds: toPass.map((c: Card) => c.id) } };
  }

  // 10-discard pending
  if (view.pendingAction?.type === "tenDiscard" && view.pendingAction.playerId === playerId) {
    const count = view.pendingAction.count;
    const toDiscard = hand.slice(0, Math.min(count, hand.length));
    return { action: "selectCardsToDiscard", payload: { cardIds: toDiscard.map((c: Card) => c.id) } };
  }

  // Play round
  const currentPile = view.currentPile as PlayedCards | null;
  const baseRevolution = view.isRevolution as boolean;
  const trickElevenBack = view.trickElevenBack as boolean;
  const effectiveRevolution = trickElevenBack ? !baseRevolution : baseRevolution;
  const rulesConfig = view.rules as DaifugoRules;
  const suitLock = view.trickSuitLock as string | null;

  // Find all valid plays (considering suit lock and effective revolution)
  const validPlays = findAllValidPlays(hand, currentPile, effectiveRevolution, rulesConfig.sequence, suitLock);

  if (validPlays.length === 0) {
    return botFallback(hand, currentPile, effectiveRevolution);
  }

  // Prefer 8-cut if available
  if (rulesConfig.eightCut) {
    const eightPlay = validPlays.find((cards) => cards.some((c) => c.rank === 8));
    if (eightPlay) {
      return { action: "playCards", payload: { cardIds: eightPlay.map((c) => c.id) } };
    }
  }

  // Play weakest valid hand
  const sorted = validPlays.sort((a, b) => {
    const aStrength = Math.min(...a.map((c) => getCardStrength(c.rank, effectiveRevolution)));
    const bStrength = Math.min(...b.map((c) => getCardStrength(c.rank, effectiveRevolution)));
    return aStrength - bStrength;
  });

  const chosen = sorted[0];
  return { action: "playCards", payload: { cardIds: chosen.map((c) => c.id) } };
}
