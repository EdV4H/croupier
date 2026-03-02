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
        execute: (game, playerId) => {
          game.value++;
        },
      },
    },
    phases: {
      phase1: {
        allowedActions: ["act"],
        turnOrder: ROUND_ROBIN,
        onEnter: (game) => {
          game.phaseLog.push("enter:phase1");
        },
        onExit: (game) => {
          game.phaseLog.push("exit:phase1");
        },
        transitions: [
          { target: "phase2", guard: (ctx) => ctx.game.value >= 2 },
        ],
      },
      phase2: {
        allowedActions: ["act"],
        turnOrder: ROUND_ROBIN,
        onEnter: (game) => {
          game.phaseLog.push("enter:phase2");
        },
        onExit: (game) => {
          game.phaseLog.push("exit:phase2");
        },
        transitions: [
          { target: "phase3", guard: (ctx) => ctx.game.value >= 4 },
        ],
      },
      phase3: {
        allowedActions: ["act"],
        turnOrder: ROUND_ROBIN,
        onEnter: (game) => {
          game.phaseLog.push("enter:phase3");
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
        execute: (game) => {
          game.drawn = true;
          game.log.push("draw");
        },
      },
      discard: {
        execute: (game) => {
          game.discarded = true;
          game.log.push("discard");
        },
      },
    },
    phases: {
      playerTurn: {
        turnOrder: ROUND_ROBIN,
        stages: {
          waitingForDraw: {
            allowedActions: ["draw"],
            onEnter: (game) => {
              game.log.push("enter:waitingForDraw");
            },
            onExit: (game) => {
              game.log.push("exit:waitingForDraw");
            },
            always: [
              { target: "waitingForDiscard", guard: (ctx) => ctx.game.drawn },
            ],
          },
          waitingForDiscard: {
            allowedActions: ["discard"],
            onEnter: (game) => {
              game.log.push("enter:waitingForDiscard");
            },
            onExit: (game) => {
              game.log.push("exit:waitingForDiscard");
            },
            always: [
              { target: "__done__", guard: (ctx) => ctx.game.discarded },
            ],
          },
        },
        initialStage: "waitingForDraw",
        transitions: [
          {
            target: "playerTurn",
            guard: () => true, // always loop back
          },
        ],
        onEnter: (game) => {
          // Reset for next turn
          game.drawn = false;
          game.discarded = false;
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

  it('"__done__" exits stages and triggers phase transitions', () => {
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
