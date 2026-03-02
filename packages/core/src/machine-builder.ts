/**
 * Builds an XState v5 machine from a CroupierConfig.
 *
 * Machine structure:
 *   active → (DISPATCH) → guards + assign + raise(POST_ACTION)
 *   active → (POST_ACTION) → guarded transitions: interrupt | endIf | advanceTurn
 *   active → gameOver (final)
 *
 * The phase/stage hierarchy lives in XState context. The dispatch pipeline
 * (validate → execute → log → interrupt/endIf → transition/turn advance)
 * is expressed declaratively via XState guards, assign actions, and raise events.
 */
import { setup, assign, raise } from "xstate";
import type {
  ActionLogEntry,
  CroupierConfig,
  GameState,
  PhaseConfig,
  PhaseContext,
  PlayerId,
  StageConfig,
  TurnContext,
  TurnOrder,
} from "./types.js";
import { ROUND_ROBIN } from "./turn-orders.js";

// ── XState context ──────────────────────────────────────────

export interface MachineCtx<S extends GameState = GameState> {
  gameState: S;
  players: PlayerId[];
  config: CroupierConfig<S>;
  phase: string;
  stage?: string;
  currentPlayers: PlayerId | PlayerId[];
  phaseActionCount: number;
  actionLog: ActionLogEntry[];
  finished: boolean;
  result?: { winner?: PlayerId | PlayerId[] | null; draw?: boolean; reason?: string; [k: string]: unknown };
  lastPlayer?: PlayerId;
  /** Stashed dispatch info for POST_ACTION processing */
  _dispatch?: { playerId: PlayerId; endsTurn: boolean; unrestricted: boolean };
}

// ── XState events ───────────────────────────────────────────

type MachineEvent =
  | { type: "DISPATCH"; playerId: PlayerId; actionName: string; payload?: unknown }
  | { type: "POST_ACTION" };

// ── Pure helpers (no side effects) ──────────────────────────

function resolveTurnOrder<S extends GameState>(
  config: CroupierConfig<S>,
  phase: PhaseConfig<S>,
  stage?: StageConfig<S>,
): TurnOrder {
  return stage?.turnOrder ?? phase.turnOrder ?? config.defaultTurnOrder ?? ROUND_ROBIN;
}

function makeTurnCtx<S extends GameState>(ctx: MachineCtx<S>, lastPlayer?: PlayerId): TurnContext {
  return {
    state: ctx.gameState, players: ctx.players, phase: ctx.phase,
    stage: ctx.stage, lastPlayer, actionCount: ctx.phaseActionCount,
  };
}

function makePhaseCtx<S extends GameState>(ctx: MachineCtx<S>): PhaseContext {
  return {
    phase: ctx.phase, stage: ctx.stage, currentPlayers: ctx.currentPlayers,
    players: ctx.players, actionCount: ctx.phaseActionCount,
  };
}

// ── Context mutation helpers (called inside assign) ─────────

function initTurnOrder<S extends GameState>(ctx: MachineCtx<S>, phase: PhaseConfig<S>, stage?: StageConfig<S>): void {
  const to = resolveTurnOrder(ctx.config, phase, stage);
  ctx.currentPlayers = to.first(makeTurnCtx(ctx));
}

function doEnterPhase<S extends GameState>(ctx: MachineCtx<S>, phaseName: string): void {
  const phase = ctx.config.phases[phaseName];
  ctx.phase = phaseName;
  ctx.stage = undefined;
  ctx.phaseActionCount = 0;
  ctx.lastPlayer = undefined;

  if (phase.onEnter) phase.onEnter(ctx.gameState, makePhaseCtx(ctx));

  const hasStages = phase.stages && Object.keys(phase.stages).length > 0;
  if (hasStages) {
    const initialStage = phase.initialStage ?? Object.keys(phase.stages!)[0];
    if (initialStage) doEnterStage(ctx, phase, initialStage);
    else initTurnOrder(ctx, phase);
  } else {
    initTurnOrder(ctx, phase);
  }
}

function doEnterStage<S extends GameState>(ctx: MachineCtx<S>, phase: PhaseConfig<S>, stageName: string): void {
  const stage = phase.stages![stageName];
  ctx.stage = stageName;
  if (stage.onEnter) stage.onEnter(ctx.gameState, makePhaseCtx(ctx));
  initTurnOrder(ctx, phase, stage);
}

/** Auto-advance for phases with no allowedActions/stages. Returns true if game ended. */
function doAutoAdvancePhase<S extends GameState>(ctx: MachineCtx<S>): boolean {
  const phase = ctx.config.phases[ctx.phase];
  const hasActions = phase.allowedActions && phase.allowedActions.length > 0;
  const hasStages = phase.stages && Object.keys(phase.stages).length > 0;
  if (hasActions || hasStages) return false;

  if (ctx.config.endIf) {
    const r = ctx.config.endIf(ctx.gameState);
    if (r) { ctx.finished = true; ctx.result = r; return true; }
  }
  if (phase.next) {
    const np = phase.next(ctx.gameState, makePhaseCtx(ctx));
    if (np !== null) {
      if (phase.onExit) phase.onExit(ctx.gameState, makePhaseCtx(ctx));
      doEnterPhase(ctx, np);
      return doAutoAdvancePhase(ctx);
    }
  }
  return false;
}

/** Auto-advance for stages with no allowedActions. */
function doAutoAdvanceStage<S extends GameState>(ctx: MachineCtx<S>): boolean {
  if (!ctx.stage) return false;
  const phase = ctx.config.phases[ctx.phase];
  const stage = phase.stages?.[ctx.stage];
  if (!stage) return false;
  if ((stage.allowedActions && stage.allowedActions.length > 0) || !stage.next) return false;

  const ns = stage.next(ctx.gameState, makePhaseCtx(ctx));
  if (ns === "__end__") {
    if (stage.onExit) stage.onExit(ctx.gameState, makePhaseCtx(ctx));
    ctx.stage = undefined;
    return doCheckPhaseTransition(ctx);
  }
  if (ns !== null) {
    if (stage.onExit) stage.onExit(ctx.gameState, makePhaseCtx(ctx));
    doEnterStage(ctx, phase, ns);
    return doAutoAdvanceStage(ctx);
  }
  return false;
}

function doCheckPhaseTransition<S extends GameState>(ctx: MachineCtx<S>): boolean {
  const phase = ctx.config.phases[ctx.phase];
  if (phase.next) {
    const np = phase.next(ctx.gameState, makePhaseCtx(ctx));
    if (np !== null) {
      if (phase.onExit) phase.onExit(ctx.gameState, makePhaseCtx(ctx));
      doEnterPhase(ctx, np);
      doAutoAdvancePhase(ctx);
      return true;
    }
  }
  initTurnOrder(ctx, phase);
  return false;
}

function doCheckStageTransition<S extends GameState>(ctx: MachineCtx<S>): boolean {
  const phase = ctx.config.phases[ctx.phase];
  const stage = phase.stages?.[ctx.stage!];
  if (!stage) return false;
  if (stage.next) {
    const ns = stage.next(ctx.gameState, makePhaseCtx(ctx));
    if (ns === "__end__") {
      if (stage.onExit) stage.onExit(ctx.gameState, makePhaseCtx(ctx));
      ctx.stage = undefined;
      return doCheckPhaseTransition(ctx);
    }
    if (ns !== null) {
      if (stage.onExit) stage.onExit(ctx.gameState, makePhaseCtx(ctx));
      doEnterStage(ctx, phase, ns);
      return true;
    }
  }
  initTurnOrder(ctx, phase, stage);
  return false;
}

/** Full turn advance logic (check transitions → advance turn order → reinit on cycle complete). */
function doAdvanceTurn<S extends GameState>(ctx: MachineCtx<S>): void {
  const phase = ctx.config.phases[ctx.phase];
  const stage = ctx.stage ? phase.stages?.[ctx.stage] : undefined;

  // Check stage transition first
  if (ctx.stage && stage?.next) {
    const ns = stage.next(ctx.gameState, makePhaseCtx(ctx));
    if (ns === "__end__") {
      if (stage.onExit) stage.onExit(ctx.gameState, makePhaseCtx(ctx));
      ctx.stage = undefined;
      doCheckPhaseTransition(ctx);
      return;
    }
    if (ns !== null) {
      if (stage.onExit) stage.onExit(ctx.gameState, makePhaseCtx(ctx));
      doEnterStage(ctx, phase, ns);
      return;
    }
  }

  // Phase transition (no stages)
  if (!stage && phase.next) {
    const np = phase.next(ctx.gameState, makePhaseCtx(ctx));
    if (np !== null) {
      if (phase.onExit) phase.onExit(ctx.gameState, makePhaseCtx(ctx));
      doEnterPhase(ctx, np);
      doAutoAdvancePhase(ctx);
      return;
    }
  }

  // Normal turn progression
  const to = resolveTurnOrder(ctx.config, phase, stage);
  const tCtx = makeTurnCtx(ctx, ctx._dispatch!.playerId);
  const next = to.next(tCtx);

  if (next === null) {
    if (ctx.stage && stage) doCheckStageTransition(ctx);
    else doCheckPhaseTransition(ctx);
  } else {
    ctx.currentPlayers = next;
  }
}

/** Check transitions without advancing turn (for unrestricted non-endsTurn actions). */
function doCheckCurrentTransitions<S extends GameState>(ctx: MachineCtx<S>): void {
  const phase = ctx.config.phases[ctx.phase];
  if (ctx.stage) {
    const stage = phase.stages?.[ctx.stage];
    if (stage?.next) {
      const ns = stage.next(ctx.gameState, makePhaseCtx(ctx));
      if (ns === "__end__") {
        if (stage.onExit) stage.onExit(ctx.gameState, makePhaseCtx(ctx));
        ctx.stage = undefined;
        doCheckPhaseTransition(ctx);
        return;
      }
      if (ns !== null) {
        if (stage.onExit) stage.onExit(ctx.gameState, makePhaseCtx(ctx));
        doEnterStage(ctx, phase, ns);
        return;
      }
    }
  } else if (phase.next) {
    const np = phase.next(ctx.gameState, makePhaseCtx(ctx));
    if (np !== null) {
      if (phase.onExit) phase.onExit(ctx.gameState, makePhaseCtx(ctx));
      doEnterPhase(ctx, np);
      doAutoAdvancePhase(ctx);
    }
  }
}

// Helper to extract context fields that may have changed
function snapshot<S extends GameState>(ctx: MachineCtx<S>) {
  return {
    phase: ctx.phase, stage: ctx.stage, currentPlayers: ctx.currentPlayers,
    phaseActionCount: ctx.phaseActionCount, lastPlayer: ctx.lastPlayer,
    finished: ctx.finished, result: ctx.result,
  };
}

// ── Machine builder ─────────────────────────────────────────

export function buildMachine<S extends GameState>(
  config: CroupierConfig<S>,
  players: PlayerId[],
  initialGameState: S,
) {
  const initialPhase = config.initialPhase ?? Object.keys(config.phases)[0];

  // Compute initial context by entering the first phase
  const initCtx: MachineCtx<S> = {
    gameState: initialGameState,
    players,
    config,
    phase: initialPhase,
    stage: undefined,
    currentPlayers: [],
    phaseActionCount: 0,
    actionLog: [],
    finished: false,
    result: undefined,
    lastPlayer: undefined,
    _dispatch: undefined,
  };

  doEnterPhase(initCtx, initialPhase);
  if (!doAutoAdvancePhase(initCtx)) {
    doAutoAdvanceStage(initCtx);
  }

  return setup({
    types: {
      context: {} as MachineCtx<S>,
      events: {} as MachineEvent,
    },

    guards: {
      canDispatch: ({ context, event }) => {
        if (event.type !== "DISPATCH") return false;
        if (context.finished) return false;
        const { playerId, actionName, payload } = event;
        const ac = context.config.actions[actionName];
        if (!ac) return false;

        const phase = context.config.phases[context.phase];
        let allowed: string[] | undefined;
        if (context.stage && phase?.stages?.[context.stage]) {
          allowed = phase.stages[context.stage].allowedActions;
        }
        if (!allowed) allowed = phase?.allowedActions;
        if (allowed && !allowed.includes(actionName)) return false;

        if (!ac.unrestricted) {
          const cp = context.currentPlayers;
          if (!(Array.isArray(cp) ? cp.includes(playerId) : cp === playerId)) return false;
        }

        if (ac.validate) {
          const r = ac.validate(context.gameState, playerId, payload);
          if (r === false || typeof r === "string") return false;
        }
        return true;
      },

      interruptTriggered: ({ context }) => {
        if (!context.config.interrupts) return false;
        return context.config.interrupts.some((g) => g.condition(context.gameState) !== null);
      },

      endIfTriggered: ({ context }) => {
        if (!context.config.endIf) return false;
        return context.config.endIf(context.gameState) !== null;
      },

      actionEndsTurn: ({ context }) => {
        if (!context._dispatch) return false;
        return context._dispatch.endsTurn || !context._dispatch.unrestricted;
      },
    },

    actions: {
      executeAction: assign(({ context, event }) => {
        if (event.type !== "DISPATCH") return {};
        const { playerId, actionName, payload } = event;
        const ac = context.config.actions[actionName];

        ac.execute(context.gameState, playerId, payload);

        const logEntry: ActionLogEntry = {
          playerId, action: actionName, payload,
          phase: context.phase, stage: context.stage, timestamp: Date.now(),
        };

        return {
          actionLog: [...context.actionLog, logEntry],
          phaseActionCount: context.phaseActionCount + 1,
          lastPlayer: playerId,
          _dispatch: { playerId, endsTurn: !!ac.endsTurn, unrestricted: !!ac.unrestricted },
        };
      }),

      raisePostAction: raise({ type: "POST_ACTION" }),

      applyInterrupt: assign(({ context }) => {
        if (!context.config.interrupts) return {};
        for (const g of context.config.interrupts) {
          const r = g.condition(context.gameState);
          if (r) return { finished: true, result: r };
        }
        return {};
      }),

      applyEndIf: assign(({ context }) => {
        if (!context.config.endIf) return {};
        const r = context.config.endIf(context.gameState);
        if (r) return { finished: true, result: r };
        return {};
      }),

      advanceTurn: assign(({ context }) => {
        doAdvanceTurn(context);
        return snapshot(context);
      }),

      checkTransitionsOnly: assign(({ context }) => {
        doCheckCurrentTransitions(context);
        return snapshot(context);
      }),
    },
  }).createMachine({
    id: "croupier",
    initial: "active",
    context: initCtx,
    states: {
      active: {
        on: {
          DISPATCH: {
            guard: "canDispatch",
            actions: ["executeAction", "raisePostAction"],
          },
          POST_ACTION: [
            { target: "gameOver", guard: "interruptTriggered", actions: ["applyInterrupt"] },
            { target: "gameOver", guard: "endIfTriggered", actions: ["applyEndIf"] },
            { guard: "actionEndsTurn", actions: ["advanceTurn"] },
            { actions: ["checkTransitionsOnly"] },
          ],
        },
      },
      gameOver: { type: "final" },
    },
  });
}
