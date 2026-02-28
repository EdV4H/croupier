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
import { ROUND_ROBIN } from "./turn-orders.js";
import { deepClone } from "./util/clone.js";
import { createRandom } from "./util/random.js";
import { validateAction, validateConfig } from "./validation.js";

export interface CroupierCoreOptions {
  seed?: number;
}

export class CroupierCore<S extends GameState = GameState> {
  private config: CroupierConfig<S>;
  private state: S;
  private engineState: EngineState;
  private emitter = new EventEmitter();
  private actionLog: ActionLogEntry[] = [];
  private phaseActionCount = 0;
  private players: PlayerId[];

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

    // Initialize engine state
    const initialPhase =
      config.initialPhase ?? Object.keys(config.phases)[0];
    this.engineState = {
      phase: initialPhase,
      currentPlayers: [],
      finished: false,
    };

    // Enter the initial phase
    this.enterPhase(initialPhase);
  }

  // ====================
  // Public API
  // ====================

  /** Dispatch an action from a player */
  dispatch(
    playerId: PlayerId,
    actionName: string,
    payload?: unknown,
  ): DispatchResult {
    // 1-4. Validate
    const error = validateAction(
      this.config,
      this.engineState,
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
      phase: this.engineState.phase,
      stage: this.engineState.stage,
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
      // For unrestricted actions that don't end turn, still check transitions
      this.checkCurrentTransitions();
    }

    // 10. Emit state change
    this.emitStateChange();

    return { ok: true };
  }

  /** Get a deep clone of the current game state */
  getState(): S {
    return deepClone(this.state);
  }

  /** Get the engine state (phase, stage, currentPlayers, etc.) */
  getEngineState(): EngineState {
    return { ...this.engineState };
  }

  /** Get the player-specific masked view of the state */
  getPlayerView(playerId: PlayerId): unknown {
    if (this.config.view) {
      return this.config.view.playerView(deepClone(this.state), playerId);
    }
    return deepClone(this.state);
  }

  /** Get the game configuration */
  getConfig(): CroupierConfig<S> {
    return this.config;
  }

  /** Get the action log */
  getLog(): ActionLogEntry[] {
    return [...this.actionLog];
  }

  /** Subscribe to events */
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

    const previousPhase = this.engineState.phase;
    this.engineState.phase = phaseName;
    this.engineState.stage = undefined;
    this.phaseActionCount = 0;

    // Run onEnter
    if (phase.onEnter) {
      phase.onEnter(this.state, this.createPhaseContext());
    }

    // Check if phase has stages
    if (phase.stages && phase.initialStage) {
      this.enterStage(phase, phase.initialStage);
    } else if (phase.stages) {
      // Use first stage if no initialStage specified
      const firstStage = Object.keys(phase.stages)[0];
      if (firstStage) {
        this.enterStage(phase, firstStage);
      } else {
        this.initializeTurnOrder(phase);
      }
    } else {
      this.initializeTurnOrder(phase);
    }

    if (previousPhase !== phaseName) {
      this.emitter.emit("phaseChange", {
        from: previousPhase,
        to: phaseName,
      });
    }

    // Check for auto-advance (phases with no allowedActions)
    this.checkAutoAdvance(phase);
  }

  private enterStage(phase: PhaseConfig<S>, stageName: string): void {
    const stage = phase.stages?.[stageName];
    if (!stage) {
      throw new Error(
        `Stage "${stageName}" not found in phase "${this.engineState.phase}"`,
      );
    }

    const previousStage = this.engineState.stage;
    this.engineState.stage = stageName;

    // Run onEnter
    if (stage.onEnter) {
      stage.onEnter(this.state, this.createPhaseContext());
    }

    // Initialize turn order from stage or phase
    this.initializeTurnOrder(phase, stage);

    this.emitter.emit("stageChange", {
      phase: this.engineState.phase,
      from: previousStage,
      to: stageName,
    });

    // Check for auto-advance of stages
    this.checkStageAutoAdvance(phase, stage);
  }

  private initializeTurnOrder(
    phase: PhaseConfig<S>,
    stage?: StageConfig<S>,
  ): void {
    const turnOrder = this.resolveTurnOrder(phase, stage);
    const ctx = this.createTurnContext();
    const first = turnOrder.first(ctx);
    this.engineState.currentPlayers = first;
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
    const phase = this.config.phases[this.engineState.phase];
    if (!phase) return;

    const stage = this.engineState.stage
      ? phase.stages?.[this.engineState.stage]
      : undefined;

    // Check stage transition first
    if (stage?.next) {
      const nextStage = stage.next(this.state, this.createPhaseContext());
      if (nextStage === "__end__") {
        // Exit stage, check phase next
        if (stage.onExit) {
          stage.onExit(this.state, this.createPhaseContext());
        }
        this.engineState.stage = undefined;
        this.checkPhaseTransition(phase);
        return;
      }
      if (nextStage !== null) {
        // Transition to next stage
        if (stage.onExit) {
          stage.onExit(this.state, this.createPhaseContext());
        }
        this.enterStage(phase, nextStage);
        return;
      }
    }

    // Check if phase should transition (no stages or stage didn't transition)
    if (!stage && phase.next) {
      const nextPhase = phase.next(this.state, this.createPhaseContext());
      if (nextPhase !== null) {
        if (phase.onExit) {
          phase.onExit(this.state, this.createPhaseContext());
        }
        this.enterPhase(nextPhase);
        return;
      }
    }

    // Normal turn progression
    const turnOrder = this.resolveTurnOrder(phase, stage);
    const ctx = this.createTurnContext(lastPlayer);
    const next = turnOrder.next(ctx);

    if (next === null) {
      // Turn order complete — check transitions
      if (stage) {
        this.checkStageTransition(phase, stage);
      } else {
        this.checkPhaseTransition(phase);
      }
    } else {
      this.engineState.currentPlayers = next;
    }
  }

  /**
   * Check transitions without advancing the turn.
   * Used after unrestricted actions that don't end turn.
   */
  private checkCurrentTransitions(): void {
    if (this.engineState.finished) return;

    const phase = this.config.phases[this.engineState.phase];
    if (!phase) return;

    const stage = this.engineState.stage
      ? phase.stages?.[this.engineState.stage]
      : undefined;

    if (stage?.next) {
      const nextStage = stage.next(this.state, this.createPhaseContext());
      if (nextStage === "__end__") {
        if (stage.onExit) {
          stage.onExit(this.state, this.createPhaseContext());
        }
        this.engineState.stage = undefined;
        this.checkPhaseTransition(phase);
        return;
      }
      if (nextStage !== null) {
        if (stage.onExit) {
          stage.onExit(this.state, this.createPhaseContext());
        }
        this.enterStage(phase, nextStage);
        return;
      }
    }

    if (!stage && phase.next) {
      const nextPhase = phase.next(this.state, this.createPhaseContext());
      if (nextPhase !== null) {
        if (phase.onExit) {
          phase.onExit(this.state, this.createPhaseContext());
        }
        this.enterPhase(nextPhase);
        return;
      }
    }
  }

  private checkStageTransition(
    phase: PhaseConfig<S>,
    stage: StageConfig<S>,
  ): void {
    if (stage.next) {
      const nextStage = stage.next(this.state, this.createPhaseContext());
      if (nextStage === "__end__") {
        if (stage.onExit) {
          stage.onExit(this.state, this.createPhaseContext());
        }
        this.engineState.stage = undefined;
        this.checkPhaseTransition(phase);
        return;
      }
      if (nextStage !== null) {
        if (stage.onExit) {
          stage.onExit(this.state, this.createPhaseContext());
        }
        this.enterStage(phase, nextStage);
        return;
      }
    }
    // If no transition, restart turn order
    this.initializeTurnOrder(phase, stage);
  }

  private checkPhaseTransition(phase: PhaseConfig<S>): void {
    if (phase.next) {
      const nextPhase = phase.next(this.state, this.createPhaseContext());
      if (nextPhase !== null) {
        if (phase.onExit) {
          phase.onExit(this.state, this.createPhaseContext());
        }
        this.enterPhase(nextPhase);
        return;
      }
    }
    // If no transition, restart turn order at phase level
    this.initializeTurnOrder(phase);
  }

  // ====================
  // Auto-Advance
  // ====================

  /** Check if a phase should auto-advance (no allowedActions = auto phase) */
  private checkAutoAdvance(phase: PhaseConfig<S>): void {
    if (this.engineState.finished) return;

    const hasAllowedActions =
      phase.allowedActions && phase.allowedActions.length > 0;
    const hasStages = phase.stages && Object.keys(phase.stages).length > 0;

    if (!hasAllowedActions && !hasStages && phase.next) {
      const nextPhase = phase.next(this.state, this.createPhaseContext());
      if (nextPhase !== null) {
        if (phase.onExit) {
          phase.onExit(this.state, this.createPhaseContext());
        }
        this.enterPhase(nextPhase);
      }
    }
  }

  /** Check if a stage should auto-advance */
  private checkStageAutoAdvance(
    phase: PhaseConfig<S>,
    stage: StageConfig<S>,
  ): void {
    if (this.engineState.finished) return;

    const hasAllowedActions =
      stage.allowedActions && stage.allowedActions.length > 0;

    if (!hasAllowedActions && stage.next) {
      const nextStage = stage.next(this.state, this.createPhaseContext());
      if (nextStage === "__end__") {
        if (stage.onExit) {
          stage.onExit(this.state, this.createPhaseContext());
        }
        this.engineState.stage = undefined;
        this.checkPhaseTransition(phase);
      } else if (nextStage !== null) {
        if (stage.onExit) {
          stage.onExit(this.state, this.createPhaseContext());
        }
        this.enterStage(phase, nextStage);
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
    this.engineState.finished = true;
    this.engineState.result = result;

    this.emitter.emit("gameEnd", {
      result,
      state: deepClone(this.state),
    });
    this.emitStateChange();
  }

  // ====================
  // Context Helpers
  // ====================

  private createTurnContext(lastPlayer?: PlayerId): TurnContext {
    return {
      state: this.state,
      players: this.players,
      phase: this.engineState.phase,
      stage: this.engineState.stage,
      lastPlayer,
      actionCount: this.phaseActionCount,
    };
  }

  private createPhaseContext(): PhaseContext {
    return {
      phase: this.engineState.phase,
      stage: this.engineState.stage,
      currentPlayers: this.engineState.currentPlayers,
      players: this.players,
      actionCount: this.phaseActionCount,
    };
  }

  private emitStateChange(): void {
    this.emitter.emit("stateChange", {
      state: deepClone(this.state) as any,
      engine: { ...this.engineState },
    });
  }
}
