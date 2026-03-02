import type { CroupierCore } from "./xstate-engine.js";
import type {
  BotDecision,
  BotManagerOptions,
  BotStrategy,
  GameState,
  PlayerId,
} from "./types.js";

const DEFAULT_DELAY_MS = 800;
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Manages bot players for a CroupierCore instance.
 * Runs a tick loop that checks if any bot should act, then dispatches via the engine.
 */
export class BotManager<S extends GameState = GameState> {
  private engine: CroupierCore<S>;
  private strategy: BotStrategy<S>;
  private botIds: PlayerId[];
  private delayMs: number;
  private timeoutMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    engine: CroupierCore<S>,
    botPlayerIds: PlayerId[],
    options?: BotManagerOptions,
  ) {
    this.engine = engine;
    this.botIds = botPlayerIds;
    this.delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Get strategy from the engine's config
    const config = engine.getConfig();
    if (!config.bot) {
      throw new Error("No bot strategy defined in CroupierConfig");
    }
    this.strategy = config.bot;
  }

  /** Start the bot decision loop */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleTick();
  }

  /** Stop the bot decision loop */
  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Whether the bot manager is currently running */
  isRunning(): boolean {
    return this.running;
  }

  private scheduleTick(): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      void this.tick();
    }, this.delayMs);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    const engineState = this.engine.getEngineState();
    if (engineState.finished) {
      this.stop();
      return;
    }

    const currentPlayers = Array.isArray(engineState.currentPlayers)
      ? engineState.currentPlayers
      : [engineState.currentPlayers];

    // Try bots that are current players first
    let acted = false;
    for (const botId of this.botIds) {
      if (currentPlayers.includes(botId)) {
        acted = await this.tryAct(botId);
        if (acted) break;
      }
    }

    // If no current-player bot acted, try unrestricted actions
    if (!acted) {
      for (const botId of this.botIds) {
        if (!currentPlayers.includes(botId)) {
          acted = await this.tryAct(botId);
          if (acted) break;
        }
      }
    }

    // Check if game ended after the action
    const newState = this.engine.getEngineState();
    if (newState.finished) {
      this.stop();
      return;
    }

    this.scheduleTick();
  }

  private async tryAct(botId: PlayerId): Promise<boolean> {
    const engineState = this.engine.getEngineState();
    const playerView = this.engine.getPlayerView(botId);

    let decision: BotDecision | null = null;

    try {
      decision = await this.decideWithTimeout(botId, playerView, engineState);
    } catch {
      // decide() threw or timed out — try fallback
      if (this.strategy.fallback) {
        decision = this.strategy.fallback(botId, playerView, engineState);
      }
    }

    if (!decision) return false;

    const result = this.engine.dispatch(botId, decision.action, decision.payload);
    return result.ok;
  }

  private decideWithTimeout(
    botId: PlayerId,
    playerView: unknown,
    engineState: ReturnType<CroupierCore<S>["getEngineState"]>,
  ): Promise<BotDecision | null> {
    const result = this.strategy.decide(botId, playerView, engineState);

    // Synchronous return
    if (!(result instanceof Promise)) {
      return Promise.resolve(result);
    }

    // Async return — race with timeout
    return Promise.race([
      result,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Bot decide() timed out")), this.timeoutMs);
      }),
    ]);
  }
}
