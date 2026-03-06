import { EventEmitter } from "./events.js";
import { resolveTurnOrder } from "./machine-builder.js";
import type {
  ActionLogEntry,
  CroupierConfig,
  CroupierContext,
  CroupierEvents,
  DispatchResult,
  EngineState,
  GameEndCondition,
  GameResult,
  GameState,
  PhaseConfig,
  PlayerId,
  StageConfig,
} from "./types.js";
import { deepClone } from "./util/clone.js";
import { createRandom } from "./util/random.js";
import { validateAction, validateConfig } from "./validation.js";

export interface CroupierCoreOptions {
  seed?: number;
}

export class CroupierCore<S extends GameState = GameState> {
  private config: CroupierConfig<S>;
  private ctx: CroupierContext<S>;
  private emitter = new EventEmitter();
  private phase: string;
  private stage: string | undefined;
  private endConditions: GameEndCondition<S>[];
  private finished = false;

  constructor(
    config: CroupierConfig<S>,
    players: PlayerId[],
    options?: CroupierCoreOptions,
  ) {
    validateConfig(config);
    this.config = config;

    // Setup initial state
    const random = createRandom(options?.seed);
    const game = config.setup({
      numPlayers: players.length,
      players,
      random,
    });

    // Initialize CroupierContext
    this.ctx = {
      game,
      players,
      currentPlayers: [],
      lastPlayer: null,
      actionCount: 0,
      result: null,
      log: [],
    };

    // Sort end conditions by priority
    this.endConditions = [...(config.endConditions ?? [])].sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100),
    );

    // Enter the initial phase
    const initialPhase =
      config.initialPhase ?? Object.keys(config.phases)[0];
    this.phase = initialPhase;
    this.stage = undefined;
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
      this.getEngineState(),
      this.ctx.game,
      playerId,
      actionName,
      payload,
      this.ctx,
    );
    if (error) {
      return { ok: false, error };
    }

    const actionConfig = this.config.actions[actionName];

    // 5. Execute
    const result = actionConfig.execute(this.ctx.game, playerId, payload, this.ctx);
    if (result && typeof result === "object") {
      Object.assign(this.ctx.game, result);
    }

    // 6. Log
    const logEntry: ActionLogEntry = {
      playerId,
      action: actionName,
      payload,
      phase: this.phase,
      stage: this.stage,
      timestamp: Date.now(),
    };
    this.ctx.log.push(logEntry);
    this.ctx.actionCount++;
    this.ctx.lastPlayer = playerId;
    this.emitter.emit("action", logEntry);

    // 7. End condition check (replaces interrupts + endIf)
    if (this.checkEndConditions()) {
      return { ok: true };
    }

    // 8. Turn progression
    if (actionConfig.endsTurn || !actionConfig.unrestricted) {
      this.advanceTurn(playerId);
    } else {
      // For unrestricted actions that don't end turn, still check transitions
      this.checkCurrentTransitions();
    }

    // 9. Emit state change
    this.emitStateChange();

    return { ok: true };
  }

  /** Get a deep clone of the current game state */
  getState(): S {
    return deepClone(this.ctx.game);
  }

  /** Get the engine state (phase, stage, currentPlayers, etc.) */
  getEngineState(): EngineState {
    return {
      phase: this.phase,
      stage: this.stage,
      currentPlayers:
        this.ctx.currentPlayers.length === 1
          ? this.ctx.currentPlayers[0]
          : this.ctx.currentPlayers,
      players: [...this.ctx.players],
      finished: this.finished,
      result: this.ctx.result ?? undefined,
    };
  }

  /** Add a player mid-game. Requires config.onPlayerJoin to be defined. */
  addPlayer(playerId: PlayerId): DispatchResult {
    if (this.finished) {
      return { ok: false, error: "Game already finished" };
    }
    if (this.ctx.players.includes(playerId)) {
      return { ok: false, error: "Player already in game" };
    }
    if (!this.config.onPlayerJoin) {
      return { ok: false, error: "This game does not support mid-game joining" };
    }

    const result = this.config.onPlayerJoin(this.ctx.game, playerId, this.ctx);
    if (result === false) {
      return { ok: false, error: "Join rejected by game" };
    }

    this.ctx.players.push(playerId);
    this.emitter.emit("playerJoin", { playerId });
    this.emitStateChange();

    return { ok: true };
  }

  /** Get the player-specific masked view of the state */
  getPlayerView(playerId: PlayerId): unknown {
    if (this.config.view) {
      return this.config.view.playerView(deepClone(this.ctx.game), playerId);
    }
    return deepClone(this.ctx.game);
  }

  /** Get a result snapshot.
   *  - If finished: returns the final result (deep clone).
   *  - If not finished & config.getResult defined: returns a live snapshot.
   *  - Otherwise: returns null. */
  getResult(): GameResult | null {
    if (this.finished && this.ctx.result) {
      return deepClone(this.ctx.result);
    }
    if (!this.finished && this.config.getResult) {
      return this.config.getResult(this.ctx.game, this.ctx);
    }
    return null;
  }

  /** End the session manually.
   *  - If result is provided, uses that result.
   *  - If config.getResult exists, computes the result from current state.
   *  - Otherwise uses a default result.
   *  Throws if the game is already finished. */
  endSession(result?: GameResult): void {
    if (this.finished) {
      throw new Error("Game already finished");
    }
    const finalResult =
      result ??
      this.config.getResult?.(this.ctx.game, this.ctx) ??
      { reason: "Session ended" };
    this.endGame(finalResult);
  }

  /** Get the game configuration */
  getConfig(): CroupierConfig<S> {
    return this.config;
  }

  /** Get the action log */
  getLog(): ActionLogEntry[] {
    return [...this.ctx.log];
  }

  /** Get the action log masked for a specific player */
  getPlayerLog(playerId: PlayerId): ActionLogEntry[] {
    if (!this.config.logMask) return this.getLog();
    return this.ctx.log.map((entry) =>
      this.config.logMask!(entry, playerId, this.ctx.game),
    );
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

    const previousPhase = this.phase;
    this.phase = phaseName;
    this.stage = undefined;
    this.ctx.actionCount = 0;

    // Run onEnter
    if (phase.onEnter) {
      phase.onEnter(this.ctx.game, this.ctx);
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
        `Stage "${stageName}" not found in phase "${this.phase}"`,
      );
    }

    const previousStage = this.stage;
    this.stage = stageName;

    // Run onEnter
    if (stage.onEnter) {
      stage.onEnter(this.ctx.game, this.ctx);
    }

    // Initialize turn order from stage or phase
    this.initializeTurnOrder(phase, stage);

    this.emitter.emit("stageChange", {
      phase: this.phase,
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
    const turnOrder = resolveTurnOrder(this.config, phase, stage);
    const first = turnOrder.first(this.ctx);
    this.ctx.currentPlayers = Array.isArray(first) ? first : [first];
    this.emitStateChange();
  }

  // ====================
  // Turn Advancement
  // ====================

  private advanceTurn(lastPlayer: PlayerId): void {
    const phase = this.config.phases[this.phase];
    if (!phase) return;

    const stage = this.stage
      ? phase.stages?.[this.stage]
      : undefined;

    // Check stage always-transitions first
    if (stage?.always) {
      for (const t of stage.always) {
        if (t.guard(this.ctx)) {
          if (t.target === "__done__") {
            // Exit stage, check phase transitions
            if (stage.onExit) {
              stage.onExit(this.ctx.game, this.ctx);
            }
            this.stage = undefined;
            this.checkPhaseTransition(phase);
            return;
          }
          // Transition to next stage
          if (stage.onExit) {
            stage.onExit(this.ctx.game, this.ctx);
          }
          this.enterStage(phase, t.target);
          return;
        }
      }
    }

    // Check phase always-transitions (for phases without stages)
    if (!stage && phase.always) {
      for (const t of phase.always) {
        if (t.guard(this.ctx)) {
          if (phase.onExit) {
            phase.onExit(this.ctx.game, this.ctx);
          }
          this.enterPhase(t.target);
          return;
        }
      }
    }

    // Check phase transitions (for turn-order completion)
    if (!stage && phase.transitions) {
      for (const t of phase.transitions) {
        if (t.guard(this.ctx)) {
          if (phase.onExit) {
            phase.onExit(this.ctx.game, this.ctx);
          }
          this.enterPhase(t.target);
          return;
        }
      }
    }

    // Normal turn progression via turn order
    const turnOrder = resolveTurnOrder(this.config, phase, stage);
    this.ctx.lastPlayer = lastPlayer;
    const next = turnOrder.next(this.ctx);

    if (next === null) {
      // Turn order complete — check transitions
      if (stage) {
        this.checkStageTransition(phase, stage);
      } else {
        this.checkPhaseTransition(phase);
      }
    } else {
      this.ctx.currentPlayers = Array.isArray(next) ? next : [next];
    }
  }

  /**
   * Check transitions without advancing the turn.
   * Used after unrestricted actions that don't end turn.
   */
  private checkCurrentTransitions(): void {
    if (this.finished) return;

    const phase = this.config.phases[this.phase];
    if (!phase) return;

    const stage = this.stage
      ? phase.stages?.[this.stage]
      : undefined;

    if (stage?.always) {
      for (const t of stage.always) {
        if (t.guard(this.ctx)) {
          if (t.target === "__done__") {
            if (stage.onExit) {
              stage.onExit(this.ctx.game, this.ctx);
            }
            this.stage = undefined;
            this.checkPhaseTransition(phase);
            return;
          }
          if (stage.onExit) {
            stage.onExit(this.ctx.game, this.ctx);
          }
          this.enterStage(phase, t.target);
          return;
        }
      }
    }

    if (!stage && phase.always) {
      for (const t of phase.always) {
        if (t.guard(this.ctx)) {
          if (phase.onExit) {
            phase.onExit(this.ctx.game, this.ctx);
          }
          this.enterPhase(t.target);
          return;
        }
      }
    }

    if (!stage && phase.transitions) {
      for (const t of phase.transitions) {
        if (t.guard(this.ctx)) {
          if (phase.onExit) {
            phase.onExit(this.ctx.game, this.ctx);
          }
          this.enterPhase(t.target);
          return;
        }
      }
    }
  }

  private checkStageTransition(
    phase: PhaseConfig<S>,
    stage: StageConfig<S>,
  ): void {
    if (stage.always) {
      for (const t of stage.always) {
        if (t.guard(this.ctx)) {
          if (t.target === "__done__") {
            if (stage.onExit) {
              stage.onExit(this.ctx.game, this.ctx);
            }
            this.stage = undefined;
            this.checkPhaseTransition(phase);
            return;
          }
          if (stage.onExit) {
            stage.onExit(this.ctx.game, this.ctx);
          }
          this.enterStage(phase, t.target);
          return;
        }
      }
    }
    // If no transition, restart turn order
    this.initializeTurnOrder(phase, stage);
  }

  private checkPhaseTransition(phase: PhaseConfig<S>): void {
    // Check transitions (on stage-done / turn-order completion)
    if (phase.transitions) {
      for (const t of phase.transitions) {
        if (t.guard(this.ctx)) {
          if (phase.onExit) {
            phase.onExit(this.ctx.game, this.ctx);
          }
          this.enterPhase(t.target);
          return;
        }
      }
    }

    // Check always transitions
    if (phase.always) {
      for (const t of phase.always) {
        if (t.guard(this.ctx)) {
          if (phase.onExit) {
            phase.onExit(this.ctx.game, this.ctx);
          }
          this.enterPhase(t.target);
          return;
        }
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
    if (this.finished) return;

    const hasAllowedActions =
      phase.allowedActions && phase.allowedActions.length > 0;
    const hasStages = phase.stages && Object.keys(phase.stages).length > 0;

    if (!hasAllowedActions && !hasStages) {
      // No actions possible — check endConditions first (e.g., showdown resolves in onEnter)
      if (this.checkEndConditions()) return;

      // Check transitions
      if (phase.transitions) {
        for (const t of phase.transitions) {
          if (t.guard(this.ctx)) {
            if (phase.onExit) {
              phase.onExit(this.ctx.game, this.ctx);
            }
            this.enterPhase(t.target);
            return;
          }
        }
      }

      if (phase.always) {
        for (const t of phase.always) {
          if (t.guard(this.ctx)) {
            if (phase.onExit) {
              phase.onExit(this.ctx.game, this.ctx);
            }
            this.enterPhase(t.target);
            return;
          }
        }
      }
    }
  }

  /** Check if a stage should auto-advance */
  private checkStageAutoAdvance(
    phase: PhaseConfig<S>,
    stage: StageConfig<S>,
  ): void {
    if (this.finished) return;

    const hasAllowedActions =
      stage.allowedActions && stage.allowedActions.length > 0;

    if (!hasAllowedActions && stage.always) {
      for (const t of stage.always) {
        if (t.guard(this.ctx)) {
          if (t.target === "__done__") {
            if (stage.onExit) {
              stage.onExit(this.ctx.game, this.ctx);
            }
            this.stage = undefined;
            this.checkPhaseTransition(phase);
            return;
          }
          if (stage.onExit) {
            stage.onExit(this.ctx.game, this.ctx);
          }
          this.enterStage(phase, t.target);
          return;
        }
      }
    }
  }

  // ====================
  // End Conditions
  // ====================

  private checkEndConditions(): boolean {
    for (const ec of this.endConditions) {
      if (ec.guard(this.ctx)) {
        const result = ec.result(this.ctx);
        this.endGame(result);
        return true;
      }
    }
    return false;
  }

  private endGame(result: GameResult): void {
    this.finished = true;
    this.ctx.result = result;

    this.emitter.emit("gameEnd", {
      result,
      state: deepClone(this.ctx.game),
    });
    this.emitStateChange();
  }

  // ====================
  // Context Helpers
  // ====================

  private emitStateChange(): void {
    this.emitter.emit("stateChange", {
      state: deepClone(this.ctx.game) as any,
      engine: this.getEngineState(),
    });
  }
}
