// ============================================================
// @croupier/core — Type Definitions (XState v5 Native Design)
// ============================================================

import type { GameRandom } from "./util/random.js";

/** Player identifier */
export type PlayerId = string;

/** Base game state — plugins extend this */
export interface GameState {
  [key: string]: unknown;
}

/** Player-specific result data */
export interface PlayerResult {
  rank?: number;
  score?: number;
  stats?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Result returned when a game ends */
export interface GameResult {
  winner?: PlayerId | PlayerId[] | null;
  draw?: boolean;
  reason?: string;
  playerResults?: Record<PlayerId, PlayerResult>;
  rankings?: (PlayerId | PlayerId[])[];
  [key: string]: unknown;
}

/** Context passed to setup() */
export interface SetupContext {
  numPlayers: number;
  players: PlayerId[];
  random: GameRandom;
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
  /** Seeded random shared with setup(). Use this instead of Math.random in
   *  actions and hooks so games stay reproducible and snapshot-safe. */
  random: GameRandom;
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
  /** Turn timeout in ms. Overrides phase-level turnTimeoutMs when set. */
  turnTimeoutMs?: number;
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
  /** Turn timeout in ms. When elapsed, bot strategy takes over for idle human players. */
  turnTimeoutMs?: number;
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
  /** Mask log entries per-player (e.g. hide vote payloads until reveal) */
  logMask?: (entry: ActionLogEntry, viewerPlayerId: PlayerId, game: S) => ActionLogEntry;
  /** Hook called when a player tries to join mid-game via addPlayer().
   *  Return void to allow (plugin updates game state), return false to reject.
   *  If undefined, mid-game joining is not supported (opt-in). */
  onPlayerJoin?: (game: S, playerId: PlayerId, ctx: CroupierContext<S>) => void | false;
  /** Compute a result snapshot from the current game state.
   *  Used for games without endConditions or for mid-game result queries. */
  getResult?: (game: S, ctx: CroupierContext<S>) => GameResult;
}

// ============================================================
// Engine State (exposed read-only, derived from XState snapshot)
// ============================================================

export interface EngineState {
  phase: string;
  stage?: string;
  currentPlayers: PlayerId | PlayerId[];
  players: PlayerId[];
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
  playerJoin: { playerId: PlayerId };
  gameEnd: { result: GameResult; state: S };
}

// ============================================================
// Snapshot
// ============================================================

/** Current snapshot format version. Bumped on breaking format changes. */
export const SNAPSHOT_FORMAT_VERSION = 1;

/** JSON-serializable snapshot of a CroupierCore engine. */
export interface CroupierSnapshot<S extends GameState = GameState> {
  /** Snapshot format version (see SNAPSHOT_FORMAT_VERSION) */
  formatVersion: number;
  /** config.name of the game that produced this snapshot */
  gameName: string;
  /** Monotonic revision, incremented on every state mutation.
   *  Use for optimistic locking when persisting snapshots. */
  revision: number;
  game: S;
  players: PlayerId[];
  currentPlayers: PlayerId[];
  lastPlayer: PlayerId | null;
  actionCount: number;
  phase: string;
  stage: string | null;
  finished: boolean;
  result: GameResult | null;
  /** Internal PRNG state */
  randomState: number;
  /** Action log. Omitted when exported with `log: false`;
   *  may be truncated to the most recent entries with `logLimit`. */
  log?: ActionLogEntry[];
}

export interface SnapshotOptions {
  /** Include the action log (default: true) */
  log?: boolean;
  /** Keep only the most recent N log entries */
  logLimit?: number;
}

// ============================================================
// Dispatch result
// ============================================================

export interface DispatchResult {
  ok: boolean;
  error?: string;
}
