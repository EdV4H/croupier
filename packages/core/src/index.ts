// Public API
export { CroupierCore } from "./croupier-core.js";
export type { CroupierCoreOptions } from "./croupier-core.js";

// Types
export type {
  ActionConfig,
  ActionLogEntry,
  BotDecision,
  BotManagerOptions,
  BotStrategy,
  CroupierConfig,
  CroupierContext,
  CroupierEvents,
  DispatchResult,
  EngineState,
  GameEndCondition,
  GameResult,
  GameState,
  GuardedTransition,
  PhaseConfig,
  PlayerId,
  RoleConfig,
  SetupContext,
  StageConfig,
  TurnOrder,
  ViewConfig,
} from "./types.js";

// Turn Orders
export { ALTERNATING, ROUND_ROBIN, SIMULTANEOUS, custom } from "./turn-orders.js";

// Machine Builder (optional XState integration)
export { resolveTurnOrder } from "./machine-builder.js";

// Bot
export { BotManager } from "./bot-manager.js";
export {
  BOT_NAMES,
  BOT_PREFIX,
  createBotId,
  getBotDisplayName,
  isBotPlayer,
} from "./bot-utils.js";

// Utilities
export { countOnly, deepClone, maskArray } from "./util/clone.js";
export { createRandom, SeededRandom } from "./util/random.js";

// Phase Graph
export { extractPhaseGraph } from "./phase-graph.js";
export type { PhaseGraph, PhaseGraphNode } from "./phase-graph.js";

// Turn Timeout
export { getActiveTimeoutMs, executeBotTakeover } from "./turn-timeout.js";
export type { TimeoutEngine } from "./turn-timeout.js";

// Events
export { EventEmitter } from "./events.js";
