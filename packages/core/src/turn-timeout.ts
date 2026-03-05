import { isBotPlayer } from "./bot-utils.js";
import type {
  BotStrategy,
  CroupierConfig,
  EngineState,
  GameState,
} from "./types.js";

/**
 * CroupierCore-compatible engine interface for turn timeout utilities.
 * Accepts only the subset of CroupierCore methods needed.
 */
export interface TimeoutEngine {
  getEngineState(): EngineState;
  getConfig(): CroupierConfig<any>;
  getPlayerView(playerId: string): unknown;
  dispatch(
    playerId: string,
    action: string,
    payload?: unknown,
  ): { ok: boolean; error?: string };
}

/**
 * Resolve the active timeout value (ms) for the current phase/stage.
 * Stage-level turnTimeoutMs overrides phase-level.
 * Returns undefined if no timeout is configured.
 */
export function getActiveTimeoutMs(
  config: CroupierConfig<any>,
  engineState: EngineState,
): number | undefined {
  const phase = config.phases[engineState.phase];
  if (!phase) return undefined;

  // Stage-level override takes priority
  if (engineState.stage && phase.stages) {
    const stage = phase.stages[engineState.stage];
    if (stage?.turnTimeoutMs !== undefined) {
      return stage.turnTimeoutMs;
    }
  }

  return phase.turnTimeoutMs;
}

/**
 * Execute bot takeover for timed-out human players.
 *
 * Finds all human players in currentPlayers, calls strategy.decide() for each,
 * and dispatches the resulting actions. Returns an array of actions taken.
 *
 * Pure in the sense that it has no timer logic — it simply executes bot decisions
 * for the current turn's human players.
 */
export async function executeBotTakeover(
  engine: TimeoutEngine,
  strategy: BotStrategy<any>,
): Promise<Array<{ playerId: string; decision: { action: string; payload?: unknown } | null }>> {
  const engineState = engine.getEngineState();
  if (engineState.finished) return [];

  const currentPlayers = Array.isArray(engineState.currentPlayers)
    ? engineState.currentPlayers
    : [engineState.currentPlayers];

  // Only take over for human players
  const humanPlayers = currentPlayers.filter((pid) => !isBotPlayer(pid));
  if (humanPlayers.length === 0) return [];

  const results: Array<{ playerId: string; decision: { action: string; payload?: unknown } | null }> = [];

  for (const playerId of humanPlayers) {
    // Re-check engine state — a previous dispatch may have changed things
    const currentState = engine.getEngineState();
    if (currentState.finished) break;

    const currentCurrent = Array.isArray(currentState.currentPlayers)
      ? currentState.currentPlayers
      : [currentState.currentPlayers];
    if (!currentCurrent.includes(playerId)) continue;

    let decision: { action: string; payload?: unknown } | null = null;

    try {
      const playerView = engine.getPlayerView(playerId);
      const result = strategy.decide(playerId, playerView, currentState);
      decision = result instanceof Promise ? await result : result;
    } catch {
      // Try fallback
      if (strategy.fallback) {
        try {
          const playerView = engine.getPlayerView(playerId);
          decision = strategy.fallback(playerId, playerView, currentState);
        } catch {
          // Both failed — skip this player
        }
      }
    }

    if (decision) {
      engine.dispatch(playerId, decision.action, decision.payload);
    }

    results.push({ playerId, decision });
  }

  return results;
}
