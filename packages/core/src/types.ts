// ============================================================
// @croupier/core — Type Definitions
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

/** Context available for turn order decisions */
export interface TurnContext {
  state: GameState;
  players: PlayerId[];
  phase: string;
  stage?: string;
  /** The player who just acted (undefined at phase/stage entry) */
  lastPlayer?: PlayerId;
  /** Action count in the current phase/stage */
  actionCount: number;
}

// ============================================================
// Turn Order
// ============================================================

export interface TurnOrder {
  /** Determine the first player(s) when entering a phase/stage */
  first(ctx: TurnContext): PlayerId | PlayerId[];
  /** Determine the next player(s) after an action. Return null to signal turn-order completion. */
  next(ctx: TurnContext): PlayerId | PlayerId[] | null;
}

// ============================================================
// Actions
// ============================================================

export interface ActionConfig<S extends GameState = GameState> {
  /** Execute the action and mutate state */
  execute: (state: S, playerId: PlayerId, payload: unknown) => void;
  /** Return true/string-error if invalid, false/undefined if valid */
  validate?: (state: S, playerId: PlayerId, payload: unknown) => boolean | string;
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
  turnOrder?: TurnOrder;
  onEnter?: (state: S, ctx: PhaseContext) => void;
  onExit?: (state: S, ctx: PhaseContext) => void;
  /** Return next stage name, "__end__" to exit stages, or null to stay */
  next?: (state: S, ctx: PhaseContext) => string | "__end__" | null;
}

export interface PhaseConfig<S extends GameState = GameState> {
  turnOrder?: TurnOrder;
  allowedActions?: string[];
  onEnter?: (state: S, ctx: PhaseContext) => void;
  onExit?: (state: S, ctx: PhaseContext) => void;
  /** Return next phase name, or null to stay */
  next?: (state: S, ctx: PhaseContext) => string | null;
  stages?: { [name: string]: StageConfig<S> };
  initialStage?: string;
  allowedRoles?: string[];
}

/** Context available to phase/stage hooks */
export interface PhaseContext {
  phase: string;
  stage?: string;
  currentPlayers: PlayerId | PlayerId[];
  players: PlayerId[];
  /** Number of actions executed in the current phase */
  actionCount: number;
}

// ============================================================
// Interrupts
// ============================================================

export interface InterruptGuard<S extends GameState = GameState> {
  /** If this returns a non-null GameResult, the game ends immediately */
  condition: (state: S) => GameResult | null;
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
  defaultTurnOrder?: TurnOrder;
  endIf?: (state: S) => GameResult | null;
  interrupts?: InterruptGuard<S>[];
  view?: ViewConfig<S>;
  roles?: { [name: string]: RoleConfig };
  /** Bot strategy for automated players */
  bot?: BotStrategy<S>;
}

// ============================================================
// Engine State (internal, exposed read-only)
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
