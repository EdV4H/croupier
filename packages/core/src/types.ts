// ============================================================
// @croupier/core — Type Definitions (XState v5 Native Design)
// ============================================================

/** Player identifier */
export type PlayerId = string;

/** Base game state — plugins extend this */
export interface GameState {
  [key: string]: unknown;
}

/** Result returned when a game ends */
export interface GameResult {
  winner?: PlayerId | PlayerId[] | null;
  draw?: boolean;
  reason?: string;
  [key: string]: unknown;
}

/** Context passed to setup() */
export interface SetupContext {
  numPlayers: number;
  players: PlayerId[];
  random: {
    shuffle: <T>(arr: T[]) => T[];
    integer: (min: number, max: number) => number;
    pick: <T>(arr: T[]) => T;
  };
}

// ============================================================
// CroupierContext — XState context (unified engine state)
// ============================================================

export interface CroupierContext<S extends GameState = GameState> {
  game: S;
  players: PlayerId[];
  currentPlayers: PlayerId[];
  lastPlayer: PlayerId | null;
  actionCount: number;
  result: GameResult | null;
  log: ActionLogEntry[];
}

// ============================================================
// Turn Order (pure functions, no mutation)
// ============================================================

export interface TurnOrder<S extends GameState = GameState> {
  /** Determine the first player(s) when entering a phase/stage */
  first(ctx: CroupierContext<S>): PlayerId | PlayerId[];
  /** Determine the next player(s) after an action. Return null to signal turn-order completion. */
  next(ctx: CroupierContext<S>): PlayerId | PlayerId[] | null;
}

// ============================================================
// Guarded Transitions
// ============================================================

export interface GuardedTransition<S extends GameState = GameState> {
  target: string;
  guard: (ctx: CroupierContext<S>) => boolean;
}

// ============================================================
// End Conditions (unified interrupts + endIf)
// ============================================================

export interface GameEndCondition<S extends GameState = GameState> {
  guard: (ctx: CroupierContext<S>) => boolean;
  result: (ctx: CroupierContext<S>) => GameResult;
  /** Lower priority = checked first. Default: 100.
   *  Use priority 0 for interrupt-like conditions. */
  priority?: number;
}

// ============================================================
// Actions
// ============================================================

export interface ActionConfig<S extends GameState = GameState> {
  /** Execute the action. Mutates game state or returns partial update. */
  execute: (
    game: S,
    playerId: PlayerId,
    payload: unknown,
    ctx: CroupierContext<S>,
  ) => Partial<S> | void;
  /** Return true/string-error if invalid, false/undefined if valid */
  validate?: (
    game: S,
    playerId: PlayerId,
    payload: unknown,
    ctx: CroupierContext<S>,
  ) => boolean | string;
  /** If true, dispatching this action ends the current player's turn */
  endsTurn?: boolean;
  /** If true, any player can dispatch this action regardless of turn order */
  unrestricted?: boolean;
}

// ============================================================
// Phases & Stages
// ============================================================

export interface StageConfig<S extends GameState = GameState> {
  allowedActions?: string[];
  turnOrder?: TurnOrder<S>;
  onEnter?: (game: S, ctx: CroupierContext<S>) => void;
  onExit?: (game: S, ctx: CroupierContext<S>) => void;
  /** Guard-based transitions evaluated after action/turn completion.
   *  Target: stage name or "__done__" (final stage) */
  always?: GuardedTransition<S>[];
}

export interface PhaseConfig<S extends GameState = GameState> {
  turnOrder?: TurnOrder<S>;
  allowedActions?: string[];
  onEnter?: (game: S, ctx: CroupierContext<S>) => void;
  onExit?: (game: S, ctx: CroupierContext<S>) => void;
  /** Guard-based transitions evaluated on turn-order completion or stage done.
   *  Target: phase name. */
  transitions?: GuardedTransition<S>[];
  /** Guard-based transitions evaluated after every state change (always-check).
   *  Target: phase name. Used for auto-advance phases. */
  always?: GuardedTransition<S>[];
  stages?: { [name: string]: StageConfig<S> };
  initialStage?: string;
  allowedRoles?: string[];
}

// ============================================================
// Roles
// ============================================================

export interface RoleConfig {
  count?: number;
}

// ============================================================
// Bot
// ============================================================

/** A decision returned by a bot strategy */
export interface BotDecision {
  action: string;
  payload?: unknown;
}

/** Strategy that decides what action a bot should take */
export interface BotStrategy<S extends GameState = GameState> {
  /** Decide what action to take. Return null to skip this tick. Can be async for LLM calls. */
  decide(
    playerId: PlayerId,
    playerView: unknown,
    engineState: EngineState,
  ): BotDecision | null | Promise<BotDecision | null>;

  /** Fallback when decide() times out or throws. Optional. */
  fallback?(
    playerId: PlayerId,
    playerView: unknown,
    engineState: EngineState,
  ): BotDecision | null;
}

/** Options for BotManager */
export interface BotManagerOptions {
  /** Delay between bot actions in ms (default: 800) */
  delayMs?: number;
  /** Timeout for decide() in ms (default: 5000) */
  timeoutMs?: number;
}

// ============================================================
// View / Masking
// ============================================================

export interface ViewConfig<S extends GameState = GameState> {
  playerView: (state: S, playerId: PlayerId) => unknown;
}

// ============================================================
// Main Config — what a plugin exports
// ============================================================

export interface CroupierConfig<S extends GameState = GameState> {
  name: string;
  setup: (ctx: SetupContext) => S;
  actions: { [name: string]: ActionConfig<S> };
  phases: { [name: string]: PhaseConfig<S> };
  initialPhase?: string;
  defaultTurnOrder?: TurnOrder<S>;
  /** Unified end conditions (replaces interrupts[] + endIf).
   *  Checked after every action, sorted by priority (lower first). */
  endConditions?: GameEndCondition<S>[];
  view?: ViewConfig<S>;
  roles?: { [name: string]: RoleConfig };
  /** Bot strategy for automated players */
  bot?: BotStrategy<S>;
}

// ============================================================
// Engine State (exposed read-only, derived from XState snapshot)
// ============================================================

export interface EngineState {
  phase: string;
  stage?: string;
  currentPlayers: PlayerId | PlayerId[];
  finished: boolean;
  result?: GameResult;
}

// ============================================================
// Action Log Entry
// ============================================================

export interface ActionLogEntry {
  playerId: PlayerId;
  action: string;
  payload: unknown;
  phase: string;
  stage?: string;
  timestamp: number;
}

// ============================================================
// Events
// ============================================================

export interface CroupierEvents<S extends GameState = GameState> {
  stateChange: { state: S; engine: EngineState };
  phaseChange: { from: string; to: string; stage?: string };
  stageChange: { phase: string; from?: string; to?: string };
  action: ActionLogEntry;
  gameEnd: { result: GameResult; state: S };
}

// ============================================================
// Dispatch result
// ============================================================

export interface DispatchResult {
  ok: boolean;
  error?: string;
}
