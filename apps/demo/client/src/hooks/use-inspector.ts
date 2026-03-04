import { useEffect, useRef } from "react";
import { createActor, type AnyStateMachine, type AnyActorRef } from "xstate";
import { createBrowserInspector } from "@statelyai/inspect";
import type { PhaseGraph } from "@croupier/core";
import type { GameStateData } from "./use-game-state.js";
import { buildShadowMachine } from "../lib/shadow-machine.js";

/**
 * Manages the lifecycle of a shadow XState actor + Stately Inspector.
 *
 * Opens the Stately Inspector in a popup window (the most reliable mode).
 * When `enabled` flips to true, creates the inspector + shadow actor.
 * Syncs `engineState` changes via GOTO_PHASE / GOTO_STAGE / GAME_END.
 */
export function useInspector(
  phaseGraph: PhaseGraph | null,
  engineState: GameStateData["engineState"] | null,
  enabled: boolean,
) {
  const actorRef = useRef<AnyActorRef | null>(null);
  const inspectorRef = useRef<ReturnType<typeof createBrowserInspector> | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const prevStageRef = useRef<string | undefined>(undefined);

  // Initialize inspector + actor
  useEffect(() => {
    if (!enabled || !phaseGraph) return;

    let actor: AnyActorRef | null = null;
    let inspector: ReturnType<typeof createBrowserInspector> | null = null;

    try {
      const machine = buildShadowMachine(phaseGraph);

      inspector = createBrowserInspector({
        autoStart: true,
      });
      inspectorRef.current = inspector;

      actor = createActor(machine as AnyStateMachine, {
        inspect: inspector.inspect,
      });
      actor.start();
      actorRef.current = actor;

      // Reset tracked state
      prevPhaseRef.current = null;
      prevStageRef.current = undefined;
    } catch {
      // Inspector popup may be blocked — continue without inspector
      console.warn("Failed to initialize State Machine Inspector");
    }

    return () => {
      try { actor?.stop(); } catch { /* ignore */ }
      actorRef.current = null;
      try { inspector?.stop(); } catch { /* ignore */ }
      inspectorRef.current = null;
    };
  }, [phaseGraph, enabled]);

  // Sync engine state → shadow actor
  useEffect(() => {
    const actor = actorRef.current;
    if (!actor || !engineState) return;

    try {
      if (engineState.finished) {
        actor.send({ type: "GAME_END" });
        return;
      }

      // Sync phase changes
      if (engineState.phase !== prevPhaseRef.current) {
        actor.send({ type: "GOTO_PHASE", phase: engineState.phase });
        prevPhaseRef.current = engineState.phase;
        prevStageRef.current = undefined;
      }

      // Sync stage changes
      if (engineState.stage && engineState.stage !== prevStageRef.current) {
        actor.send({ type: "GOTO_STAGE", stage: engineState.stage });
        prevStageRef.current = engineState.stage;
      }
    } catch {
      // Inspector popup may be blocked or closed — ignore to avoid breaking the game UI
    }
  }, [engineState]);
}
