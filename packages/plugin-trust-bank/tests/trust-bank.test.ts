import { describe, expect, it } from "vitest";
import { CroupierCore } from "@croupier/core";
import { createTrustBankConfig, CARD_DEFINITIONS, getCardDefinition } from "../src/index.js";
import type { TrustBankState } from "../src/types.js";
import { MISSION_DEFINITIONS, BONUS_BY_DIFFICULTY } from "../src/missions.js";

function createGame(numPlayers = 4, seed = 42) {
  const players = Array.from({ length: numPlayers }, (_, i) => `P${i + 1}`);
  const config = createTrustBankConfig();
  return new CroupierCore(config, players, { seed });
}

/** Access internal mutable game state (for test setup only) */
function internalState(engine: CroupierCore<TrustBankState>): TrustBankState {
  return (engine as any).ctx.game;
}

/** Helper: get current player ID */
function currentPlayer(engine: CroupierCore<TrustBankState>): string {
  const state = engine.getState() as TrustBankState;
  return state.playerOrder[state.currentPlayerIndex];
}

/** Helper: replace the last card in hand with a specific card (keeps hand size constant) */
function giveCard(engine: CroupierCore<TrustBankState>, playerId: string, defId: number): string {
  const state = internalState(engine);
  const cardId = `test-card-${defId}-${Math.random().toString(36).slice(2)}`;
  // Replace last card to keep hand size at HAND_SIZE
  if (state.players[playerId].hand.length > 0) {
    state.players[playerId].hand[state.players[playerId].hand.length - 1] = { id: cardId, definitionId: defId };
  } else {
    state.players[playerId].hand.push({ id: cardId, definitionId: defId });
  }
  return cardId;
}

/** Helper: set a specific mission for a player (mutates internal state) */
function setMission(engine: CroupierCore<TrustBankState>, playerId: string, missionId: string): void {
  const state = internalState(engine);
  state.players[playerId].mission = missionId;
  state.players[playerId].missionProgress.missionId = missionId;
  state.players[playerId].missionProgress.completed = false;
}

/** Helper: disable all missions by marking them completed (prevents interference in non-mission tests) */
function disableAllMissions(engine: CroupierCore<TrustBankState>): void {
  const state = internalState(engine);
  for (const pid of state.playerOrder) {
    state.players[pid].missionProgress.completed = true;
  }
}

/** Helper: draw cards, handling forced withdrawals, until hand is back to 3 */
function drawUntilNormal(engine: CroupierCore<TrustBankState>): boolean {
  const maxIterations = 10;
  for (let i = 0; i < maxIterations; i++) {
    const es = engine.getEngineState();
    if (es.finished) return true;
    if (es.stage !== "drawCard" && es.stage !== "withdrawalForced") return true;

    if (es.stage === "drawCard") {
      const state = engine.getState() as TrustBankState;
      if (state.deck.length === 0) return true;
      const pid = currentPlayer(engine);
      const r = engine.dispatch(pid, "drawCard");
      if (!r.ok) return false;
    }

    const esAfter = engine.getEngineState();
    if (esAfter.finished) return true;

    if (esAfter.stage === "withdrawalForced") {
      const pid = currentPlayer(engine);
      const stateAfter = engine.getState() as TrustBankState;
      const drawnCard = stateAfter.drawnCard;
      if (!drawnCard) return false;
      const def = getCardDefinition(drawnCard.definitionId);

      if (def.requiresTarget) {
        const targets = stateAfter.playerOrder.filter(
          (p) => p !== pid && !stateAfter.players[p].eliminated,
        );
        if (targets.length > 0) {
          engine.dispatch(pid, "playWithdrawal", { targetPlayerId: targets[0] });
        } else {
          engine.dispatch(pid, "playWithdrawal");
        }
      } else {
        engine.dispatch(pid, "playWithdrawal");
      }
      continue;
    }

    if (esAfter.stage === "selectCard") return true;
  }
  return true;
}

/** Helper: skip a player's turn using their first hand card as deposit */
function skipTurn(engine: CroupierCore<TrustBankState>): void {
  const pid = currentPlayer(engine);
  const cardId = giveCard(engine, pid, 1); // deposit +3
  engine.dispatch(pid, "selectCard", { cardId });
  engine.dispatch(pid, "confirmPlay");
  drawUntilNormal(engine);
}

/** Helper: advance turns until target player is current */
function advanceToPlayer(engine: CroupierCore<TrustBankState>, targetPlayer: string): void {
  let safety = 20;
  while (currentPlayer(engine) !== targetPlayer && safety-- > 0) {
    skipTurn(engine);
  }
}

describe("Trust Bank", () => {
  describe("setup", () => {
    it("deals 3 cards to each player", () => {
      const engine = createGame();
      const state = engine.getState() as TrustBankState;
      for (const p of state.playerOrder) {
        expect(state.players[p].hand).toHaveLength(3);
      }
    });

    it("gives each player 10 trust points", () => {
      const engine = createGame();
      const state = engine.getState() as TrustBankState;
      for (const p of state.playerOrder) {
        expect(state.players[p].trustPoints).toBe(10);
      }
    });

    it("creates a deck of remaining cards (28 - 12 dealt = 16)", () => {
      const engine = createGame();
      const state = engine.getState() as TrustBankState;
      expect(state.deck).toHaveLength(16);
    });

    it("assigns a mission to each player", () => {
      const engine = createGame();
      const state = engine.getState() as TrustBankState;
      for (const p of state.playerOrder) {
        expect(state.players[p].mission).toBeTruthy();
        expect(MISSION_DEFINITIONS.find((m) => m.id === state.players[p].mission)).toBeDefined();
      }
    });

    it("starts in playerTurn phase with selectCard stage", () => {
      const engine = createGame();
      const es = engine.getEngineState();
      expect(es.phase).toBe("playerTurn");
      expect(es.stage).toBe("selectCard");
    });

    it("P1 is the first player", () => {
      const engine = createGame();
      expect(engine.getEngineState().currentPlayers).toBe("P1");
    });
  });

  describe("card selection", () => {
    it("allows selecting a card from hand", () => {
      const engine = createGame();
      const state = engine.getState() as TrustBankState;
      const card = state.players.P1.hand[0];
      const result = engine.dispatch("P1", "selectCard", { cardId: card.id });
      expect(result.ok).toBe(true);
    });

    it("rejects selecting a card not in hand", () => {
      const engine = createGame();
      const result = engine.dispatch("P1", "selectCard", { cardId: "nonexistent" });
      expect(result.ok).toBe(false);
    });

    it("rejects selecting when not your turn", () => {
      const engine = createGame();
      const state = engine.getState() as TrustBankState;
      const card = state.players.P2.hand[0];
      const result = engine.dispatch("P2", "selectCard", { cardId: card.id });
      expect(result.ok).toBe(false);
    });
  });

  describe("card play - no target", () => {
    it("plays a deposit card and gains points", () => {
      const engine = createGame();
      // Give P1 a known deposit card (card 1: +3)
      const cardId = giveCard(engine, "P1", 1);

      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");

      const stateAfter = engine.getState() as TrustBankState;
      expect(stateAfter.players.P1.trustPoints).toBe(13); // 10 + 3
      expect(engine.getEngineState().stage).toBe("drawCard");
    });
  });

  describe("card play - with target", () => {
    it("plays an attack card reducing target points", () => {
      const engine = createGame();
      const cardId = giveCard(engine, "P1", 11); // attack: target -3

      engine.dispatch("P1", "selectCard", { cardId });
      expect(engine.getEngineState().stage).toBe("selectTarget");

      engine.dispatch("P1", "selectTarget", { targetPlayerId: "P2" });
      const stateAfter = engine.getState() as TrustBankState;
      expect(stateAfter.players.P2.trustPoints).toBe(7); // 10 - 3
    });

    it("rejects targeting self", () => {
      const engine = createGame();
      const cardId = giveCard(engine, "P1", 11);

      engine.dispatch("P1", "selectCard", { cardId });
      const result = engine.dispatch("P1", "selectTarget", { targetPlayerId: "P1" });
      expect(result.ok).toBe(false);
    });
  });

  describe("draw", () => {
    it("draws a card from deck to hand after playing", () => {
      const engine = createGame();
      const cardId = giveCard(engine, "P1", 1);

      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");

      const beforeDraw = engine.getState() as TrustBankState;
      const deckBefore = beforeDraw.deck.length;

      engine.dispatch("P1", "drawCard");

      const afterDraw = engine.getState() as TrustBankState;
      expect(afterDraw.players.P1.hand).toHaveLength(3);
      expect(afterDraw.deck).toHaveLength(deckBefore - 1);
    });
  });

  describe("withdrawal forced play", () => {
    it("forces immediate play when withdrawal card is drawn", () => {
      const engine = createGame();
      const game = internalState(engine);
      disableAllMissions(engine); // Prevent mission bonuses from interfering

      // Put a withdrawal card on top of deck
      game.deck.unshift({ id: "forced-w", definitionId: 7 }); // 失言: self -3

      const cardId = giveCard(engine, "P1", 1); // deposit +3
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");

      // Draw — should get the withdrawal card
      engine.dispatch("P1", "drawCard");

      const afterDraw = engine.getState() as TrustBankState;
      expect(afterDraw.drawnCard).not.toBeNull();
      expect(engine.getEngineState().stage).toBe("withdrawalForced");

      // Play the withdrawal
      const wr = engine.dispatch("P1", "playWithdrawal");
      expect(wr.ok).toBe(true);

      const afterPlay = engine.getState() as TrustBankState;
      expect(afterPlay.drawnCard).toBeNull();
      expect(afterPlay.players.P1.trustPoints).toBe(10); // 10+3-3=10
    });

    it("handles withdrawal card requiring target (card12)", () => {
      const engine = createGame();
      const game = internalState(engine);
      disableAllMissions(engine);

      // Put card 12 (責任転嫁: target -3, self +2) on top of deck
      game.deck.unshift({ id: "forced-w12", definitionId: 12 });

      const cardId = giveCard(engine, "P1", 1);
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");
      engine.dispatch("P1", "drawCard");

      expect(engine.getEngineState().stage).toBe("withdrawalForced");

      engine.dispatch("P1", "playWithdrawal", { targetPlayerId: "P3" });

      const afterPlay = engine.getState() as TrustBankState;
      expect(afterPlay.players.P1.trustPoints).toBe(15); // 10+3+2=15
      expect(afterPlay.players.P3.trustPoints).toBe(7);  // 10-3=7
    });
  });

  describe("special cards", () => {
    it("card05 (賭けに出る) - coin flip determines outcome", () => {
      const engine = createGame();
      const cardId = giveCard(engine, "P1", 5);

      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");

      const after = engine.getState() as TrustBankState;
      // Result depends on randomSeed: either 10+4=14 or 10-2=8
      expect([8, 14]).toContain(after.players.P1.trustPoints);
    });

    it("card21 (反省) - bonus when recently attacked", () => {
      const engine = createGame();
      const game = internalState(engine);

      // Simulate P1 being attacked recently
      game.turnHistory.push({
        turn: 0,
        playerId: "P2",
        cardDefinitionId: 11,
        category: "attack",
        targetPlayerId: "P1",
      });

      const cardId = giveCard(engine, "P1", 21);
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");

      const after = engine.getState() as TrustBankState;
      expect(after.players.P1.trustPoints).toBe(14); // 10 + 4
    });

    it("card21 (反省) - reduced bonus when not recently attacked", () => {
      const engine = createGame();
      const cardId = giveCard(engine, "P1", 21);

      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");

      const after = engine.getState() as TrustBankState;
      expect(after.players.P1.trustPoints).toBe(12); // 10 + 2
    });

    it("card28 (公表) - redistributes between highest and lowest", () => {
      const engine = createGame();
      const game = internalState(engine);

      game.players.P1.trustPoints = 15;
      game.players.P2.trustPoints = 5;
      game.players.P3.trustPoints = 10;
      game.players.P4.trustPoints = 10;

      const cardId = giveCard(engine, "P1", 28);
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");

      const after = engine.getState() as TrustBankState;
      expect(after.players.P1.trustPoints).toBe(14); // 15 - 1
      expect(after.players.P2.trustPoints).toBe(6);  // 5 + 1
      expect(after.players.P3.trustPoints).toBe(10);
      expect(after.players.P4.trustPoints).toBe(10);
    });

    it("card08 (連鎖する不信) - double penalty for consecutive crisis", () => {
      const engine = createGame();
      const game = internalState(engine);

      // Add a previous withdrawal event by P1
      game.turnHistory.push({
        turn: 0,
        playerId: "P1",
        cardDefinitionId: 7,
        category: "crisis",
      });

      const cardId = giveCard(engine, "P1", 8);
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");

      const after = engine.getState() as TrustBankState;
      expect(after.players.P1.trustPoints).toBe(6); // 10 - 4
    });
  });

  describe("elimination", () => {
    it("eliminates player when trust points reach 0", () => {
      const engine = createGame();
      const game = internalState(engine);
      game.players.P2.trustPoints = 3;

      const cardId = giveCard(engine, "P1", 13); // 裏切り: target -4
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "selectTarget", { targetPlayerId: "P2" });

      const after = engine.getState() as TrustBankState;
      expect(after.players.P2.eliminated).toBe(true);
      expect(after.players.P2.trustPoints).toBe(0);
    });

    it("skips eliminated players in turn order", () => {
      const engine = createGame();
      const game = internalState(engine);
      game.players.P2.eliminated = true;
      game.players.P2.trustPoints = 0;

      const cardId = giveCard(engine, "P1", 1);
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");
      drawUntilNormal(engine);

      const cp = currentPlayer(engine);
      expect(cp).toBe("P3");
    });
  });

  describe("end conditions", () => {
    it("ends game when deck is empty - highest points wins", () => {
      const engine = createGame();
      const game = internalState(engine);

      game.deck = [];
      game.players.P1.trustPoints = 20;
      game.players.P2.trustPoints = 15;

      const cardId = giveCard(engine, "P1", 1);
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");

      const es = engine.getEngineState();
      expect(es.finished).toBe(true);
      expect(es.result?.winner).toBe("P1");
      expect(es.result?.reason).toBe("Deck exhausted");
    });

    it("ends game when only one player survives", () => {
      const engine = createGame();
      const game = internalState(engine);

      game.players.P3.eliminated = true;
      game.players.P3.trustPoints = 0;
      game.players.P4.eliminated = true;
      game.players.P4.trustPoints = 0;
      game.players.P2.trustPoints = 1;

      const cardId = giveCard(engine, "P1", 14); // 噂話: target -2
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "selectTarget", { targetPlayerId: "P2" });

      const es = engine.getEngineState();
      expect(es.finished).toBe(true);
      expect(es.result?.winner).toBe("P1");
      expect(es.result?.reason).toBe("Last player standing");
    });
  });

  describe("missions - distribution", () => {
    it("assigns a unique mission to each player", () => {
      const engine = createGame();
      const state = engine.getState() as TrustBankState;
      const missions = state.playerOrder.map((p) => state.players[p].mission);
      const uniqueMissions = new Set(missions);
      expect(uniqueMissions.size).toBe(4);
    });
  });

  describe("missions - action-based", () => {
    it("M01: completes when player uses 3 attack cards", () => {
      const engine = createGame();
      setMission(engine, "P1", "M01");

      for (let i = 0; i < 3; i++) {
        advanceToPlayer(engine, "P1");
        const cardId = giveCard(engine, "P1", 14); // 噂話: attack -2
        engine.dispatch("P1", "selectCard", { cardId });
        engine.dispatch("P1", "selectTarget", { targetPlayerId: "P2" });
        drawUntilNormal(engine);
      }

      const after = engine.getState() as TrustBankState;
      expect(after.players.P1.missionProgress.completed).toBe(true);
      expect(after.openedMissions.P1).toBeDefined();
      expect(after.openedMissions.P1.missionId).toBe("M01");
    });

    it("M03: completes when attacking same player 3 times", () => {
      const engine = createGame();
      setMission(engine, "P1", "M03");

      for (let i = 0; i < 3; i++) {
        advanceToPlayer(engine, "P1");
        const cardId = giveCard(engine, "P1", 14);
        engine.dispatch("P1", "selectCard", { cardId });
        engine.dispatch("P1", "selectTarget", { targetPlayerId: "P3" });
        drawUntilNormal(engine);
      }

      const after = engine.getState() as TrustBankState;
      expect(after.players.P1.missionProgress.completed).toBe(true);
      expect(after.openedMissions.P1.bonus).toBe(BONUS_BY_DIFFICULTY.normal);
    });
  });

  describe("missions - state-based", () => {
    it("M06: completes when points go below 5 then recover to 12+", () => {
      const engine = createGame();
      const game = internalState(engine);
      disableAllMissions(engine);
      setMission(engine, "P1", "M06");

      game.players.P1.trustPoints = 9;
      game.players.P1.missionProgress.wasBelow5 = true;

      const cardId = giveCard(engine, "P1", 2); // 深い絆: +5
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");

      const after = engine.getState() as TrustBankState;
      // 9 + 5 = 14, then M06 bonus +5 = 19
      expect(after.players.P1.trustPoints).toBe(19);
      expect(after.players.P1.missionProgress.completed).toBe(true);
    });

    it("M07: completes when player has sole highest points", () => {
      const engine = createGame();
      const game = internalState(engine);
      setMission(engine, "P1", "M07");

      game.players.P1.trustPoints = 8;
      game.players.P2.trustPoints = 10;
      game.players.P3.trustPoints = 10;
      game.players.P4.trustPoints = 10;

      const cardId = giveCard(engine, "P1", 1); // +3
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");

      const after = engine.getState() as TrustBankState;
      expect(after.players.P1.trustPoints).toBeGreaterThanOrEqual(11);
      expect(after.players.P1.missionProgress.completed).toBe(true);
      expect(after.openedMissions.P1.bonus).toBe(BONUS_BY_DIFFICULTY.easy);
    });
  });

  describe("missions - survival-based", () => {
    it("M09: completes after 3 turns without being attacked", () => {
      const engine = createGame();
      const game = internalState(engine);
      disableAllMissions(engine);
      setMission(engine, "P1", "M09");
      game.players.P1.missionProgress.turnsWithoutAttack = 2;

      // P1 plays a card and completes turn → turnsWithoutAttack increments to 3 in onExit
      const cardId = giveCard(engine, "P1", 1);
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");
      drawUntilNormal(engine);

      const after = engine.getState() as TrustBankState;
      expect(after.players.P1.missionProgress.turnsWithoutAttack).toBeGreaterThanOrEqual(3);
      expect(after.players.P1.missionProgress.completed).toBe(true);
    });

    it("M10: completes after receiving 4 attacks and surviving", () => {
      const engine = createGame();
      const game = internalState(engine);
      setMission(engine, "P1", "M10");
      game.players.P1.trustPoints = 20;
      game.players.P1.missionProgress.attacksReceived = 3;

      // P1 plays first, skip to P2
      const cardId = giveCard(engine, "P1", 1);
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");
      drawUntilNormal(engine);

      // Advance to P2
      advanceToPlayer(engine, "P2");

      // P2 attacks P1
      const attackCardId = giveCard(engine, "P2", 14);
      engine.dispatch("P2", "selectCard", { cardId: attackCardId });
      engine.dispatch("P2", "selectTarget", { targetPlayerId: "P1" });

      const after = engine.getState() as TrustBankState;
      expect(after.players.P1.missionProgress.attacksReceived).toBe(4);
      expect(after.players.P1.missionProgress.completed).toBe(true);
    });
  });

  describe("missions - bonus points", () => {
    it("awards correct bonus by difficulty", () => {
      expect(BONUS_BY_DIFFICULTY.easy).toBe(3);
      expect(BONUS_BY_DIFFICULTY.normal).toBe(5);
      expect(BONUS_BY_DIFFICULTY.hard).toBe(7);
    });

    it("adds bonus points when mission completes", () => {
      const engine = createGame();
      const game = internalState(engine);
      setMission(engine, "P1", "M07"); // easy: 3pt bonus

      game.players.P1.trustPoints = 8;
      game.players.P2.trustPoints = 5;
      game.players.P3.trustPoints = 5;
      game.players.P4.trustPoints = 5;

      const cardId = giveCard(engine, "P1", 1); // +3
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");

      const after = engine.getState() as TrustBankState;
      // 8 + 3 (deposit) + 3 (mission bonus) = 14
      expect(after.players.P1.trustPoints).toBe(14);
    });

    it("does not re-trigger completed mission", () => {
      const engine = createGame();
      const game = internalState(engine);
      setMission(engine, "P1", "M07");

      game.players.P1.missionProgress.completed = true;
      game.openedMissions.P1 = {
        missionId: "M07",
        name: "頂点",
        description: "自分が単独最高ptになる",
        bonus: 3,
      };

      game.players.P1.trustPoints = 20;
      game.players.P2.trustPoints = 5;

      const cardId = giveCard(engine, "P1", 1); // +3
      engine.dispatch("P1", "selectCard", { cardId });
      engine.dispatch("P1", "confirmPlay");

      const after = engine.getState() as TrustBankState;
      expect(after.players.P1.trustPoints).toBe(23); // 20 + 3 (no extra bonus)
    });
  });

  describe("view", () => {
    it("shows own hand but hides others", () => {
      const engine = createGame();
      const config = createTrustBankConfig();
      const state = engine.getState() as TrustBankState;
      const view = config.view!.playerView(state, "P1") as any;

      expect(view.players.P1.hand).toBeDefined();
      expect(view.players.P1.hand.length).toBeGreaterThan(0);
      expect(view.players.P2.hand).toBeUndefined();
      expect(view.players.P2.handCount).toBeDefined();
    });

    it("shows trust points for all players", () => {
      const engine = createGame();
      const config = createTrustBankConfig();
      const state = engine.getState() as TrustBankState;
      const view = config.view!.playerView(state, "P1") as any;

      for (const p of state.playerOrder) {
        expect(view.players[p].trustPoints).toBe(10);
      }
    });

    it("hides unfinished missions of other players", () => {
      const engine = createGame();
      const config = createTrustBankConfig();
      const state = engine.getState() as TrustBankState;
      const view = config.view!.playerView(state, "P1") as any;

      expect(view.players.P1.mission).toBeDefined();
      expect(view.players.P1.mission).not.toBe("???");
      expect(view.players.P2.mission).toBe("???");
    });

    it("reveals completed missions to all players", () => {
      const engine = createGame();
      const config = createTrustBankConfig();
      const state = engine.getState() as TrustBankState;

      state.openedMissions.P2 = {
        missionId: "M07",
        name: "頂点",
        description: "自分が単独最高ptになる",
        bonus: 3,
      };

      const view = config.view!.playerView(state, "P1") as any;
      expect(view.openedMissions.P2).toBeDefined();
      expect(view.openedMissions.P2.name).toBe("頂点");
    });
  });

  describe("card definitions", () => {
    it("has 28 card definitions", () => {
      expect(CARD_DEFINITIONS).toHaveLength(28);
    });

    it("has unique IDs", () => {
      const ids = CARD_DEFINITIONS.map((d) => d.id);
      expect(new Set(ids).size).toBe(28);
    });
  });

  describe("mission definitions", () => {
    it("has 12 mission definitions", () => {
      expect(MISSION_DEFINITIONS).toHaveLength(12);
    });

    it("has unique IDs", () => {
      const ids = MISSION_DEFINITIONS.map((m) => m.id);
      expect(new Set(ids).size).toBe(12);
    });
  });
});
