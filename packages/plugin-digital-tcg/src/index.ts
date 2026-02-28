import {
  type BotStrategy,
  type CroupierConfig,
  type EngineState,
  type PlayerId,
  countOnly,
  custom,
  maskArray,
} from "@croupier/core";
import { STARTER_DECK, createDeck } from "./cards.js";
import type { Card, Entity, TCGState } from "./types.js";

export type { Card, Entity, PlayerState, TCGState } from "./types.js";
export { STARTER_DECK, createDeck } from "./cards.js";

const INITIAL_LIFE = 20;
const INITIAL_HAND_SIZE = 3;
const MAX_MANA = 10;
const MAX_BOARD_SIZE = 5;

export interface TCGOptions {
  deck1?: Card[];
  deck2?: Card[];
  initialLife?: number;
}

export function createDigitalTCGConfig(
  options: TCGOptions = {},
): CroupierConfig<TCGState> {
  const { initialLife = INITIAL_LIFE } = options;

  // Custom turn order: always the active player
  const tcgTurnOrder = custom({
    first: (ctx) => (ctx.state as TCGState).activePlayer,
    next: () => null, // endsTurn action handles turn swap
  });

  return {
    name: "digital-tcg",

    setup: (ctx) => {
      const [p1, p2] = ctx.players;
      const deck1 = ctx.random.shuffle(
        createDeck(options.deck1 ?? STARTER_DECK, p1),
      );
      const deck2 = ctx.random.shuffle(
        createDeck(options.deck2 ?? STARTER_DECK, p2),
      );

      const players: Record<PlayerId, TCGState["players"][string]> = {
        [p1]: {
          life: initialLife,
          maxMana: 0,
          currentMana: 0,
          deck: deck1.slice(INITIAL_HAND_SIZE),
          hand: deck1.slice(0, INITIAL_HAND_SIZE),
          board: [],
          graveyard: [],
        },
        [p2]: {
          life: initialLife,
          maxMana: 0,
          currentMana: 0,
          deck: deck2.slice(INITIAL_HAND_SIZE),
          hand: deck2.slice(0, INITIAL_HAND_SIZE),
          board: [],
          graveyard: [],
        },
      };

      return {
        turnCount: 0,
        activePlayer: p1,
        players,
        playerOrder: [p1, p2],
      };
    },

    actions: {
      playCard: {
        execute: (state, playerId, payload) => {
          const { cardId } = payload as { cardId: string };
          const player = state.players[playerId];
          const cardIdx = player.hand.findIndex((c) => c.id === cardId);
          const card = player.hand.splice(cardIdx, 1)[0];

          player.currentMana -= card.cost;

          if (card.type === "creature") {
            player.board.push({
              card,
              currentHealth: card.health,
              hasAttacked: false,
              summoningSickness: true,
            });
          } else {
            // Spell: goes to graveyard after use
            player.graveyard.push(card);
          }
        },
        validate: (state, playerId, payload) => {
          if (playerId !== state.activePlayer) return "Not your turn";
          const { cardId } = payload as { cardId: string };
          const player = state.players[playerId];
          const card = player.hand.find((c) => c.id === cardId);
          if (!card) return "Card not in hand";
          if (card.cost > player.currentMana) return "Not enough mana";
          if (
            card.type === "creature" &&
            player.board.length >= MAX_BOARD_SIZE
          )
            return "Board is full";
          return true;
        },
      },

      attack: {
        execute: (state, playerId, payload) => {
          const { attackerId, targetId } = payload as {
            attackerId: string;
            targetId: string | "face";
          };
          const player = state.players[playerId];
          const opponent =
            state.players[
              state.playerOrder.find((p) => p !== playerId)!
            ];

          const attacker = player.board.find(
            (e) => e.card.id === attackerId,
          )!;
          attacker.hasAttacked = true;

          if (targetId === "face") {
            // Attack opponent directly
            opponent.life -= attacker.card.attack;
          } else {
            // Attack a creature
            const target = opponent.board.find(
              (e) => e.card.id === targetId,
            )!;
            target.currentHealth -= attacker.card.attack;
            attacker.currentHealth -= target.card.attack;

            // Remove dead creatures
            if (target.currentHealth <= 0) {
              opponent.board = opponent.board.filter(
                (e) => e.card.id !== targetId,
              );
              opponent.graveyard.push(target.card);
            }
            if (attacker.currentHealth <= 0) {
              player.board = player.board.filter(
                (e) => e.card.id !== attackerId,
              );
              player.graveyard.push(attacker.card);
            }
          }
        },
        validate: (state, playerId, payload) => {
          if (playerId !== state.activePlayer) return "Not your turn";
          const { attackerId, targetId } = payload as {
            attackerId: string;
            targetId: string | "face";
          };
          const player = state.players[playerId];
          const attacker = player.board.find(
            (e) => e.card.id === attackerId,
          );
          if (!attacker) return "Attacker not found on board";
          if (attacker.hasAttacked) return "Already attacked this turn";
          if (attacker.summoningSickness)
            return "Creature has summoning sickness";
          if (targetId !== "face") {
            const opponent =
              state.players[
                state.playerOrder.find((p) => p !== playerId)!
              ];
            if (!opponent.board.find((e) => e.card.id === targetId))
              return "Target not found";
          }
          return true;
        },
      },

      endTurn: {
        execute: (state, playerId) => {
          // Swap active player
          const nextPlayer = state.playerOrder.find(
            (p) => p !== playerId,
          )!;
          state.activePlayer = nextPlayer;
          state.turnCount++;

          // Turn start effects for next player
          const player = state.players[nextPlayer];

          // Increase max mana (cap at MAX_MANA)
          if (player.maxMana < MAX_MANA) {
            player.maxMana++;
          }
          // Restore mana
          player.currentMana = player.maxMana;

          // Draw a card
          if (player.deck.length > 0) {
            player.hand.push(player.deck.shift()!);
          }

          // Remove summoning sickness and reset attack flags
          for (const entity of player.board) {
            entity.hasAttacked = false;
            entity.summoningSickness = false;
          }
        },
        endsTurn: true,
      },
    },

    phases: {
      main: {
        allowedActions: ["playCard", "attack", "endTurn"],
        turnOrder: tcgTurnOrder,
      },
    },

    interrupts: [
      {
        condition: (state) => {
          for (const [pid, pState] of Object.entries(state.players)) {
            if (pState.life <= 0) {
              const winner = state.playerOrder.find((p) => p !== pid);
              return { winner, reason: `${pid} defeated` };
            }
          }
          return null;
        },
      },
    ],

    view: {
      playerView: (state, playerId) => {
        const view: any = {
          turnCount: state.turnCount,
          activePlayer: state.activePlayer,
          playerOrder: state.playerOrder,
          players: {},
        };

        for (const [pid, pState] of Object.entries(state.players)) {
          view.players[pid] = {
            life: pState.life,
            maxMana: pState.maxMana,
            currentMana: pState.currentMana,
            deckCount: countOnly(pState.deck),
            board: pState.board,
            graveyard: pState.graveyard,
            hand:
              pid === playerId
                ? pState.hand
                : maskArray(pState.hand, { hidden: true }),
          };
        }

        return view;
      },
    },

    bot: tcgBotStrategy,
  };
}

const tcgBotStrategy: BotStrategy<TCGState> = {
  decide(playerId: PlayerId, playerView: unknown, engineState: EngineState) {
    const view = playerView as any;
    if (view.activePlayer !== playerId) return null;

    const me = view.players?.[playerId];
    if (!me) return null;

    // 1. Play affordable creature cards (cheapest first)
    const playableCards = (me.hand as any[])
      .filter(
        (c: any) =>
          !c.hidden && c.cost <= me.currentMana && c.type === "creature",
      )
      .sort((a: any, b: any) => a.cost - b.cost);

    if (playableCards.length > 0 && (me.board as any[]).length < 5) {
      return { action: "playCard", payload: { cardId: playableCards[0].id } };
    }

    // 2. Attack with available creatures → prefer face
    const attackers = (me.board as any[]).filter(
      (e: any) => !e.hasAttacked && !e.summoningSickness,
    );
    if (attackers.length > 0) {
      return {
        action: "attack",
        payload: { attackerId: attackers[0].card.id, targetId: "face" },
      };
    }

    // 3. Play spell cards if any
    const spells = (me.hand as any[]).filter(
      (c: any) => !c.hidden && c.cost <= me.currentMana && c.type === "spell",
    );
    if (spells.length > 0) {
      return { action: "playCard", payload: { cardId: spells[0].id } };
    }

    // 4. End turn
    return { action: "endTurn" };
  },
};
