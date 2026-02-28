import { describe, expect, it, vi } from "vitest";
import { CroupierCore } from "../src/croupier-core.js";
import { ROUND_ROBIN } from "../src/turn-orders.js";
import type { CroupierConfig, GameState } from "../src/types.js";

// ====================
// Multi-phase game for lifecycle tests
// ====================

interface PhaseState extends GameState {
  phaseLog: string[];
  value: number;
}

function multiPhaseConfig(): CroupierConfig<PhaseState> {
  return {
    name: "multi-phase",
    setup: () => ({ phaseLog: [], value: 0 }),
    actions: {
      act: {
        execute: (state, playerId) => {
          state.value++;
        },
      },
    },
    phases: {
      phase1: {
        allowedActions: ["act"],
        turnOrder: ROUND_ROBIN,
        onEnter: (state) => {
          state.phaseLog.push("enter:phase1");
        },
        onExit: (state) => {
          state.phaseLog.push("exit:phase1");
        },
        next: (state) => (state.value >= 2 ? "phase2" : null),
      },
      phase2: {
        allowedActions: ["act"],
        turnOrder: ROUND_ROBIN,
        onEnter: (state) => {
          state.phaseLog.push("enter:phase2");
        },
        onExit: (state) => {
          state.phaseLog.push("exit:phase2");
        },
        next: (state) => (state.value >= 4 ? "phase3" : null),
      },
      phase3: {
        allowedActions: ["act"],
        turnOrder: ROUND_ROBIN,
        onEnter: (state) => {
          state.phaseLog.push("enter:phase3");
        },
      },
    },
    initialPhase: "phase1",
  };
}

describe("Phase Lifecycle", () => {
  it("calls onEnter on initial phase", () => {
    const engine = new CroupierCore(multiPhaseConfig(), ["P1", "P2"]);
    expect(engine.getState().phaseLog).toContain("enter:phase1");
  });

  it("transitions from phase1 to phase2 when condition is met", () => {
    const engine = new CroupierCore(multiPhaseConfig(), ["P1", "P2"]);
    engine.dispatch("P1", "act"); // value = 1
    expect(engine.getEngineState().phase).toBe("phase1");
    engine.dispatch("P2", "act"); // value = 2, triggers transition
    expect(engine.getEngineState().phase).toBe("phase2");
  });

  it("calls onExit and onEnter during phase transition", () => {
    const engine = new CroupierCore(multiPhaseConfig(), ["P1", "P2"]);
    engine.dispatch("P1", "act");
    engine.dispatch("P2", "act");
    const log = engine.getState().phaseLog;
    expect(log).toContain("exit:phase1");
    expect(log).toContain("enter:phase2");
    expect(log.indexOf("exit:phase1")).toBeLessThan(
      log.indexOf("enter:phase2"),
    );
  });

  it("emits phaseChange event on transition", () => {
    const engine = new CroupierCore(multiPhaseConfig(), ["P1", "P2"]);
    const listener = vi.fn();
    engine.on("phaseChange", listener);
    engine.dispatch("P1", "act");
    engine.dispatch("P2", "act");
    expect(listener).toHaveBeenCalled();
    const call = listener.mock.calls.find(
      (c: any) => c[0].from === "phase1" && c[0].to === "phase2",
    );
    expect(call).toBeDefined();
  });
});

// ====================
// Stage lifecycle tests
// ====================

interface StageState extends GameState {
  log: string[];
  drawn: boolean;
  discarded: boolean;
}

function stageConfig(): CroupierConfig<StageState> {
  return {
    name: "stage-game",
    setup: () => ({ log: [], drawn: false, discarded: false }),
    actions: {
      draw: {
        execute: (state) => {
          state.drawn = true;
          state.log.push("draw");
        },
      },
      discard: {
        execute: (state) => {
          state.discarded = true;
          state.log.push("discard");
        },
      },
    },
    phases: {
      playerTurn: {
        turnOrder: ROUND_ROBIN,
        stages: {
          waitingForDraw: {
            allowedActions: ["draw"],
            onEnter: (state) => {
              state.log.push("enter:waitingForDraw");
            },
            onExit: (state) => {
              state.log.push("exit:waitingForDraw");
            },
            next: (state) => (state.drawn ? "waitingForDiscard" : null),
          },
          waitingForDiscard: {
            allowedActions: ["discard"],
            onEnter: (state) => {
              state.log.push("enter:waitingForDiscard");
            },
            onExit: (state) => {
              state.log.push("exit:waitingForDiscard");
            },
            next: (state) => (state.discarded ? "__end__" : null),
          },
        },
        initialStage: "waitingForDraw",
        next: (state) => {
          // Reset for next turn
          state.drawn = false;
          state.discarded = false;
          return "playerTurn";
        },
      },
    },
  };
}

describe("Stage Lifecycle", () => {
  it("enters initial stage", () => {
    const engine = new CroupierCore(stageConfig(), ["P1"]);
    const es = engine.getEngineState();
    expect(es.phase).toBe("playerTurn");
    expect(es.stage).toBe("waitingForDraw");
  });

  it("transitions between stages", () => {
    const engine = new CroupierCore(stageConfig(), ["P1"]);
    engine.dispatch("P1", "draw");
    expect(engine.getEngineState().stage).toBe("waitingForDiscard");
  });

  it("calls onExit/onEnter on stage transition", () => {
    const engine = new CroupierCore(stageConfig(), ["P1"]);
    engine.dispatch("P1", "draw");
    const log = engine.getState().log;
    expect(log).toContain("exit:waitingForDraw");
    expect(log).toContain("enter:waitingForDiscard");
  });

  it('__end__ exits stages and triggers phase next()', () => {
    const engine = new CroupierCore(stageConfig(), ["P1"]);
    engine.dispatch("P1", "draw");
    engine.dispatch("P1", "discard");
    // Should have re-entered playerTurn → waitingForDraw
    expect(engine.getEngineState().stage).toBe("waitingForDraw");
  });

  it("only allows stage-specific actions", () => {
    const engine = new CroupierCore(stageConfig(), ["P1"]);
    // In waitingForDraw stage, only "draw" is allowed
    const result = engine.dispatch("P1", "discard");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not allowed");
  });
});
