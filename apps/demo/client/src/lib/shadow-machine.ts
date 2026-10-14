/**
 * Shadow Machine — Build a guard-free XState machine from a PhaseGraph.
 *
 * This machine is purely visual: the server is the authority and we
 * synchronize via GOTO_PHASE / GOTO_STAGE / GAME_END events.
 */
import { setup } from "xstate";
import type { PhaseGraph } from "@edv4h/croupier-core";

type ShadowEvent =
  | { type: "GOTO_PHASE"; phase: string }
  | { type: "GOTO_STAGE"; stage: string }
  | { type: "GAME_END" };

export function buildShadowMachine(graph: PhaseGraph) {
  const machineId = graph.gameId;
  const states: Record<string, any> = {};

  for (const phase of graph.phases) {
    const phaseNode: any = {};

    // Build nested stages if present
    if (phase.stages && phase.stages.length > 0) {
      phaseNode.initial = phase.initialStage ?? phase.stages[0];
      phaseNode.states = {};

      for (const stageName of phase.stages) {
        phaseNode.states[stageName] = {
          on: {
            GOTO_STAGE: phase.stages.map((target) => ({
              // Absolute target: #machineId.phaseName.stageName
              target: `#${machineId}.${phase.name}.${target}`,
              guard: ({ event }: { event: ShadowEvent }) =>
                event.type === "GOTO_STAGE" &&
                (event as { type: "GOTO_STAGE"; stage: string }).stage === target,
              reenter: true,
            })),
          },
        };
      }
    }

    states[phase.name] = phaseNode;
  }

  // Add final state for game end
  states["__finished__"] = { type: "final" as const };

  // Build GOTO_PHASE transitions on every non-final state
  const phaseNames = graph.phases.map((p) => p.name);
  for (const name of phaseNames) {
    states[name].on = {
      ...states[name].on,
      // Absolute targets: #machineId.phaseName (sibling states)
      GOTO_PHASE: phaseNames.map((target) => ({
        target: `#${machineId}.${target}`,
        guard: ({ event }: { event: ShadowEvent }) =>
          event.type === "GOTO_PHASE" &&
          (event as { type: "GOTO_PHASE"; phase: string }).phase === target,
        reenter: true,
      })),
      GAME_END: { target: `#${machineId}.__finished__` },
    };
  }

  return setup({
    types: {
      events: {} as ShadowEvent,
    },
  }).createMachine({
    id: machineId,
    initial: graph.initialPhase,
    states,
  });
}
