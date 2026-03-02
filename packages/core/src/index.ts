// Public API
export { CroupierCore } from "./xstate-engine.js";
export type { CroupierCoreOptions } from "./xstate-engine.js";

// Types
export type {
  ActionConfig,
  ActionLogEntry,
  BotDecision,
  BotManagerOptions,
  BotStrategy,
  CroupierConfig,
  CroupierEvents,
  DispatchResult,
  EngineState,
  GameResult,
  GameState,
  InterruptGuard,
  PhaseConfig,
  PhaseContext,
  PlayerId,
  RoleConfig,
  SetupContext,
  StageConfig,
  TurnContext,
  TurnOrder,
  ViewConfig,
} from "./types.js";

// Turn Orders
export { ALTERNATING, ROUND_ROBIN, SIMULTANEOUS, custom } from "./turn-orders.js";

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

// Events
export { EventEmitter } from "./events.js";
