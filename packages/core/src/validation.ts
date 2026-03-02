import type {
  CroupierConfig,
  CroupierContext,
  EngineState,
  GameState,
  PlayerId,
} from "./types.js";

/**
 * Validate that an action can be dispatched by a player.
 * Returns null if valid, or an error string if invalid.
 */
export function validateAction<S extends GameState>(
  config: CroupierConfig<S>,
  engineState: EngineState,
  game: S,
  playerId: PlayerId,
  actionName: string,
  payload: unknown,
  ctx: CroupierContext<S>,
): string | null {
  // 1. Game must not be finished
  if (engineState.finished) {
    return "Game is already finished";
  }

  // 2. Action must exist
  const actionConfig = config.actions[actionName];
  if (!actionConfig) {
    return `Unknown action: ${actionName}`;
  }

  // 3. Check allowed actions for current phase/stage
  const phase = config.phases[engineState.phase];
  if (!phase) {
    return `Unknown phase: ${engineState.phase}`;
  }

  let allowedActions: string[] | undefined;
  if (engineState.stage && phase.stages?.[engineState.stage]) {
    allowedActions = phase.stages[engineState.stage].allowedActions;
  }
  if (!allowedActions) {
    allowedActions = phase.allowedActions;
  }

  if (allowedActions && !allowedActions.includes(actionName)) {
    return `Action "${actionName}" is not allowed in phase "${engineState.phase}"${engineState.stage ? ` stage "${engineState.stage}"` : ""}`;
  }

  // 4. Check turn order (unless action is unrestricted)
  if (!actionConfig.unrestricted) {
    const currentPlayers = engineState.currentPlayers;
    const isCurrentPlayer = Array.isArray(currentPlayers)
      ? currentPlayers.includes(playerId)
      : currentPlayers === playerId;

    if (!isCurrentPlayer) {
      return `It is not player "${playerId}"'s turn`;
    }
  }

  // 5. Check role restrictions
  if (phase.allowedRoles && config.roles) {
    // Role checking would be done with player-role assignments
    // For now, roles are stored in game state by the plugin
  }

  // 6. Check action-specific validation
  if (actionConfig.validate) {
    const result = actionConfig.validate(game, playerId, payload, ctx);
    if (result === false) {
      return `Action "${actionName}" validation failed`;
    }
    if (typeof result === "string") {
      return result;
    }
  }

  return null;
}

/**
 * Validate a CroupierConfig at construction time.
 * Throws if config is structurally invalid.
 */
export function validateConfig<S extends GameState>(
  config: CroupierConfig<S>,
): void {
  if (!config.name) {
    throw new Error("CroupierConfig requires a name");
  }
  if (!config.setup) {
    throw new Error("CroupierConfig requires a setup function");
  }
  if (!config.phases || Object.keys(config.phases).length === 0) {
    throw new Error("CroupierConfig requires at least one phase");
  }
  if (!config.actions) {
    throw new Error("CroupierConfig requires an actions object");
  }

  // Validate initialPhase exists
  if (config.initialPhase && !config.phases[config.initialPhase]) {
    throw new Error(
      `initialPhase "${config.initialPhase}" is not defined in phases`,
    );
  }

  // Validate that allowedActions reference existing actions
  for (const [phaseName, phase] of Object.entries(config.phases)) {
    if (phase.allowedActions) {
      for (const action of phase.allowedActions) {
        if (!config.actions[action]) {
          throw new Error(
            `Phase "${phaseName}" references unknown action "${action}"`,
          );
        }
      }
    }
    if (phase.stages) {
      for (const [stageName, stage] of Object.entries(phase.stages)) {
        if (stage.allowedActions) {
          for (const action of stage.allowedActions) {
            if (!config.actions[action]) {
              throw new Error(
                `Stage "${stageName}" in phase "${phaseName}" references unknown action "${action}"`,
              );
            }
          }
        }
      }
      // Validate initialStage exists
      if (phase.initialStage && !phase.stages[phase.initialStage]) {
        throw new Error(
          `Phase "${phaseName}" initialStage "${phase.initialStage}" is not defined in stages`,
        );
      }
    }
  }
}
