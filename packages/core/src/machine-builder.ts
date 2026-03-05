/**
 * machine-builder.ts
 *
 * Converts CroupierConfig into an XState v5 machine definition.
 * This enables using XState's inspector, visualization, and actor model
 * for games built with Croupier.
 *
 * The primary engine (CroupierCore) uses the config directly for maximum
 * control and performance. This module provides an optional XState integration.
 */
import { setup, assign, type MachineContext } from "xstate";
import type {
  CroupierConfig,
  CroupierContext,
  GameEndCondition,
  GameState,
  GuardedTransition,
  PhaseConfig,
  PlayerId,
  StageConfig,
  TurnOrder,
} from "./types.js";
import { ROUND_ROBIN } from "./turn-orders.js";

// ============================================================
// Types
// ============================================================

type GameMachineContext<S extends GameState> = CroupierContext<S> & {
  _phase: string;
  _stage: string | undefined;
};

type GameMachineEvent =
  | { type: "DISPATCH"; playerId: PlayerId; action: string; payload?: unknown };

// ============================================================
// Helper: resolve turn order
// ============================================================

export function resolveTurnOrder<S extends GameState>(
  config: CroupierConfig<S>,
  phase: PhaseConfig<S>,
  stage?: StageConfig<S>,
): TurnOrder<S> {
  return (
    stage?.turnOrder ??
    phase.turnOrder ??
    config.defaultTurnOrder ??
    (ROUND_ROBIN as TurnOrder<S>)
  );
}

// ============================================================
// Build XState machine from CroupierConfig
// ============================================================

export function buildMachineConfig<S extends GameState>(
  config: CroupierConfig<S>,
): {
  phases: string[];
  initialPhase: string;
  endConditions: GameEndCondition<S>[];
} {
  const phases = Object.keys(config.phases);
  const initialPhase = config.initialPhase ?? phases[0];
  const endConditions = [...(config.endConditions ?? [])].sort(
    (a, b) => (a.priority ?? 100) - (b.priority ?? 100),
  );

  return { phases, initialPhase, endConditions };
}
