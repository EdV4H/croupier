import { createActor } from "xstate";
import { EventEmitter } from "./events.js";
import type {
  ActionLogEntry,
  CroupierConfig,
  CroupierEvents,
  DispatchResult,
  EngineState,
  GameState,
  PlayerId,
} from "./types.js";
import { deepClone } from "./util/clone.js";
import { createRandom } from "./util/random.js";
import { validateAction, validateConfig } from "./validation.js";
import { buildMachine } from "./machine-builder.js";
import type { MachineCtx } from "./machine-builder.js";

export interface CroupierCoreOptions {
  seed?: number;
}

/**
 * Game engine powered by an XState v5 actor.
 * The public API is unchanged — CroupierConfig compatibility is preserved.
 */
export class CroupierCore<S extends GameState = GameState> {
  private config: CroupierConfig<S>;
  private actor;
  private emitter = new EventEmitter();

  constructor(
    config: CroupierConfig<S>,
    players: PlayerId[],
    options?: CroupierCoreOptions,
  ) {
    validateConfig(config);
    this.config = config;

    const random = createRandom(options?.seed);
    const initialState = config.setup({ numPlayers: players.length, players, random });

    const machine = buildMachine(config, players, initialState);
    this.actor = createActor(machine);
    this.actor.start();
  }

  // ── Read accessors ───────────────────────────────────────

  private get ctx(): MachineCtx<S> {
    return this.actor.getSnapshot().context as MachineCtx<S>;
  }

  getState(): S {
    return deepClone(this.ctx.gameState);
  }

  getEngineState(): EngineState {
    const c = this.ctx;
    return {
      phase: c.phase,
      stage: c.stage,
      currentPlayers: c.currentPlayers,
      finished: c.finished,
      result: c.result,
    };
  }

  getPlayerView(playerId: PlayerId): unknown {
    if (this.config.view) {
      return this.config.view.playerView(deepClone(this.ctx.gameState), playerId);
    }
    return deepClone(this.ctx.gameState);
  }

  getConfig(): CroupierConfig<S> {
    return this.config;
  }

  getLog(): ActionLogEntry[] {
    return [...this.ctx.actionLog];
  }

  on<K extends keyof CroupierEvents<S>>(
    event: K,
    listener: (payload: CroupierEvents<S>[K]) => void,
  ): () => void {
    return this.emitter.on(event as any, listener as any);
  }

  // ── Dispatch ─────────────────────────────────────────────

  dispatch(playerId: PlayerId, actionName: string, payload?: unknown): DispatchResult {
    // Pre-validate (returns user-friendly error messages)
    const error = validateAction(this.config, this.getEngineState(), this.ctx.gameState, playerId, actionName, payload);
    if (error) return { ok: false, error };

    // Snapshot pre-dispatch state for event diffing
    const prevPhase = this.ctx.phase;
    const prevStage = this.ctx.stage;

    // Send DISPATCH → XState processes: executeAction, raise(POST_ACTION),
    // then POST_ACTION → guarded: interrupt | endIf | advanceTurn | checkTransitions
    this.actor.send({ type: "DISPATCH", playerId, actionName, payload });

    // Emit events based on what changed
    const log = this.ctx.actionLog;
    const lastEntry = log[log.length - 1];
    if (lastEntry) this.emitter.emit("action", lastEntry);

    if (this.ctx.finished) {
      this.emitter.emit("gameEnd", {
        result: this.ctx.result!,
        state: deepClone(this.ctx.gameState) as any,
      });
    }

    if (this.ctx.phase !== prevPhase) {
      this.emitter.emit("phaseChange", { from: prevPhase, to: this.ctx.phase });
    }
    if (this.ctx.stage !== prevStage) {
      this.emitter.emit("stageChange", { phase: this.ctx.phase, from: prevStage, to: this.ctx.stage });
    }

    this.emitter.emit("stateChange", {
      state: deepClone(this.ctx.gameState) as any,
      engine: this.getEngineState(),
    });

    return { ok: true };
  }
}
