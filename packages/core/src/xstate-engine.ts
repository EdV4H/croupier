// ============================================================
// XState Engine — CroupierCore backed by XState v5
// ============================================================
//
// XState manages phase/stage state via a hierarchical state machine.
// The actor's snapshot.value is the source of truth for current phase/stage.
// The dispatch pipeline remains imperative for precise control over
// the interrupt > endIf > transition priority ordering.
//

import { createActor, createMachine, type Actor } from "xstate";
import { EventEmitter } from "./events.js";
import type {
  ActionLogEntry,
  CroupierConfig,
  CroupierEvents,
  DispatchResult,
  EngineState,
  GameResult,
  GameState,
  PhaseConfig,
  PhaseContext,
  PlayerId,
  StageConfig,
  TurnContext,
  TurnOrder,
} from "./types.js";
import { validateAction, validateConfig } from "./validation.js";
import { deepClone } from "./util/clone.js";
import { createRandom } from "./util/random.js";
import { ROUND_ROBIN } from "./turn-orders.js";

export interface CroupierCoreOptions {
  seed?: number;
}

// ============================================================
// Helpers: extract phase/stage from XState snapshot.value
// ============================================================

function extractPhaseStage(value: string | Record<string, unknown>): {
  phase: string;
  stage?: string;
} {
  if (typeof value === "string") {
    return { phase: value };
  }
  const phase = Object.keys(value)[0];
  const stageValue = value[phase];
  if (typeof stageValue === "string" && stageValue !== "__done__") {
    return { phase, stage: stageValue };
  }
  return { phase };
}

// ============================================================
// CroupierCore — XState-backed game engine
// ============================================================

export class CroupierCore<S extends GameState = GameState> {
  private config: CroupierConfig<S>;
  private state: S;
  private emitter = new EventEmitter();
  private actionLog: ActionLogEntry[] = [];
  private phaseActionCount = 0;
  private players: PlayerId[];

  // XState actor — source of truth for phase/stage
  private actor: Actor<any>;
  private currentPlayers: PlayerId | PlayerId[] = [];
  private finished = false;
  private gameResult?: GameResult;

  constructor(
    config: CroupierConfig<S>,
    players: PlayerId[],
    options?: CroupierCoreOptions,
  ) {
    validateConfig(config);
    this.config = config;
    this.players = players;

    // Setup initial state
    const random = createRandom(options?.seed);
    this.state = config.setup({
      numPlayers: players.length,
      players,
      random,
    });

    // Build and start XState machine
    const initialPhase =
      config.initialPhase ?? Object.keys(config.phases)[0];
    this.actor = this.buildMachineAt(initialPhase);

    // Enter the initial phase (runs onEnter, initializes turn order)
    this.enterPhase(initialPhase);
  }

  // ====================
  // XState Machine
  // ====================

  /**
   * Build and start an XState machine positioned at a given phase/stage.
   */
  private buildMachineAt(targetPhase: string, targetStage?: string) {
    const states: Record<string, any> = {};

    for (const [phaseName, phaseConfig] of Object.entries(this.config.phases)) {
      const hasStages =
        phaseConfig.stages && Object.keys(phaseConfig.stages).length > 0;

      if (hasStages) {
        const stageNames = Object.keys(phaseConfig.stages!);
        const initialStage =
          phaseName === targetPhase && targetStage
            ? targetStage
            : phaseConfig.initialStage ?? stageNames[0];

        const childStates: Record<string, any> = {};
        for (const stageName of stageNames) {
          childStates[stageName] = {};
        }
        childStates.__done__ = { type: "final" as const };

        states[phaseName] = {
          initial: initialStage,
          states: childStates,
        };
      } else {
        states[phaseName] = {};
      }
    }

    states.__gameOver__ = { type: "final" as const };

    const machine = createMachine({
      id: this.config.name,
      initial: targetPhase,
      states,
    });

    const actor = createActor(machine);
    actor.start();
    return actor;
  }

  /** Read current phase from the XState actor snapshot */
  private get currentPhase(): string {
    return extractPhaseStage(this.actor.getSnapshot().value as any).phase;
  }

  /** Read current stage from the XState actor snapshot */
  private get currentStage(): string | undefined {
    return extractPhaseStage(this.actor.getSnapshot().value as any).stage;
  }

  /**
   * Transition the XState actor to a new phase/stage.
   * Stops the old actor and creates a new one at the target state.
   */
  private transitionActor(
    targetPhase: string,
    targetStage?: string,
  ): void {
    this.actor.stop();
    this.actor = this.buildMachineAt(targetPhase, targetStage);
  }

  // ====================
  // Public API
  // ====================

  dispatch(
    playerId: PlayerId,
    actionName: string,
    payload?: unknown,
  ): DispatchResult {
    // 1-4. Validate
    const error = validateAction(
      this.config,
      this.getEngineState(),
      this.state,
      playerId,
      actionName,
      payload,
    );
    if (error) {
      return { ok: false, error };
    }

    const actionConfig = this.config.actions[actionName];

    // 5. Execute
    actionConfig.execute(this.state, playerId, payload);

    // 6. Log
    const logEntry: ActionLogEntry = {
      playerId,
      action: actionName,
      payload,
      phase: this.currentPhase,
      stage: this.currentStage,
      timestamp: Date.now(),
    };
    this.actionLog.push(logEntry);
    this.phaseActionCount++;
    this.emitter.emit("action", logEntry);

    // 7. Interrupt check
    if (this.checkInterrupts()) {
      return { ok: true };
    }

    // 8. End-if check
    if (this.checkEndIf()) {
      return { ok: true };
    }

    // 9. Turn progression
    if (actionConfig.endsTurn || !actionConfig.unrestricted) {
      this.advanceTurn(playerId);
    } else {
      this.checkCurrentTransitions();
    }

    // 10. Emit state change
    this.emitStateChange();

    return { ok: true };
  }

  getState(): S {
    return deepClone(this.state);
  }

  getEngineState(): EngineState {
    return {
      phase: this.currentPhase,
      stage: this.currentStage,
      currentPlayers: this.currentPlayers,
      finished: this.finished,
      result: this.gameResult,
    };
  }

  getPlayerView(playerId: PlayerId): unknown {
    if (this.config.view) {
      return this.config.view.playerView(deepClone(this.state), playerId);
    }
    return deepClone(this.state);
  }

  getConfig(): CroupierConfig<S> {
    return this.config;
  }

  getLog(): ActionLogEntry[] {
    return [...this.actionLog];
  }

  on<K extends keyof CroupierEvents<S>>(
    event: K,
    listener: (payload: CroupierEvents<S>[K]) => void,
  ): () => void {
    return this.emitter.on(event as any, listener as any);
  }

  // ====================
  // Phase Machine
  // ====================

  private enterPhase(phaseName: string): void {
    const phase = this.config.phases[phaseName];
    if (!phase) {
      throw new Error(`Phase "${phaseName}" not found`);
    }

    // Capture previous phase BEFORE transitioning the XState actor
    const previousPhase = this.currentPhase;

    // Transition XState actor to new phase
    if (previousPhase !== phaseName) {
      this.transitionActor(phaseName);
    }

    this.phaseActionCount = 0;

    // Run onEnter
    if (phase.onEnter) {
      phase.onEnter(this.state, this.createPhaseContext(phaseName));
    }

    // Check if phase has stages
    if (phase.stages && phase.initialStage) {
      this.enterStage(phase, phase.initialStage, phaseName);
    } else if (phase.stages) {
      const firstStage = Object.keys(phase.stages)[0];
      if (firstStage) {
        this.enterStage(phase, firstStage, phaseName);
      } else {
        this.initializeTurnOrder(phase, undefined, phaseName);
      }
    } else {
      this.initializeTurnOrder(phase, undefined, phaseName);
    }

    if (previousPhase !== phaseName) {
      this.emitter.emit("phaseChange", {
        from: previousPhase,
        to: phaseName,
      });
    }

    // Check for auto-advance
    this.checkAutoAdvance(phase, phaseName);
  }

  private enterStage(
    phase: PhaseConfig<S>,
    stageName: string,
    phaseName: string,
  ): void {
    const stage = phase.stages?.[stageName];
    if (!stage) {
      throw new Error(
        `Stage "${stageName}" not found in phase "${phaseName}"`,
      );
    }

    // Capture previous stage BEFORE transitioning
    const previousStage = this.currentStage;

    // Transition XState actor to new stage
    this.transitionActor(phaseName, stageName);

    if (stage.onEnter) {
      stage.onEnter(this.state, this.createPhaseContext(phaseName, stageName));
    }

    this.initializeTurnOrder(phase, stage, phaseName, stageName);

    this.emitter.emit("stageChange", {
      phase: phaseName,
      from: previousStage,
      to: stageName,
    });

    this.checkStageAutoAdvance(phase, stage, phaseName);
  }

  private initializeTurnOrder(
    phase: PhaseConfig<S>,
    stage?: StageConfig<S>,
    phaseName?: string,
    stageName?: string,
  ): void {
    const turnOrder = this.resolveTurnOrder(phase, stage);
    const ctx = this.createTurnContext(
      undefined,
      phaseName ?? this.currentPhase,
      stageName ?? this.currentStage,
    );
    const first = turnOrder.first(ctx);
    this.currentPlayers = first;
    this.emitStateChange();
  }

  private resolveTurnOrder(
    phase: PhaseConfig<S>,
    stage?: StageConfig<S>,
  ): TurnOrder {
    return (
      stage?.turnOrder ??
      phase.turnOrder ??
      this.config.defaultTurnOrder ??
      ROUND_ROBIN
    );
  }

  // ====================
  // Turn Advancement
  // ====================

  private advanceTurn(lastPlayer: PlayerId): void {
    const phaseName = this.currentPhase;
    const phase = this.config.phases[phaseName];
    if (!phase) return;

    const stageName = this.currentStage;
    const stage = stageName ? phase.stages?.[stageName] : undefined;

    // Check stage transition first
    if (stage?.next) {
      const nextStage = stage.next(
        this.state,
        this.createPhaseContext(phaseName, stageName),
      );
      if (nextStage === "__end__") {
        if (stage.onExit) {
          stage.onExit(
            this.state,
            this.createPhaseContext(phaseName, stageName),
          );
        }
        this.checkPhaseTransition(phase, phaseName);
        return;
      }
      if (nextStage !== null) {
        if (stage.onExit) {
          stage.onExit(
            this.state,
            this.createPhaseContext(phaseName, stageName),
          );
        }
        this.enterStage(phase, nextStage, phaseName);
        return;
      }
    }

    // Check if phase should transition (no stages or stage didn't transition)
    if (!stage && phase.next) {
      const nextPhase = phase.next(
        this.state,
        this.createPhaseContext(phaseName),
      );
      if (nextPhase !== null) {
        if (phase.onExit) {
          phase.onExit(this.state, this.createPhaseContext(phaseName));
        }
        this.enterPhase(nextPhase);
        return;
      }
    }

    // Normal turn progression
    const turnOrder = this.resolveTurnOrder(phase, stage);
    const ctx = this.createTurnContext(lastPlayer, phaseName, stageName);
    const next = turnOrder.next(ctx);

    if (next === null) {
      if (stage) {
        this.checkStageTransition(phase, stage, phaseName, stageName!);
      } else {
        this.checkPhaseTransition(phase, phaseName);
      }
    } else {
      this.currentPlayers = next;
    }
  }

  private checkCurrentTransitions(): void {
    if (this.finished) return;

    const phaseName = this.currentPhase;
    const phase = this.config.phases[phaseName];
    if (!phase) return;

    const stageName = this.currentStage;
    const stage = stageName ? phase.stages?.[stageName] : undefined;

    if (stage?.next) {
      const nextStage = stage.next(
        this.state,
        this.createPhaseContext(phaseName, stageName),
      );
      if (nextStage === "__end__") {
        if (stage.onExit) {
          stage.onExit(
            this.state,
            this.createPhaseContext(phaseName, stageName),
          );
        }
        this.checkPhaseTransition(phase, phaseName);
        return;
      }
      if (nextStage !== null) {
        if (stage.onExit) {
          stage.onExit(
            this.state,
            this.createPhaseContext(phaseName, stageName),
          );
        }
        this.enterStage(phase, nextStage, phaseName);
        return;
      }
    }

    if (!stage && phase.next) {
      const nextPhase = phase.next(
        this.state,
        this.createPhaseContext(phaseName),
      );
      if (nextPhase !== null) {
        if (phase.onExit) {
          phase.onExit(this.state, this.createPhaseContext(phaseName));
        }
        this.enterPhase(nextPhase);
        return;
      }
    }
  }

  private checkStageTransition(
    phase: PhaseConfig<S>,
    stage: StageConfig<S>,
    phaseName: string,
    stageName: string,
  ): void {
    if (stage.next) {
      const nextStage = stage.next(
        this.state,
        this.createPhaseContext(phaseName, stageName),
      );
      if (nextStage === "__end__") {
        if (stage.onExit) {
          stage.onExit(
            this.state,
            this.createPhaseContext(phaseName, stageName),
          );
        }
        this.checkPhaseTransition(phase, phaseName);
        return;
      }
      if (nextStage !== null) {
        if (stage.onExit) {
          stage.onExit(
            this.state,
            this.createPhaseContext(phaseName, stageName),
          );
        }
        this.enterStage(phase, nextStage, phaseName);
        return;
      }
    }
    this.initializeTurnOrder(phase, stage, phaseName, stageName);
  }

  private checkPhaseTransition(
    phase: PhaseConfig<S>,
    phaseName: string,
  ): void {
    if (phase.next) {
      const nextPhase = phase.next(
        this.state,
        this.createPhaseContext(phaseName),
      );
      if (nextPhase !== null) {
        if (phase.onExit) {
          phase.onExit(this.state, this.createPhaseContext(phaseName));
        }
        this.enterPhase(nextPhase);
        return;
      }
    }
    this.initializeTurnOrder(phase, undefined, phaseName);
  }

  // ====================
  // Auto-Advance
  // ====================

  private checkAutoAdvance(phase: PhaseConfig<S>, phaseName: string): void {
    if (this.finished) return;

    const hasAllowedActions =
      phase.allowedActions && phase.allowedActions.length > 0;
    const hasStages = phase.stages && Object.keys(phase.stages).length > 0;

    if (!hasAllowedActions && !hasStages) {
      if (this.checkEndIf()) return;

      if (phase.next) {
        const nextPhase = phase.next(
          this.state,
          this.createPhaseContext(phaseName),
        );
        if (nextPhase !== null) {
          if (phase.onExit) {
            phase.onExit(this.state, this.createPhaseContext(phaseName));
          }
          this.enterPhase(nextPhase);
        }
      }
    }
  }

  private checkStageAutoAdvance(
    phase: PhaseConfig<S>,
    stage: StageConfig<S>,
    phaseName: string,
  ): void {
    if (this.finished) return;

    const hasAllowedActions =
      stage.allowedActions && stage.allowedActions.length > 0;

    if (!hasAllowedActions && stage.next) {
      const stageName = this.currentStage;
      const nextStage = stage.next(
        this.state,
        this.createPhaseContext(phaseName, stageName),
      );
      if (nextStage === "__end__") {
        if (stage.onExit) {
          stage.onExit(
            this.state,
            this.createPhaseContext(phaseName, stageName),
          );
        }
        this.checkPhaseTransition(phase, phaseName);
      } else if (nextStage !== null) {
        if (stage.onExit) {
          stage.onExit(
            this.state,
            this.createPhaseContext(phaseName, stageName),
          );
        }
        this.enterStage(phase, nextStage, phaseName);
      }
    }
  }

  // ====================
  // Interrupts & End
  // ====================

  private checkInterrupts(): boolean {
    if (!this.config.interrupts) return false;

    for (const guard of this.config.interrupts) {
      const result = guard.condition(this.state);
      if (result) {
        this.endGame(result);
        return true;
      }
    }
    return false;
  }

  private checkEndIf(): boolean {
    if (!this.config.endIf) return false;

    const result = this.config.endIf(this.state);
    if (result) {
      this.endGame(result);
      return true;
    }
    return false;
  }

  private endGame(result: GameResult): void {
    this.finished = true;
    this.gameResult = result;

    // Transition XState to final state
    this.actor.stop();
    const finalMachine = createMachine({
      id: this.config.name,
      initial: "__gameOver__",
      states: {
        __gameOver__: { type: "final" as const },
      },
    });
    this.actor = createActor(finalMachine);
    this.actor.start();

    this.emitter.emit("gameEnd", {
      result,
      state: deepClone(this.state),
    });
    this.emitStateChange();
  }

  // ====================
  // Context Helpers
  // ====================

  private createTurnContext(
    lastPlayer?: PlayerId,
    phase?: string,
    stage?: string,
  ): TurnContext {
    return {
      state: this.state,
      players: this.players,
      phase: phase ?? this.currentPhase,
      stage: stage ?? this.currentStage,
      lastPlayer,
      actionCount: this.phaseActionCount,
    };
  }

  private createPhaseContext(
    phase?: string,
    stage?: string,
  ): PhaseContext {
    return {
      phase: phase ?? this.currentPhase,
      stage: stage ?? this.currentStage,
      currentPlayers: this.currentPlayers,
      players: this.players,
      actionCount: this.phaseActionCount,
    };
  }

  private emitStateChange(): void {
    this.emitter.emit("stateChange", {
      state: deepClone(this.state) as any,
      engine: this.getEngineState(),
    });
  }
}
