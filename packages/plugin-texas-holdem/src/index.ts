import {
  type BotStrategy,
  type CroupierConfig,
  type EngineState,
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
}

/** Get active player indices (not folded, not allIn) */
function getActivePlayers(state: HoldemState): number[] {
  return state.playerOrder
    .map((pid, idx) => ({ pid, idx }))
    .filter(({ pid }) => state.players[pid].status === "active")
    .map(({ idx }) => idx);
}

/** Get remaining players (active or allIn) */
function getRemainingPlayers(state: HoldemState): PlayerId[] {
  return state.playerOrder.filter(
    (pid) => state.players[pid].status !== "folded",
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

  if (activePlayers.length <= 1) return true;

  // All active players must have acted and bet the same amount
  return activePlayers.every(
    (pid) =>
      state.players[pid].hasActed &&
      state.players[pid].currentBet === state.currentHighestBet,
  );
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

/** Simple Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Reset state for a new hand (next round) */
function startNewHand(state: HoldemState): void {
  // Move dealer button
  state.dealerPosition =
    (state.dealerPosition + 1) % state.playerOrder.length;

  // Fresh deck
  state.deck = shuffle(createDeck());
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
      p.status = "folded"; // busted players sit out
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
  } = options;

  const holdemTurnOrder = custom({
    first: (ctx) => {
      const state = ctx.state as HoldemState;
      const activePlayers = getActivePlayers(state);
      if (activePlayers.length === 0) return state.playerOrder[0];
      return state.playerOrder[state.currentPlayerIndex];
    },
    next: (ctx) => {
      const state = ctx.state as HoldemState;
      if (isBettingRoundComplete(state)) return null;
      // Find next active player after the one who just acted
      const lastIdx = ctx.lastPlayer
        ? state.playerOrder.indexOf(ctx.lastPlayer)
        : state.currentPlayerIndex;
      const nextIdx = nextActivePlayerIndex(state, lastIdx);
      if (nextIdx === -1) return null;
      state.currentPlayerIndex = nextIdx;
      return state.playerOrder[nextIdx];
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
        execute: (state, playerId) => {
          state.players[playerId].status = "folded";
          state.players[playerId].hasActed = true;
        },
        validate: (state, playerId) => {
          if (state.players[playerId].status !== "active")
            return "Cannot fold — not active";
          return true;
        },
      },

      check: {
        execute: (state, playerId) => {
          state.players[playerId].hasActed = true;
        },
        validate: (state, playerId) => {
          if (state.players[playerId].status !== "active")
            return "Cannot check — not active";
          if (state.players[playerId].currentBet < state.currentHighestBet)
            return "Cannot check — must call or raise";
          return true;
        },
      },

      call: {
        execute: (state, playerId) => {
          const player = state.players[playerId];
          const diff = state.currentHighestBet - player.currentBet;
          const amount = Math.min(diff, player.stack);
          player.stack -= amount;
          player.currentBet += amount;
          state.pot += amount;
          player.hasActed = true;

          if (player.stack === 0) {
            player.status = "allIn";
          }
        },
        validate: (state, playerId) => {
          if (state.players[playerId].status !== "active")
            return "Cannot call — not active";
          if (state.players[playerId].currentBet >= state.currentHighestBet)
            return "Nothing to call";
          return true;
        },
      },

      raise: {
        execute: (state, playerId, payload) => {
          const { amount } = payload as { amount: number };
          const player = state.players[playerId];
          const totalBet = amount;
          const diff = totalBet - player.currentBet;
          player.stack -= diff;
          state.pot += diff;
          player.currentBet = totalBet;
          state.currentHighestBet = totalBet;
          player.hasActed = true;
          state.lastRaiserIndex = state.playerOrder.indexOf(playerId);

          // Reset hasActed for other active players
          for (const pid of state.playerOrder) {
            if (pid !== playerId && state.players[pid].status === "active") {
              state.players[pid].hasActed = false;
            }
          }

          if (player.stack === 0) {
            player.status = "allIn";
          }
        },
        validate: (state, playerId, payload) => {
          if (state.players[playerId].status !== "active")
            return "Cannot raise — not active";
          const { amount } = payload as { amount: number };
          if (amount <= state.currentHighestBet)
            return "Raise must be higher than current bet";
          const diff = amount - state.players[playerId].currentBet;
          if (diff > state.players[playerId].stack)
            return "Not enough chips";
          return true;
        },
      },

      allIn: {
        execute: (state, playerId) => {
          const player = state.players[playerId];
          const amount = player.stack;
          state.pot += amount;
          player.currentBet += amount;
          player.stack = 0;
          player.status = "allIn";
          player.hasActed = true;

          if (player.currentBet > state.currentHighestBet) {
            state.currentHighestBet = player.currentBet;
            state.lastRaiserIndex = state.playerOrder.indexOf(playerId);
            // Reset hasActed for other active players
            for (const pid of state.playerOrder) {
              if (
                pid !== playerId &&
                state.players[pid].status === "active"
              ) {
                state.players[pid].hasActed = false;
              }
            }
          }
        },
        validate: (state, playerId) => {
          if (state.players[playerId].status !== "active")
            return "Cannot go all-in — not active";
          if (state.players[playerId].stack <= 0) return "No chips to bet";
          return true;
        },
      },
    },

    phases: {
      preFlop: {
        allowedActions: ["fold", "check", "call", "raise", "allIn"],
        turnOrder: holdemTurnOrder,
        onEnter: (state) => {
          // Post blinds
          const sbIdx =
            (state.dealerPosition + 1) % state.playerOrder.length;
          const bbIdx =
            (state.dealerPosition + 2) % state.playerOrder.length;

          const sbPlayer = state.players[state.playerOrder[sbIdx]];
          const sbAmount = Math.min(smallBlind, sbPlayer.stack);
          sbPlayer.stack -= sbAmount;
          sbPlayer.currentBet = sbAmount;
          state.pot += sbAmount;

          const bbPlayer = state.players[state.playerOrder[bbIdx]];
          const bbAmount = Math.min(bigBlind, bbPlayer.stack);
          bbPlayer.stack -= bbAmount;
          bbPlayer.currentBet = bbAmount;
          state.pot += bbAmount;

          state.currentHighestBet = bbAmount;

          // First to act is after BB
          state.currentPlayerIndex =
            (bbIdx + 1) % state.playerOrder.length;
        },
        next: (state) => {
          if (!isBettingRoundComplete(state)) return null;
          // Skip straight to showdown if only 1 player remains
          if (getRemainingPlayers(state).length <= 1) return "showdown";
          return "flop";
        },
      },

      flop: {
        allowedActions: ["fold", "check", "call", "raise", "allIn"],
        turnOrder: holdemTurnOrder,
        onEnter: (state) => {
          dealCommunityCards(state, 3);
          resetBettingRound(state);
          // First to act is after dealer
          state.currentPlayerIndex = nextActivePlayerIndex(
            state,
            state.dealerPosition,
          );
        },
        next: (state) => {
          if (!isBettingRoundComplete(state)) return null;
          if (getRemainingPlayers(state).length <= 1) return "showdown";
          return "turn";
        },
      },

      turn: {
        allowedActions: ["fold", "check", "call", "raise", "allIn"],
        turnOrder: holdemTurnOrder,
        onEnter: (state) => {
          dealCommunityCards(state, 1);
          resetBettingRound(state);
          state.currentPlayerIndex = nextActivePlayerIndex(
            state,
            state.dealerPosition,
          );
        },
        next: (state) => {
          if (!isBettingRoundComplete(state)) return null;
          if (getRemainingPlayers(state).length <= 1) return "showdown";
          return "river";
        },
      },

      river: {
        allowedActions: ["fold", "check", "call", "raise", "allIn"],
        turnOrder: holdemTurnOrder,
        onEnter: (state) => {
          dealCommunityCards(state, 1);
          resetBettingRound(state);
          state.currentPlayerIndex = nextActivePlayerIndex(
            state,
            state.dealerPosition,
          );
        },
        next: (state) => {
          if (!isBettingRoundComplete(state)) return null;
          if (getRemainingPlayers(state).length <= 1) return "showdown";
          return "showdown";
        },
      },

      showdown: {
        allowedActions: [],
        onEnter: (state) => {
          resolveShowdown(state);
          // Prepare next hand (if game continues)
          if (playersWithChips(state).length > 1) {
            startNewHand(state);
          }
        },
        next: (state) => {
          // If multiple players still have chips, start next hand
          if (playersWithChips(state).length > 1) {
            return "preFlop";
          }
          return null; // game ends via endIf
        },
      },
    },

    initialPhase: "preFlop",

    endIf: (state) => {
      // Game ends when only 1 player has chips
      const alive = playersWithChips(state);
      if (alive.length <= 1 && state.pot === 0) {
        return {
          winner: alive[0] ?? state.playerOrder[0],
          reason: alive.length === 1
            ? `${alive[0]} wins — last player standing`
            : "All players eliminated",
        };
      }
      return null;
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
