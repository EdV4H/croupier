// ============================================================
// Phase Graph — Extract topology from CroupierConfig
// ============================================================

import type { CroupierConfig, GameState } from "./types.js";

export interface PhaseGraphNode {
  name: string;
  stages?: string[];
  initialStage?: string;
  /** Phase names this phase can transition to */
  transitionTargets: string[];
  /** stage → [target stages] (includes "__done__") */
  stageTransitions?: Record<string, string[]>;
}

export interface PhaseGraph {
  gameId: string;
  initialPhase: string;
  phases: PhaseGraphNode[];
}

/**
 * Extract the phase/stage topology from a CroupierConfig.
 * The result is a pure data structure (no functions) suitable for serialization.
 */
export function extractPhaseGraph<S extends GameState>(
  config: CroupierConfig<S>,
): PhaseGraph {
  const phaseNames = Object.keys(config.phases);
  const initialPhase = config.initialPhase ?? phaseNames[0] ?? "";

  const phases: PhaseGraphNode[] = phaseNames.map((phaseName) => {
    const phase = config.phases[phaseName];

    // Collect phase-level transition targets from transitions[] and always[]
    const targetSet = new Set<string>();
    for (const t of phase.transitions ?? []) {
      targetSet.add(t.target);
    }
    for (const t of phase.always ?? []) {
      targetSet.add(t.target);
    }

    const node: PhaseGraphNode = {
      name: phaseName,
      transitionTargets: [...targetSet],
    };

    // Collect stage info if present
    if (phase.stages && Object.keys(phase.stages).length > 0) {
      const stageNames = Object.keys(phase.stages);
      node.stages = stageNames;
      node.initialStage = phase.initialStage ?? stageNames[0];

      const stageTransitions: Record<string, string[]> = {};
      for (const stageName of stageNames) {
        const stage = phase.stages[stageName];
        const stageTargetSet = new Set<string>();
        for (const t of stage.always ?? []) {
          stageTargetSet.add(t.target);
        }
        if (stageTargetSet.size > 0) {
          stageTransitions[stageName] = [...stageTargetSet];
        }
      }
      if (Object.keys(stageTransitions).length > 0) {
        node.stageTransitions = stageTransitions;
      }
    }

    return node;
  });

  return {
    gameId: config.name,
    initialPhase,
    phases,
  };
}
