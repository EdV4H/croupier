import {
  type CroupierCore,
  type BotStrategy,
  getActiveTimeoutMs,
  executeBotTakeover,
  isBotPlayer,
} from "@croupier/core";

/**
 * Manages turn timeouts for a game instance using Node.js setTimeout.
 *
 * When the current player(s) don't act within the configured turnTimeoutMs,
 * the bot strategy takes over for idle human players.
 */
export class TurnTimeoutManager {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private deadline: number | undefined = undefined;
  private unsubscribe: (() => void) | null = null;
  private disposed = false;

  constructor(
    private engine: CroupierCore,
    private onTimeout: () => void,
  ) {
    // Listen for state changes to reset the timer
    this.unsubscribe = this.engine.on("stateChange", () => {
      if (!this.disposed) {
        this.scheduleTimeout();
      }
    });

    // Initial schedule
    this.scheduleTimeout();
  }

  /** Schedule or reset the timeout based on current engine state. */
  scheduleTimeout(): void {
    this.clearTimer();

    const engineState = this.engine.getEngineState();
    if (engineState.finished) return;

    const config = this.engine.getConfig();
    const timeoutMs = getActiveTimeoutMs(config, engineState);
    if (!timeoutMs) {
      this.deadline = undefined;
      return;
    }

    // Only set timer if there are human players in currentPlayers
    const currentPlayers = Array.isArray(engineState.currentPlayers)
      ? engineState.currentPlayers
      : [engineState.currentPlayers];
    const hasHumans = currentPlayers.some((pid) => !isBotPlayer(pid));
    if (!hasHumans) {
      this.deadline = undefined;
      return;
    }

    this.deadline = Date.now() + timeoutMs;
    this.timer = setTimeout(async () => {
      if (this.disposed) return;

      const strategy = config.bot;
      if (!strategy) return;

      await executeBotTakeover(this.engine, strategy);
      this.onTimeout();
    }, timeoutMs);
  }

  /** Get the current deadline timestamp for clients. */
  getDeadline(): number | undefined {
    return this.deadline;
  }

  /** Clean up all resources. */
  dispose(): void {
    this.disposed = true;
    this.clearTimer();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.deadline = undefined;
  }
}
