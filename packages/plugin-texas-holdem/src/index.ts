import {
  type BotStrategy,
  type CroupierConfig,
  type EngineState,
  type GameRandom,
  type PlayerId,
  countOnly,
  custom,
  maskArray,
} from "@croupier/core";
import { compareHands, createDeck, evaluateBestHand } from "./hands.js";
import type { HoldemState, PlayerStatus } from "./types.js";

export type {
  Card,
  HandEvaluation,
  HandRank,
  HoldemState,
  PlayerState,
  PlayerStatus,
  Rank,
  Suit,
} from "./types.js";
export { compareHands, createDeck, evaluateBestHand } from "./hands.js";

export interface HoldemOptions {
  smallBlind?: number;
  bigBlind?: number;
  startingStack?: number;
  /** Timeout per turn in ms for all betting phases. */
  turnTimeoutMs?: number;
}

/** Get active player indices (not folded, not allIn) */
function getActivePlayers(state: HoldemState): number[] {
  return state.playerOrder
    .map((pid, idx) => ({ pid, idx }))
    .filter(({ pid }) => state.players[pid].status === "active")
    .map(({ idx }) => idx);
}

/** Get remaining players (active or allIn — excludes folded and busted) */
function getRemainingPlayers(state: HoldemState): PlayerId[] {
  const s = state.players;
  return state.playerOrder.filter(
    (pid) => s[pid].status === "active" || s[pid].status === "allIn",
  );
}

/** Find the next active player from a position */
function nextActivePlayerIndex(state: HoldemState, from: number): number {
  const len = state.playerOrder.length;
  for (let i = 1; i <= len; i++) {
    const idx = (from + i) % len;
    if (state.players[state.playerOrder[idx]].status === "active") {
      return idx;
    }
  }
  return -1;
}

/** Check if betting round is complete */
function isBettingRoundComplete(state: HoldemState): boolean {
  const activePlayers = state.playerOrder.filter(
    (pid) => state.players[pid].status === "active",
  );

  // No active players left (all folded/allIn/busted)
  if (activePlayers.length === 0) return true;

  // Only one active player and no other remaining (all others folded/busted) — auto-win
  const remaining = getRemainingPlayers(state);
  if (remaining.length <= 1) return true;

  // All active players must have acted and bet the same amount
  return activePlayers.every(
    (pid) =>
      state.players[pid].hasActed &&
      state.players[pid].currentBet === state.currentHighestBet,
  );
}

/** Check if no more betting is possible (all remaining players are allIn or only one active) */
function shouldSkipToShowdown(state: HoldemState): boolean {
  const activePlayers = state.playerOrder.filter(
    (pid) => state.players[pid].status === "active",
  );
  const remaining = getRemainingPlayers(state);
  // Skip if multiple remaining but no active players (all are allIn)
  if (remaining.length >= 2 && activePlayers.length === 0) return true;
  // Skip if only 1 active player and they've already matched the bet
  if (
    remaining.length >= 2 &&
    activePlayers.length === 1 &&
    state.players[activePlayers[0]].hasActed &&
    state.players[activePlayers[0]].currentBet === state.currentHighestBet
  ) {
    return true;
  }
  return false;
}

/** Deal community cards for a phase */
function dealCommunityCards(state: HoldemState, count: number): void {
  for (let i = 0; i < count; i++) {
    if (state.deck.length > 0) {
      state.communityCards.push(state.deck.shift()!);
    }
  }
}

/** Reset for a new betting round */
function resetBettingRound(state: HoldemState): void {
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    p.currentBet = 0;
    p.hasActed = false;
  }
  state.currentHighestBet = 0;
  state.lastRaiserIndex = null;
}

/** Reset state for a new hand (next round) */
function startNewHand(state: HoldemState, random: GameRandom): void {
  // Move dealer button to next player with chips
  state.dealerPosition = nextPlayerWithChipsIndex(state, state.dealerPosition);

  // Fresh deck
  state.deck = random.shuffle(createDeck());
  state.communityCards = [];
  state.pot = 0;
  state.currentHighestBet = 0;
  state.lastRaiserIndex = null;

  // Reset all players, deal new hole cards
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    if (p.stack > 0) {
      p.status = "active";
    } else {
      p.status = "busted";
    }
    p.holeCards = [];
    p.currentBet = 0;
    p.hasActed = false;
  }

  // Deal 2 hole cards to active players
  for (const pid of state.playerOrder) {
    if (state.players[pid].status === "active") {
      state.players[pid].holeCards = [state.deck.shift()!, state.deck.shift()!];
    }
  }
}

/** Count players who still have chips */
function playersWithChips(state: HoldemState): PlayerId[] {
  return state.playerOrder.filter((pid) => state.players[pid].stack > 0);
}

/** Find next player index with chips (stack > 0) from a position, wrapping around */
function nextPlayerWithChipsIndex(state: HoldemState, from: number): number {
  const len = state.playerOrder.length;
  for (let i = 1; i <= len; i++) {
    const idx = (from + i) % len;
    if (state.players[state.playerOrder[idx]].stack > 0) {
      return idx;
    }
  }
  return -1;
}

/** Determine the winner and distribute pot */
function resolveShowdown(state: HoldemState): {
  winners: PlayerId[];
  reason: string;
} {
  const remaining = getRemainingPlayers(state);

  if (remaining.length === 1) {
    state.players[remaining[0]].stack += state.pot;
    state.pot = 0;
    return {
      winners: remaining,
      reason: "All other players folded",
    };
  }

  // Evaluate hands
  const evaluations = remaining.map((pid) => ({
    pid,
    hand: evaluateBestHand([
      ...state.players[pid].holeCards,
      ...state.communityCards,
    ]),
  }));

  // Sort by hand strength (descending)
  evaluations.sort((a, b) => compareHands(b.hand, a.hand));

  // Find all players tied for best hand
  const best = evaluations[0];
  const winners = evaluations
    .filter((e) => compareHands(e.hand, best.hand) === 0)
    .map((e) => e.pid);

  // Split pot among winners
  const share = Math.floor(state.pot / winners.length);
  const remainder = state.pot % winners.length;
  for (let i = 0; i < winners.length; i++) {
    state.players[winners[i]].stack += share + (i < remainder ? 1 : 0);
  }
  state.pot = 0;

  return {
    winners,
    reason: `Best hand: ${best.hand.rank}`,
  };
}

export function createTexasHoldemConfig(
  options: HoldemOptions = {},
): CroupierConfig<HoldemState> {
  const {
    smallBlind = 1,
    bigBlind = 2,
    startingStack = 100,
    turnTimeoutMs,
  } = options;

  // Pure turn order: reads currentPlayerIndex from ctx.game, no mutation
  const holdemTurnOrder = custom<HoldemState>({
    first: (ctx) => {
      const activePlayers = getActivePlayers(ctx.game);
      if (activePlayers.length === 0) return ctx.game.playerOrder[0];
      return ctx.game.playerOrder[ctx.game.currentPlayerIndex];
    },
    next: (ctx) => {
      if (isBettingRoundComplete(ctx.game)) return null;
      // Find next active player after the one who just acted
      const lastIdx = ctx.lastPlayer
        ? ctx.game.playerOrder.indexOf(ctx.lastPlayer)
        : ctx.game.currentPlayerIndex;
      const nextIdx = nextActivePlayerIndex(ctx.game, lastIdx);
      if (nextIdx === -1) return null;
      // Update currentPlayerIndex in game state (via action execute)
      ctx.game.currentPlayerIndex = nextIdx;
      return ctx.game.playerOrder[nextIdx];
    },
  });

  return {
    name: "texas-holdem",

    setup: (ctx) => {
      const deck = ctx.random.shuffle(createDeck());
      const players: Record<PlayerId, HoldemState["players"][string]> = {};
      for (const pid of ctx.players) {
        players[pid] = {
          stack: startingStack,
          holeCards: [],
          currentBet: 0,
          status: "active",
          hasActed: false,
        };
      }

      // Deal 2 hole cards to each player
      for (const pid of ctx.players) {
        players[pid].holeCards = [deck.shift()!, deck.shift()!];
      }

      const state: HoldemState = {
        pot: 0,
        currentHighestBet: 0,
        communityCards: [],
        deck,
        dealerPosition: 0,
        currentPlayerIndex: 0,
        players,
        playerOrder: [...ctx.players],
        smallBlind,
        bigBlind,
        lastRaiserIndex: null,
      };

      return state;
    },

    actions: {
      fold: {
        execute: (game, playerId) => {
          game.players[playerId].status = "folded";
          game.players[playerId].hasActed = true;
        },
        validate: (game, playerId) => {
          if (game.players[playerId].status !== "active")
            return "Cannot fold — not active";
          return true;
        },
      },

      check: {
        execute: (game, playerId) => {
          game.players[playerId].hasActed = true;
        },
        validate: (game, playerId) => {
          if (game.players[playerId].status !== "active")
            return "Cannot check — not active";
          if (game.players[playerId].currentBet < game.currentHighestBet)
            return "Cannot check — must call or raise";
          return true;
        },
      },

      call: {
        execute: (game, playerId) => {
          const player = game.players[playerId];
          const diff = game.currentHighestBet - player.currentBet;
          const amount = Math.min(diff, player.stack);
          player.stack -= amount;
          player.currentBet += amount;
          game.pot += amount;
          player.hasActed = true;

          if (player.stack === 0) {
            player.status = "allIn";
          }
        },
        validate: (game, playerId) => {
          if (game.players[playerId].status !== "active")
            return "Cannot call — not active";
          if (game.players[playerId].currentBet >= game.currentHighestBet)
            return "Nothing to call";
          return true;
        },
      },

      raise: {
        execute: (game, playerId, payload) => {
          const { amount } = payload as { amount: number };
          const player = game.players[playerId];
          const totalBet = amount;
          const diff = totalBet - player.currentBet;
          player.stack -= diff;
          game.pot += diff;
          player.currentBet = totalBet;
          game.currentHighestBet = totalBet;
          player.hasActed = true;
          game.lastRaiserIndex = game.playerOrder.indexOf(playerId);

          // Reset hasActed for other active players
          for (const pid of game.playerOrder) {
            if (pid !== playerId && game.players[pid].status === "active") {
              game.players[pid].hasActed = false;
            }
          }

          if (player.stack === 0) {
            player.status = "allIn";
          }
        },
        validate: (game, playerId, payload) => {
          if (game.players[playerId].status !== "active")
            return "Cannot raise — not active";
          const { amount } = payload as { amount: number };
          if (amount <= game.currentHighestBet)
            return "Raise must be higher than current bet";
          const diff = amount - game.players[playerId].currentBet;
          if (diff > game.players[playerId].stack)
            return "Not enough chips";
          return true;
        },
      },

      allIn: {
        execute: (game, playerId) => {
          const player = game.players[playerId];
          const amount = player.stack;
          game.pot += amount;
          player.currentBet += amount;
          player.stack = 0;
          player.status = "allIn";
          player.hasActed = true;

          if (player.currentBet > game.currentHighestBet) {
            game.currentHighestBet = player.currentBet;
            game.lastRaiserIndex = game.playerOrder.indexOf(playerId);
            // Reset hasActed for other active players
            for (const pid of game.playerOrder) {
              if (
                pid !== playerId &&
                game.players[pid].status === "active"
              ) {
                game.players[pid].hasActed = false;
              }
            }
          }
        },
        validate: (game, playerId) => {
          if (game.players[playerId].status !== "active")
            return "Cannot go all-in — not active";
          if (game.players[playerId].stack <= 0) return "No chips to bet";
          return true;
        },
      },
    },

    phases: {
      preFlop: {
        allowedActions: ["fold", "check", "call", "raise", "allIn"],
        turnOrder: holdemTurnOrder,
        turnTimeoutMs,
        onEnter: (game) => {
          // Post blinds (skip busted players)
          const sbIdx = nextPlayerWithChipsIndex(game, game.dealerPosition);
          const bbIdx = nextPlayerWithChipsIndex(game, sbIdx);

          const sbPlayer = game.players[game.playerOrder[sbIdx]];
          const sbAmount = Math.min(smallBlind, sbPlayer.stack);
          sbPlayer.stack -= sbAmount;
          sbPlayer.currentBet = sbAmount;
          game.pot += sbAmount;
          if (sbPlayer.stack === 0) {
            sbPlayer.status = "allIn";
          }

          const bbPlayer = game.players[game.playerOrder[bbIdx]];
          const bbAmount = Math.min(bigBlind, bbPlayer.stack);
          bbPlayer.stack -= bbAmount;
          bbPlayer.currentBet = bbAmount;
          game.pot += bbAmount;
          if (bbPlayer.stack === 0) {
            bbPlayer.status = "allIn";
          }

          game.currentHighestBet = bbAmount;

          // First to act is next active player after BB
          game.currentPlayerIndex = nextActivePlayerIndex(game, bbIdx);
        },
        transitions: [
          {
            target: "showdown",
            guard: (ctx) =>
              isBettingRoundComplete(ctx.game) &&
              (getRemainingPlayers(ctx.game).length <= 1 || shouldSkipToShowdown(ctx.game)),
          },
          {
            target: "flop",
            guard: (ctx) => isBettingRoundComplete(ctx.game),
          },
        ],
      },

      flop: {
        allowedActions: ["fold", "check", "call", "raise", "allIn"],
        turnOrder: holdemTurnOrder,
        turnTimeoutMs,
        onEnter: (game) => {
          dealCommunityCards(game, 3);
          resetBettingRound(game);
          game.currentPlayerIndex = nextActivePlayerIndex(
            game,
            game.dealerPosition,
          );
        },
        transitions: [
          {
            target: "showdown",
            guard: (ctx) =>
              isBettingRoundComplete(ctx.game) &&
              (getRemainingPlayers(ctx.game).length <= 1 || shouldSkipToShowdown(ctx.game)),
          },
          {
            target: "turn",
            guard: (ctx) => isBettingRoundComplete(ctx.game),
          },
        ],
      },

      turn: {
        allowedActions: ["fold", "check", "call", "raise", "allIn"],
        turnOrder: holdemTurnOrder,
        turnTimeoutMs,
        onEnter: (game) => {
          dealCommunityCards(game, 1);
          resetBettingRound(game);
          game.currentPlayerIndex = nextActivePlayerIndex(
            game,
            game.dealerPosition,
          );
        },
        transitions: [
          {
            target: "showdown",
            guard: (ctx) =>
              isBettingRoundComplete(ctx.game) &&
              (getRemainingPlayers(ctx.game).length <= 1 || shouldSkipToShowdown(ctx.game)),
          },
          {
            target: "river",
            guard: (ctx) => isBettingRoundComplete(ctx.game),
          },
        ],
      },

      river: {
        allowedActions: ["fold", "check", "call", "raise", "allIn"],
        turnOrder: holdemTurnOrder,
        turnTimeoutMs,
        onEnter: (game) => {
          dealCommunityCards(game, 1);
          resetBettingRound(game);
          game.currentPlayerIndex = nextActivePlayerIndex(
            game,
            game.dealerPosition,
          );
        },
        transitions: [
          {
            target: "showdown",
            guard: (ctx) => isBettingRoundComplete(ctx.game),
          },
        ],
      },

      showdown: {
        allowedActions: [],
        onEnter: (game, ctx) => {
          // Deal remaining community cards if needed (e.g., all players allIn)
          const needed = 5 - game.communityCards.length;
          if (needed > 0) {
            dealCommunityCards(game, needed);
          }
          resolveShowdown(game);
          // Prepare next hand (if game continues)
          if (playersWithChips(game).length > 1) {
            startNewHand(game, ctx.random);
          }
        },
        always: [
          {
            target: "preFlop",
            guard: (ctx) => playersWithChips(ctx.game).length > 1,
          },
        ],
      },
    },

    initialPhase: "preFlop",

    endConditions: [
      {
        guard: (ctx) => {
          const alive = playersWithChips(ctx.game);
          return alive.length <= 1 && ctx.game.pot === 0;
        },
        result: (ctx) => {
          const alive = playersWithChips(ctx.game);
          const winner = alive[0] ?? ctx.game.playerOrder[0];

          // Build rankings by stack (descending)
          const sorted = [...ctx.game.playerOrder].sort(
            (a, b) => ctx.game.players[b].stack - ctx.game.players[a].stack,
          );
          const rankings: PlayerId[] = sorted;

          const playerResults: Record<string, { rank: number; score: number; stats: Record<string, unknown> }> = {};
          sorted.forEach((pid, idx) => {
            const p = ctx.game.players[pid];
            playerResults[pid] = {
              rank: idx + 1,
              score: p.stack,
              stats: { finalStack: p.stack, status: p.status },
            };
          });

          return {
            winner,
            reason: alive.length === 1
              ? `${alive[0]} wins — last player standing`
              : "All players eliminated",
            playerResults,
            rankings,
          };
        },
      },
    ],

    getResult: (game, ctx) => {
      const sorted = [...game.playerOrder].sort(
        (a, b) => game.players[b].stack - game.players[a].stack,
      );
      const playerResults: Record<string, { rank: number; score: number; stats: Record<string, unknown> }> = {};
      sorted.forEach((pid, idx) => {
        const p = game.players[pid];
        playerResults[pid] = {
          rank: idx + 1,
          score: p.stack,
          stats: { finalStack: p.stack, status: p.status },
        };
      });
      return {
        playerResults,
        rankings: sorted,
      };
    },

    view: {
      playerView: (state, playerId) => {
        const view: any = {
          pot: state.pot,
          currentHighestBet: state.currentHighestBet,
          communityCards: state.communityCards,
          deckCount: countOnly(state.deck),
          dealerPosition: state.dealerPosition,
          currentPlayerIndex: state.currentPlayerIndex,
          playerOrder: state.playerOrder,
          smallBlind: state.smallBlind,
          bigBlind: state.bigBlind,
          players: {},
        };

        for (const [pid, pState] of Object.entries(state.players)) {
          view.players[pid] = {
            stack: pState.stack,
            currentBet: pState.currentBet,
            status: pState.status,
            holeCards:
              pid === playerId
                ? pState.holeCards
                : maskArray(pState.holeCards, { hidden: true }),
          };
        }

        return view;
      },
    },

    bot: holdemBotStrategy,
  };
}

const holdemBotStrategy: BotStrategy<HoldemState> = {
  decide(playerId: PlayerId, playerView: unknown, engineState: EngineState) {
    const view = playerView as any;
    const me = view.players?.[playerId];
    if (!me || me.status !== "active") return null;

    const canCheck = me.currentBet >= view.currentHighestBet;
    const r = Math.random();

    if (canCheck) {
      // No bet to match — mostly check, sometimes raise
      if (r < 0.7) return { action: "check" };
      if (r < 0.9) {
        const raiseAmount = view.currentHighestBet + view.bigBlind * 2;
        if (raiseAmount <= me.currentBet + me.stack) {
          return { action: "raise", payload: { amount: raiseAmount } };
        }
      }
      return { action: "check" };
    }

    // Must act against a bet
    if (r < 0.55) return { action: "call" };
    if (r < 0.75) {
      const raiseAmount = view.currentHighestBet + view.bigBlind * 2;
      if (raiseAmount <= me.currentBet + me.stack) {
        return { action: "raise", payload: { amount: raiseAmount } };
      }
      return { action: "call" };
    }
    if (r < 0.85) return { action: "fold" };
    return { action: "allIn" };
  },
};
