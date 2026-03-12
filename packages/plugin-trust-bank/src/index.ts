import {
  type BotStrategy,
  type CroupierConfig,
  type EngineState,
  type PlayerId,
  countOnly,
  custom,
} from "@croupier/core";
import {
  applyPointChanges,
  createDeck,
  getCardDefinition,
  resolveCardEffects,
} from "./cards.js";
import {
  checkAllMissions,
  createMissionDeck,
  getMissionDefinition,
  incrementTurnsWithoutAttack,
  initMissionProgress,
  updateMissionProgress,
  updateMissionProgressForAttackReceived,
} from "./missions.js";
import type { Card, TrustBankState } from "./types.js";

export type {
  Card,
  CardCategory,
  CardDefinition,
  MissionDefinition,
  MissionDifficulty,
  MissionProgress,
  PlayerState,
  TrustBankState,
  TrustEffect,
  TurnEvent,
} from "./types.js";
export { CARD_DEFINITIONS, getCardDefinition, createDeck } from "./cards.js";
export { MISSION_DEFINITIONS, getMissionDefinition, BONUS_BY_DIFFICULTY } from "./missions.js";

const INITIAL_TRUST_POINTS = 10;
const HAND_SIZE = 3;

export interface TrustBankOptions {
  turnTimeoutMs?: number;
}

export function createTrustBankConfig(
  options: TrustBankOptions = {},
): CroupierConfig<TrustBankState> {
  const { turnTimeoutMs } = options;

  const trustBankTurnOrder = custom<TrustBankState>({
    first: (ctx) => {
      const order = ctx.game.playerOrder;
      const idx = ctx.game.currentPlayerIndex;
      return order[idx];
    },
    next: () => null,
  });

  return {
    name: "trust-bank",

    setup: (ctx) => {
      const deck = ctx.random.shuffle(createDeck());
      const missionDeckShuffled = ctx.random.shuffle(createMissionDeck());
      const players: TrustBankState["players"] = {};
      const playerOrder = [...ctx.players];

      for (const p of playerOrder) {
        const hand = deck.splice(0, HAND_SIZE);
        const missionId = missionDeckShuffled.shift()!;
        players[p] = {
          hand,
          trustPoints: INITIAL_TRUST_POINTS,
          eliminated: false,
          mission: missionId,
          missionProgress: initMissionProgress(missionId),
        };
      }

      return {
        deck,
        players,
        playerOrder,
        currentPlayerIndex: 0,
        turnCount: 0,
        drawnCard: null,
        selectedCard: null,
        selectedTarget: null,
        turnHistory: [],
        lastCoinFlipResult: null,
        randomSeed: ctx.random.integer(0, 999999),
        missionDeck: missionDeckShuffled,
        openedMissions: {},
      };
    },

    actions: {
      selectCard: {
        execute: (game, playerId, payload, ctx) => {
          const { cardId } = payload as { cardId: string };
          const hand = game.players[playerId].hand;
          const idx = hand.findIndex((c) => c.id === cardId);
          const card = hand.splice(idx, 1)[0];
          game.selectedCard = card;
          game.selectedTarget = null;
        },
        validate: (game, playerId, payload) => {
          const { cardId } = payload as { cardId: string };
          if (!game.players[playerId].hand.find((c) => c.id === cardId))
            return "Card not in hand";
          return true;
        },
      },

      selectTarget: {
        execute: (game, playerId, payload, ctx) => {
          const { targetPlayerId } = payload as { targetPlayerId: PlayerId };
          game.selectedTarget = targetPlayerId;

          // Resolve card effects
          const card = game.selectedCard!;
          const def = getCardDefinition(card.definitionId);
          const coinFlip = ctx.game.randomSeed % 2 === 0;
          game.lastCoinFlipResult = def.special === "coinFlip" ? coinFlip : null;

          const allIds = game.playerOrder.filter((p) => !game.players[p].eliminated);
          const changes = resolveCardEffects(game, playerId, def, targetPlayerId, allIds, coinFlip);
          const eliminated = applyPointChanges(game, changes);

          // Record turn event
          const event = {
            turn: game.turnCount,
            playerId,
            cardDefinitionId: def.id,
            category: def.category,
            targetPlayerId,
          };
          game.turnHistory.push(event);

          // Update mission progress for all players
          for (const pid of game.playerOrder) {
            if (game.players[pid].eliminated && !eliminated.includes(pid)) continue;
            updateMissionProgress(game.players[pid].missionProgress, event, game, pid);
          }

          // Track attacks received for targeted player
          if (def.category === "attack" && targetPlayerId) {
            updateMissionProgressForAttackReceived(game.players[targetPlayerId].missionProgress);
          }
          // Track attacks received for "all" attacks
          if (def.category === "attack" && !def.requiresTarget) {
            for (const p of allIds) {
              if (p !== playerId) {
                updateMissionProgressForAttackReceived(game.players[p].missionProgress);
              }
            }
          }

          // Check missions
          checkAllMissions(game);

          game.selectedCard = null;
        },
        validate: (game, _playerId, payload) => {
          const { targetPlayerId } = payload as { targetPlayerId: PlayerId };
          if (!game.selectedCard) return "No card selected";
          if (!game.players[targetPlayerId]) return "Invalid target";
          if (game.players[targetPlayerId].eliminated) return "Target is eliminated";
          if (targetPlayerId === _playerId) return "Cannot target self";
          return true;
        },
      },

      confirmPlay: {
        execute: (game, playerId, _payload, ctx) => {
          const card = game.selectedCard!;
          const def = getCardDefinition(card.definitionId);
          const coinFlip = ctx.game.randomSeed % 2 === 0;
          game.lastCoinFlipResult = def.special === "coinFlip" ? coinFlip : null;

          const allIds = game.playerOrder.filter((p) => !game.players[p].eliminated);
          const changes = resolveCardEffects(game, playerId, def, null, allIds, coinFlip);
          const eliminated = applyPointChanges(game, changes);

          // Record turn event
          const event = {
            turn: game.turnCount,
            playerId,
            cardDefinitionId: def.id,
            category: def.category,
          };
          game.turnHistory.push(event);

          // Update mission progress
          for (const pid of game.playerOrder) {
            if (game.players[pid].eliminated && !eliminated.includes(pid)) continue;
            updateMissionProgress(game.players[pid].missionProgress, event, game, pid);
          }

          // Track attacks received for "all" attacks
          if (def.category === "attack" && !def.requiresTarget) {
            for (const p of allIds) {
              if (p !== playerId) {
                updateMissionProgressForAttackReceived(game.players[p].missionProgress);
              }
            }
          }

          // Check missions
          checkAllMissions(game);

          game.selectedCard = null;
        },
        validate: (game) => {
          if (!game.selectedCard) return "No card selected";
          const def = getCardDefinition(game.selectedCard.definitionId);
          if (def.requiresTarget) return "Card requires a target";
          return true;
        },
      },

      drawCard: {
        execute: (game, playerId) => {
          const card = game.deck.shift()!;
          const def = getCardDefinition(card.definitionId);

          if (def.category === "crisis") {
            // Withdrawal card: set drawnCard for forced play
            game.drawnCard = card;
          } else {
            // Normal card: add to hand
            game.players[playerId].hand.push(card);
            game.drawnCard = null;
          }
        },
        validate: (game) => {
          if (game.deck.length === 0) return "Deck is empty";
          return true;
        },
      },

      playWithdrawal: {
        execute: (game, playerId, payload, ctx) => {
          const card = game.drawnCard!;
          const def = getCardDefinition(card.definitionId);

          let targetId: PlayerId | null = null;
          if (def.requiresTarget && payload) {
            targetId = (payload as { targetPlayerId: PlayerId }).targetPlayerId;
          }

          const coinFlip = ctx.game.randomSeed % 2 === 0;
          game.lastCoinFlipResult = null;

          const allIds = game.playerOrder.filter((p) => !game.players[p].eliminated);
          const changes = resolveCardEffects(game, playerId, def, targetId, allIds, coinFlip);
          const eliminated = applyPointChanges(game, changes);

          // Record turn event
          const event = {
            turn: game.turnCount,
            playerId,
            cardDefinitionId: def.id,
            category: def.category,
            targetPlayerId: targetId ?? undefined,
          };
          game.turnHistory.push(event);

          // Update mission progress
          for (const pid of game.playerOrder) {
            if (game.players[pid].eliminated && !eliminated.includes(pid)) continue;
            updateMissionProgress(game.players[pid].missionProgress, event, game, pid);
          }

          // Track attacks received for withdrawal with target
          if (targetId && def.effects.some((e) => e.target === "target" && e.points < 0)) {
            updateMissionProgressForAttackReceived(game.players[targetId].missionProgress);
          }

          // Check missions
          checkAllMissions(game);

          game.drawnCard = null;
        },
        validate: (game, playerId, payload) => {
          if (!game.drawnCard) return "No withdrawal card drawn";
          const def = getCardDefinition(game.drawnCard.definitionId);
          if (def.requiresTarget) {
            if (!payload) return "Target required";
            const { targetPlayerId } = payload as { targetPlayerId: PlayerId };
            if (!game.players[targetPlayerId]) return "Invalid target";
            if (game.players[targetPlayerId].eliminated) return "Target is eliminated";
            if (targetPlayerId === playerId) return "Cannot target self";
          }
          return true;
        },
      },
    },

    phases: {
      playerTurn: {
        turnOrder: trustBankTurnOrder,
        turnTimeoutMs,
        stages: {
          selectCard: {
            allowedActions: ["selectCard"],
            always: [
              {
                target: "selectTarget",
                guard: (ctx) => {
                  if (!ctx.game.selectedCard) return false;
                  const def = getCardDefinition(ctx.game.selectedCard.definitionId);
                  return def.requiresTarget;
                },
              },
              {
                target: "resolveCard",
                guard: (ctx) => {
                  if (!ctx.game.selectedCard) return false;
                  const def = getCardDefinition(ctx.game.selectedCard.definitionId);
                  return !def.requiresTarget;
                },
              },
            ],
          },
          selectTarget: {
            allowedActions: ["selectTarget"],
            always: [
              {
                target: "drawCard",
                guard: (ctx) => ctx.game.selectedCard === null,
              },
            ],
          },
          resolveCard: {
            allowedActions: ["confirmPlay"],
            always: [
              {
                target: "drawCard",
                guard: (ctx) => ctx.game.selectedCard === null,
              },
            ],
          },
          drawCard: {
            allowedActions: ["drawCard"],
            always: [
              {
                target: "withdrawalForced",
                guard: (ctx) => ctx.game.drawnCard !== null,
              },
              {
                target: "__done__",
                guard: (ctx) => {
                  const currentPlayer =
                    ctx.game.playerOrder[ctx.game.currentPlayerIndex];
                  return (
                    ctx.game.drawnCard === null &&
                    ctx.game.players[currentPlayer].hand.length === HAND_SIZE
                  );
                },
              },
            ],
          },
          withdrawalForced: {
            allowedActions: ["playWithdrawal"],
            always: [
              {
                target: "drawCard",
                guard: (ctx) => ctx.game.drawnCard === null,
              },
            ],
          },
        },
        initialStage: "selectCard",
        onExit: (game) => {
          // End-of-turn: increment turnsWithoutAttack for players not attacked this turn
          const currentPlayer = game.playerOrder[game.currentPlayerIndex];
          const thisTurnEvents = game.turnHistory.filter(
            (e) => e.turn === game.turnCount && e.playerId === currentPlayer,
          );
          const attackedPlayers = new Set<PlayerId>();
          for (const ev of thisTurnEvents) {
            if (ev.category === "attack" && ev.targetPlayerId) {
              attackedPlayers.add(ev.targetPlayerId);
            }
            // "all" attacks
            if (ev.category === "attack" && !ev.targetPlayerId) {
              for (const p of game.playerOrder) {
                if (p !== ev.playerId && !game.players[p].eliminated) {
                  attackedPlayers.add(p);
                }
              }
            }
          }

          for (const pid of game.playerOrder) {
            if (game.players[pid].eliminated) continue;
            if (!attackedPlayers.has(pid)) {
              incrementTurnsWithoutAttack(game.players[pid].missionProgress);
            }
          }

          // Re-check missions after turnsWithoutAttack update
          checkAllMissions(game);

          // Advance to next player
          const alive = game.playerOrder.filter(
            (p) => !game.players[p].eliminated,
          );
          if (alive.length > 1) {
            let nextIdx = (game.currentPlayerIndex + 1) % game.playerOrder.length;
            while (game.players[game.playerOrder[nextIdx]].eliminated) {
              nextIdx = (nextIdx + 1) % game.playerOrder.length;
            }
            game.currentPlayerIndex = nextIdx;
          }
          game.turnCount++;
          game.selectedCard = null;
          game.selectedTarget = null;
          game.drawnCard = null;
          game.lastCoinFlipResult = null;
        },
        transitions: [
          {
            target: "playerTurn",
            guard: () => true,
          },
        ],
      },
    },

    initialPhase: "playerTurn",

    endConditions: [
      {
        // Sole survivor wins
        guard: (ctx) => {
          const alive = ctx.game.playerOrder.filter(
            (p) => !ctx.game.players[p].eliminated,
          );
          return alive.length <= 1;
        },
        result: (ctx) => {
          const alive = ctx.game.playerOrder.filter(
            (p) => !ctx.game.players[p].eliminated,
          );
          return {
            winner: alive.length === 1 ? alive[0] : null,
            reason: "Last player standing",
          };
        },
        priority: 0,
      },
      {
        // Deck empty: highest points wins
        guard: (ctx) => ctx.game.deck.length === 0,
        result: (ctx) => {
          const alive = ctx.game.playerOrder.filter(
            (p) => !ctx.game.players[p].eliminated,
          );
          const maxPts = Math.max(
            ...alive.map((p) => ctx.game.players[p].trustPoints),
          );
          const winners = alive.filter(
            (p) => ctx.game.players[p].trustPoints === maxPts,
          );
          return {
            winner: winners.length === 1 ? winners[0] : winners,
            draw: winners.length > 1,
            reason: "Deck exhausted",
          };
        },
        priority: 100,
      },
    ],

    view: {
      playerView: (state, playerId) => {
        const view: Record<string, unknown> = {
          deckCount: countOnly(state.deck),
          playerOrder: state.playerOrder,
          currentPlayerIndex: state.currentPlayerIndex,
          turnCount: state.turnCount,
          lastCoinFlipResult: state.lastCoinFlipResult,
          openedMissions: state.openedMissions,
          players: {} as Record<string, unknown>,
        };

        const currentPlayer = state.playerOrder[state.currentPlayerIndex];

        for (const [pid, pState] of Object.entries(state.players)) {
          const playerView: Record<string, unknown> = {
            trustPoints: pState.trustPoints,
            eliminated: pState.eliminated,
            handCount: pState.hand.length,
          };

          // Show own hand with card definitions
          if (pid === playerId) {
            playerView.hand = pState.hand.map((c) => {
              const def = getCardDefinition(c.definitionId);
              return {
                ...c,
                name: def.name,
                description: def.description,
                category: def.category,
                requiresTarget: def.requiresTarget,
              };
            });
            // Show own mission (if not yet completed)
            if (!pState.missionProgress.completed) {
              const mDef = getMissionDefinition(pState.mission);
              playerView.mission = {
                id: mDef.id,
                name: mDef.name,
                description: mDef.description,
                difficulty: mDef.difficulty,
                bonus: mDef.bonus,
              };
            }
          } else {
            // Other players' missions are hidden unless opened
            playerView.mission = state.openedMissions[pid]
              ? state.openedMissions[pid]
              : "???";
          }

          (view.players as Record<string, unknown>)[pid] = playerView;
        }

        // Turn history with card names (public info)
        view.turnHistory = state.turnHistory.map((ev) => {
          const def = getCardDefinition(ev.cardDefinitionId);
          return {
            turn: ev.turn,
            playerId: ev.playerId,
            cardName: def.name,
            category: def.category,
            description: def.description,
            targetPlayerId: ev.targetPlayerId,
          };
        });

        // Show drawnCard only to current player (enriched with definition)
        if (playerId === currentPlayer && state.drawnCard) {
          const dDef = getCardDefinition(state.drawnCard.definitionId);
          view.drawnCard = {
            ...state.drawnCard,
            name: dDef.name,
            description: dDef.description,
            category: dDef.category,
            requiresTarget: dDef.requiresTarget,
          };
        }

        // Show selectedCard only to current player (enriched with definition)
        if (playerId === currentPlayer && state.selectedCard) {
          const sDef = getCardDefinition(state.selectedCard.definitionId);
          view.selectedCard = {
            ...state.selectedCard,
            name: sDef.name,
            description: sDef.description,
            category: sDef.category,
            requiresTarget: sDef.requiresTarget,
          };
        }

        return view;
      },
    },

    bot: trustBankBotStrategy,
  };
}

const trustBankBotStrategy: BotStrategy<TrustBankState> = {
  decide(playerId: PlayerId, playerView: unknown, engineState: EngineState) {
    const view = playerView as any;
    const me = view.players?.[playerId];
    if (!me) return null;

    const stage = engineState.stage;

    switch (stage) {
      case "selectCard": {
        const hand = me.hand as Card[];
        if (!hand || hand.length === 0) return null;
        const idx = Math.floor(Math.random() * hand.length);
        return { action: "selectCard", payload: { cardId: hand[idx].id } };
      }

      case "selectTarget": {
        const targets = (view.playerOrder as PlayerId[]).filter(
          (p) => p !== playerId && !view.players[p].eliminated,
        );
        if (targets.length === 0) return null;
        const target = targets[Math.floor(Math.random() * targets.length)];
        return {
          action: "selectTarget",
          payload: { targetPlayerId: target },
        };
      }

      case "resolveCard":
        return { action: "confirmPlay" };

      case "drawCard":
        return { action: "drawCard" };

      case "withdrawalForced": {
        // Check if withdrawal requires target
        const drawnCard = view.drawnCard as Card | undefined;
        if (drawnCard) {
          const def = getCardDefinition(drawnCard.definitionId);
          if (def.requiresTarget) {
            const targets = (view.playerOrder as PlayerId[]).filter(
              (p) => p !== playerId && !view.players[p].eliminated,
            );
            if (targets.length === 0) return { action: "playWithdrawal" };
            const target = targets[Math.floor(Math.random() * targets.length)];
            return {
              action: "playWithdrawal",
              payload: { targetPlayerId: target },
            };
          }
        }
        return { action: "playWithdrawal" };
      }

      default:
        return null;
    }
  },
};
