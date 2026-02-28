import { describe, expect, it } from "vitest";
import { CroupierCore } from "@croupier/core";
import { createPlanningPokerConfig } from "../src/index.js";
import type { PlanningPokerState } from "../src/types.js";

function createGame() {
  const config = createPlanningPokerConfig({
    facilitators: ["Facilitator"],
  });
  return new CroupierCore(config, ["Facilitator", "Dev1", "Dev2", "Dev3"], {
    seed: 42,
  });
}

describe("Planning Poker", () => {
  describe("setup", () => {
    it("assigns roles correctly", () => {
      const engine = createGame();
      const state = engine.getState() as PlanningPokerState;
      expect(state.players.Facilitator.role).toBe("facilitator");
      expect(state.players.Dev1.role).toBe("voter");
      expect(state.players.Dev2.role).toBe("voter");
      expect(state.players.Dev3.role).toBe("voter");
    });

    it("starts in idle phase", () => {
      const engine = createGame();
      expect(engine.getEngineState().phase).toBe("idle");
    });

    it("has fibonacci deck", () => {
      const engine = createGame();
      const state = engine.getState() as PlanningPokerState;
      expect(state.deck).toContain("8");
      expect(state.deck).toContain("?");
    });
  });

  describe("task selection", () => {
    it("facilitator can select a task", () => {
      const engine = createGame();
      const result = engine.dispatch("Facilitator", "selectTask", {
        id: "T1",
        title: "Login feature",
      });
      expect(result.ok).toBe(true);
      const state = engine.getState() as PlanningPokerState;
      expect(state.currentTask?.id).toBe("T1");
    });

    it("transitions to discussion after selecting task", () => {
      const engine = createGame();
      engine.dispatch("Facilitator", "selectTask", {
        id: "T1",
        title: "Test",
      });
      expect(engine.getEngineState().phase).toBe("discussion");
    });

    it("voter cannot select a task", () => {
      const engine = createGame();
      const result = engine.dispatch("Dev1", "selectTask", {
        id: "T1",
        title: "Test",
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("voting flow", () => {
    function setupVoting() {
      const engine = createGame();
      engine.dispatch("Facilitator", "selectTask", {
        id: "T1",
        title: "Test",
      });
      engine.dispatch("Facilitator", "startVoting");
      return engine;
    }

    it("transitions to voting after startVoting", () => {
      const engine = setupVoting();
      expect(engine.getEngineState().phase).toBe("voting");
    });

    it("voters can vote", () => {
      const engine = setupVoting();
      const r1 = engine.dispatch("Dev1", "vote", { card: "5" });
      expect(r1.ok).toBe(true);
      const state = engine.getState() as PlanningPokerState;
      expect(state.players.Dev1.selectedCard).toBe("5");
    });

    it("facilitator cannot vote", () => {
      const engine = setupVoting();
      const result = engine.dispatch("Facilitator", "vote", { card: "3" });
      expect(result.ok).toBe(false);
    });

    it("voters can change their vote", () => {
      const engine = setupVoting();
      engine.dispatch("Dev1", "vote", { card: "5" });
      engine.dispatch("Dev1", "vote", { card: "8" });
      const state = engine.getState() as PlanningPokerState;
      expect(state.players.Dev1.selectedCard).toBe("8");
    });

    it("rejects invalid card values", () => {
      const engine = setupVoting();
      const result = engine.dispatch("Dev1", "vote", { card: "999" });
      expect(result.ok).toBe(false);
    });

    it("reveal fails if not all voted", () => {
      const engine = setupVoting();
      engine.dispatch("Dev1", "vote", { card: "5" });
      // Dev2 and Dev3 haven't voted
      const result = engine.dispatch("Facilitator", "reveal");
      expect(result.ok).toBe(false);
    });

    it("reveal succeeds when all voted", () => {
      const engine = setupVoting();
      engine.dispatch("Dev1", "vote", { card: "5" });
      engine.dispatch("Dev2", "vote", { card: "8" });
      engine.dispatch("Dev3", "vote", { card: "5" });
      const result = engine.dispatch("Facilitator", "reveal");
      expect(result.ok).toBe(true);

      const state = engine.getState() as PlanningPokerState;
      expect(state.revealedCards).toEqual({
        Dev1: "5",
        Dev2: "8",
        Dev3: "5",
      });
    });

    it("transitions to evaluation after reveal", () => {
      const engine = setupVoting();
      engine.dispatch("Dev1", "vote", { card: "5" });
      engine.dispatch("Dev2", "vote", { card: "8" });
      engine.dispatch("Dev3", "vote", { card: "5" });
      engine.dispatch("Facilitator", "reveal");
      expect(engine.getEngineState().phase).toBe("evaluation");
    });
  });

  describe("evaluation and consensus", () => {
    function setupEvaluation() {
      const engine = createGame();
      engine.dispatch("Facilitator", "selectTask", {
        id: "T1",
        title: "Test",
      });
      engine.dispatch("Facilitator", "startVoting");
      engine.dispatch("Dev1", "vote", { card: "5" });
      engine.dispatch("Dev2", "vote", { card: "5" });
      engine.dispatch("Dev3", "vote", { card: "5" });
      engine.dispatch("Facilitator", "reveal");
      return engine;
    }

    it("facilitator can record estimate", () => {
      const engine = setupEvaluation();
      const result = engine.dispatch("Facilitator", "recordEstimate", {
        estimate: "5",
      });
      expect(result.ok).toBe(true);
      expect(engine.getEngineState().phase).toBe("consensus");
    });

    it("facilitator can start re-vote", () => {
      const engine = setupEvaluation();
      const result = engine.dispatch("Facilitator", "startVoting");
      expect(result.ok).toBe(true);
      expect(engine.getEngineState().phase).toBe("voting");
    });

    it("consensus → idle after resetForNextTask", () => {
      const engine = setupEvaluation();
      engine.dispatch("Facilitator", "recordEstimate", { estimate: "5" });
      engine.dispatch("Facilitator", "resetForNextTask");
      expect(engine.getEngineState().phase).toBe("idle");
    });
  });

  describe("state masking", () => {
    it("hides others' votes during voting", () => {
      const config = createPlanningPokerConfig({
        facilitators: ["F"],
      });
      const engine = new CroupierCore(config, ["F", "V1", "V2"], {
        seed: 1,
      });
      engine.dispatch("F", "selectTask", { id: "T1", title: "Test" });
      engine.dispatch("F", "startVoting");
      engine.dispatch("V1", "vote", { card: "5" });

      const viewV2 = engine.getPlayerView("V2") as any;
      // V1 has voted but V2 shouldn't see the actual value
      expect(viewV2.players.V1.selectedCard).toBe("selected");
      // V2 sees their own null
      expect(viewV2.players.V2.selectedCard).toBeNull();
    });

    it("shows all votes after reveal", () => {
      const config = createPlanningPokerConfig({
        facilitators: ["F"],
      });
      const engine = new CroupierCore(config, ["F", "V1", "V2"], {
        seed: 1,
      });
      engine.dispatch("F", "selectTask", { id: "T1", title: "Test" });
      engine.dispatch("F", "startVoting");
      engine.dispatch("V1", "vote", { card: "5" });
      engine.dispatch("V2", "vote", { card: "8" });
      engine.dispatch("F", "reveal");

      const viewV1 = engine.getPlayerView("V1") as any;
      expect(viewV1.revealedCards).toEqual({ V1: "5", V2: "8" });
    });
  });

  describe("full scenario", () => {
    it("plays through complete estimation session", () => {
      const engine = createGame();

      // 1. Select task
      engine.dispatch("Facilitator", "selectTask", {
        id: "US-123",
        title: "User registration",
      });
      expect(engine.getEngineState().phase).toBe("discussion");

      // 2. Start voting
      engine.dispatch("Facilitator", "startVoting");
      expect(engine.getEngineState().phase).toBe("voting");

      // 3. Everyone votes (disagreement)
      engine.dispatch("Dev1", "vote", { card: "3" });
      engine.dispatch("Dev2", "vote", { card: "13" });
      engine.dispatch("Dev3", "vote", { card: "5" });

      // 4. Reveal
      engine.dispatch("Facilitator", "reveal");
      expect(engine.getEngineState().phase).toBe("evaluation");

      // 5. Re-vote (disagreement was too large)
      engine.dispatch("Facilitator", "startVoting");
      expect(engine.getEngineState().phase).toBe("voting");

      // 6. Everyone converges
      engine.dispatch("Dev1", "vote", { card: "5" });
      engine.dispatch("Dev2", "vote", { card: "8" });
      engine.dispatch("Dev3", "vote", { card: "5" });
      engine.dispatch("Facilitator", "reveal");

      // 7. Record estimate
      engine.dispatch("Facilitator", "recordEstimate", { estimate: "5" });
      expect(engine.getEngineState().phase).toBe("consensus");

      // 8. Move to next task
      engine.dispatch("Facilitator", "resetForNextTask");
      expect(engine.getEngineState().phase).toBe("idle");

      // Check history
      const state = engine.getState() as PlanningPokerState;
      expect(state.roundHistory).toHaveLength(2);
      expect(state.roundHistory[0].round).toBe(1);
      expect(state.roundHistory[1].round).toBe(2);
    });
  });
});
