import {
  type BotStrategy,
  type CroupierConfig,
  type CroupierContext,
  type EngineState,
  type GameResult,
  type PlayerId,
  SIMULTANEOUS,
  custom,
} from "@croupier/core";
import type { PlanningPokerState, Role, Task } from "./types.js";

export type {
  PlanningPokerState,
  PlayerState,
  Role,
  RoundHistory,
  Task,
} from "./types.js";

export const FIBONACCI_DECK = [
  "0",
  "1",
  "2",
  "3",
  "5",
  "8",
  "13",
  "20",
  "40",
  "?",
  "☕",
];

export interface PlanningPokerOptions {
  deck?: string[];
  facilitators?: PlayerId[];
  facilitatorCanVote?: boolean;
  /** Timeout for the voting phase in ms. All voters must vote within this time. */
  votingTimeoutMs?: number;
}

function computePlanningPokerResult(ctx: CroupierContext<PlanningPokerState>): GameResult {
  const game = ctx.game;
  // Build per-task estimates
  const taskMap: Record<string, {
    taskTitle: string;
    finalEstimate: string | null;
    totalRounds: number;
    votes: Array<{ round: number; votes: Record<string, string> }>;
  }> = {};

  for (const rh of game.roundHistory) {
    if (!taskMap[rh.taskId]) {
      taskMap[rh.taskId] = {
        taskTitle: rh.taskTitle,
        finalEstimate: null,
        totalRounds: 0,
        votes: [],
      };
    }
    taskMap[rh.taskId].totalRounds = Math.max(taskMap[rh.taskId].totalRounds, rh.round);
    taskMap[rh.taskId].votes.push({ round: rh.round, votes: rh.votes });
  }

  // If there's a current final estimate, assign to the current task
  if (game.currentTask && game.finalEstimate && taskMap[game.currentTask.id]) {
    taskMap[game.currentTask.id].finalEstimate = game.finalEstimate;
  }

  // Build player results
  const playerResults: Record<string, { stats: Record<string, unknown> }> = {};
  for (const [pid, pState] of Object.entries(game.players)) {
    const totalVotes = game.roundHistory.filter((rh) => rh.votes[pid] !== undefined).length;
    playerResults[pid] = {
      stats: {
        role: pState.role,
        totalVotes,
      },
    };
  }

  const uniqueTaskIds = [...new Set(game.roundHistory.map((rh) => rh.taskId))];

  return {
    reason: "Session ended",
    playerResults,
    taskEstimates: taskMap,
    totalTasks: uniqueTaskIds.length,
    totalRounds: game.roundHistory.length,
  };
}

export function createPlanningPokerConfig(
  options: PlanningPokerOptions = {},
): CroupierConfig<PlanningPokerState> {
  const { deck = FIBONACCI_DECK, facilitators = [], facilitatorCanVote = false, votingTimeoutMs } = options;

  return {
    name: "planning-poker",

    setup: (ctx) => {
      const players: Record<PlayerId, { role: Role; selectedCard: string | null }> = {};
      for (const p of ctx.players) {
        players[p] = {
          role: facilitators.includes(p) ? "facilitator" : "voter",
          selectedCard: null,
        };
      }

      return {
        currentTask: null,
        deck,
        players,
        playerOrder: ctx.players,
        revealedCards: null,
        finalEstimate: null,
        roundHistory: [],
        roundNumber: 0,
        facilitatorCanVote,
        sessionEnded: false,
      };
    },

    onPlayerJoin: (game, playerId, ctx) => {
      // idleフェーズ（タスク未選択）なら即voterとして参加、それ以外はobserver
      const isIdle = ctx.game.currentTask === null;
      game.players[playerId] = { role: isIdle ? "voter" : "observer", selectedCard: null };
      game.playerOrder.push(playerId);
    },

    actions: {
      selectTask: {
        execute: (game, _playerId, payload) => {
          const task = payload as Task;
          game.currentTask = task;
          game.revealedCards = null;
          game.finalEstimate = null;
          game.roundNumber = 0;
          // Reset all selections
          for (const p of Object.values(game.players)) {
            p.selectedCard = null;
          }
        },
        validate: (game, playerId) => {
          if (game.players[playerId].role !== "facilitator")
            return "Only facilitator can select tasks";
          return true;
        },
        unrestricted: true,
      },

      startVoting: {
        execute: (game) => {
          game.revealedCards = null;
          game.roundNumber++;
          for (const p of Object.values(game.players)) {
            p.selectedCard = null;
          }
        },
        validate: (game, playerId) => {
          if (game.players[playerId].role !== "facilitator")
            return "Only facilitator can start voting";
          if (!game.currentTask) return "No task selected";
          return true;
        },
        unrestricted: true,
      },

      vote: {
        execute: (game, playerId, payload) => {
          const { card } = payload as { card: string };
          game.players[playerId].selectedCard = card;
        },
        validate: (game, playerId, payload) => {
          if (game.players[playerId].role === "observer")
            return "Observers cannot vote";
          if (game.players[playerId].role !== "voter" && !game.facilitatorCanVote)
            return "Facilitators cannot vote";
          const { card } = payload as { card: string };
          if (!game.deck.includes(card)) return "Invalid card value";
          return true;
        },
      },

      reveal: {
        execute: (game) => {
          const revealed: Record<PlayerId, string> = {};
          for (const [pid, pState] of Object.entries(game.players)) {
            const isVoter = pState.role === "voter" || (pState.role === "facilitator" && game.facilitatorCanVote);
            if (isVoter && pState.selectedCard !== null) {
              revealed[pid] = pState.selectedCard;
            }
          }
          game.revealedCards = revealed;

          // Record history
          if (game.currentTask) {
            game.roundHistory.push({
              taskId: game.currentTask.id,
              taskTitle: game.currentTask.title,
              round: game.roundNumber,
              votes: { ...revealed },
            });
          }
        },
        validate: (game, playerId) => {
          if (game.players[playerId].role !== "facilitator")
            return "Only facilitator can reveal cards";
          // Check all voting participants have voted
          const votingParticipants = Object.entries(game.players).filter(
            ([, p]) => p.role === "voter" || (p.role === "facilitator" && game.facilitatorCanVote),
          );
          const allVoted = votingParticipants.every(([, p]) => p.selectedCard !== null);
          if (!allVoted) return "Not all voters have voted";
          return true;
        },
        unrestricted: true,
      },

      recordEstimate: {
        execute: (game, _playerId, payload) => {
          const { estimate } = payload as { estimate: string };
          game.finalEstimate = estimate;
        },
        validate: (game, playerId) => {
          if (game.players[playerId].role !== "facilitator")
            return "Only facilitator can record estimates";
          if (!game.revealedCards) return "Cards have not been revealed";
          return true;
        },
        unrestricted: true,
      },

      resetForNextTask: {
        execute: (game) => {
          game.currentTask = null;
          game.revealedCards = null;
          game.finalEstimate = null;
          game.roundNumber = 0;
          for (const p of Object.values(game.players)) {
            p.selectedCard = null;
          }
        },
        validate: (game, playerId) => {
          if (game.players[playerId].role !== "facilitator")
            return "Only facilitator can reset";
          return true;
        },
        unrestricted: true,
      },

      toggleFacilitatorVote: {
        execute: (game) => {
          game.facilitatorCanVote = !game.facilitatorCanVote;
          // Reset facilitator's selected card when disabling
          if (!game.facilitatorCanVote) {
            for (const p of Object.values(game.players)) {
              if (p.role === "facilitator") {
                p.selectedCard = null;
              }
            }
          }
        },
        validate: (game, playerId) => {
          if (game.players[playerId].role !== "facilitator")
            return "Only facilitator can toggle voting";
          return true;
        },
        unrestricted: true,
      },

      endSession: {
        execute: (game) => {
          game.sessionEnded = true;
        },
        validate: (game, playerId) => {
          if (game.players[playerId].role !== "facilitator")
            return "Only facilitator can end session";
          return true;
        },
        unrestricted: true,
      },
    },

    phases: {
      idle: {
        onEnter: (game) => {
          for (const p of Object.values(game.players)) {
            if (p.role === "observer") p.role = "voter";
          }
        },
        allowedActions: ["selectTask", "toggleFacilitatorVote", "endSession"],
        always: [
          { target: "discussion", guard: (ctx) => ctx.game.currentTask !== null },
        ],
      },
      discussion: {
        allowedActions: ["startVoting", "toggleFacilitatorVote", "endSession"],
        always: [
          {
            target: "voting",
            guard: (ctx) => ctx.game.roundNumber > 0 && !ctx.game.revealedCards,
          },
        ],
      },
      voting: {
        allowedActions: ["vote", "reveal", "endSession"],
        turnOrder: SIMULTANEOUS,
        turnTimeoutMs: votingTimeoutMs,
        always: [
          { target: "evaluation", guard: (ctx) => ctx.game.revealedCards !== null },
        ],
      },
      evaluation: {
        allowedActions: ["recordEstimate", "startVoting", "endSession"],
        always: [
          { target: "consensus", guard: (ctx) => ctx.game.finalEstimate !== null },
          {
            target: "voting",
            guard: (ctx) => ctx.game.roundNumber > 0 && !ctx.game.revealedCards,
          },
        ],
      },
      consensus: {
        allowedActions: ["resetForNextTask", "endSession"],
        always: [
          { target: "idle", guard: (ctx) => ctx.game.currentTask === null },
        ],
      },
    },

    initialPhase: "idle",

    endConditions: [
      {
        guard: (ctx) => ctx.game.sessionEnded,
        result: (ctx) => computePlanningPokerResult(ctx),
      },
    ],

    getResult: (game, ctx) => computePlanningPokerResult(ctx),

    roles: {
      facilitator: {},
      voter: {},
      observer: {},
    },

    view: {
      playerView: (state, playerId) => {
        const view: any = {
          currentTask: state.currentTask,
          deck: state.deck,
          playerOrder: state.playerOrder,
          revealedCards: state.revealedCards,
          finalEstimate: state.finalEstimate,
          roundNumber: state.roundNumber,
          facilitatorCanVote: state.facilitatorCanVote,
          players: {},
        };

        for (const [pid, pState] of Object.entries(state.players)) {
          view.players[pid] = {
            role: pState.role,
            // In voting phase, hide other players' selections (unless revealed)
            selectedCard:
              pid === playerId || state.revealedCards
                ? pState.selectedCard
                : pState.selectedCard !== null
                  ? "selected"
                  : null,
          };
        }

        return view;
      },
    },

    bot: planningPokerBotStrategy,

    logMask: (entry, viewerPlayerId, game) => {
      if (entry.action === "vote" && entry.playerId !== viewerPlayerId && game.revealedCards === null) {
        return { ...entry, payload: undefined };
      }
      return entry;
    },
  };
}

const planningPokerBotStrategy: BotStrategy<PlanningPokerState> = {
  decide(playerId: PlayerId, playerView: unknown, engineState: EngineState) {
    const view = playerView as any;
    const me = view.players?.[playerId];
    if (!me) return null;

    const numericCards = (view.deck as string[]).filter(
      (c: string) => c !== "?" && c !== "☕",
    );

    if (me.role === "facilitator") {
      // Facilitator: auto-progress the flow
      if (!view.currentTask) {
        return {
          action: "selectTask",
          payload: { id: `task-${Date.now()}`, title: "Auto Task" },
        };
      }
      if (view.roundNumber === 0) {
        return { action: "startVoting" };
      }
      // If facilitator can vote and hasn't voted yet, vote first
      if (view.facilitatorCanVote && me.selectedCard === null && view.roundNumber > 0 && !view.revealedCards) {
        const card =
          numericCards[Math.floor(Math.random() * numericCards.length)] ?? "5";
        return { action: "vote", payload: { card } };
      }
      if (view.revealedCards) {
        if (!view.finalEstimate) {
          // Pick the most common vote as the estimate
          const votes = Object.values(view.revealedCards) as string[];
          const pick = votes[0] ?? numericCards[3] ?? "5";
          return { action: "recordEstimate", payload: { estimate: pick } };
        }
        return { action: "resetForNextTask" };
      }
      // Check if all voting participants have voted to reveal
      const votingParticipants = Object.entries(view.players as Record<string, any>).filter(
        ([, p]) => p.role === "voter" || (p.role === "facilitator" && view.facilitatorCanVote),
      );
      const allVoted = votingParticipants.every(([, p]) => p.selectedCard !== null);
      if (allVoted) {
        return { action: "reveal" };
      }
      return null;
    }

    // Voter: pick a random numeric card
    if (me.selectedCard === null && view.currentTask && view.roundNumber > 0) {
      const card =
        numericCards[Math.floor(Math.random() * numericCards.length)] ?? "5";
      return { action: "vote", payload: { card } };
    }

    return null;
  },
};
