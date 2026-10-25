/**
 * @edv4h/croupier-core/testing
 *
 * Helpers for verifying that a game survives snapshot → JSON → restore
 * at every step of play. Intended for plugin test suites.
 */
import { CroupierCore } from "./croupier-core.js";
import type {
  ActionLogEntry,
  BotDecision,
  CroupierConfig,
  CroupierSnapshot,
  EngineState,
  GameState,
  PlayerId,
} from "./types.js";

export type RoundTripDecide<S extends GameState> = (
  engine: CroupierCore<S>,
  playerId: PlayerId,
  engineState: EngineState,
) => BotDecision | null | Promise<BotDecision | null>;

export interface SnapshotRoundTripOptions<S extends GameState> {
  seed?: number;
  /** Max number of dispatches to play (default: 500) */
  maxSteps?: number;
  /** Decide the next action for a player. Default: config.bot.decide() */
  decide?: RoundTripDecide<S>;
}

export interface SnapshotRoundTripResult<S extends GameState> {
  /** Number of dispatches played */
  steps: number;
  finished: boolean;
  /** Why play stopped */
  stopReason: "finished" | "maxSteps" | "noDecision" | "rejected";
  /** Error of the rejected dispatch, when stopReason is "rejected" */
  error?: string;
  /** The original (never restored) engine after play */
  engine: CroupierCore<S>;
}

/** Round-trip a snapshot through JSON, as a store like Redis would */
export function jsonRoundTrip<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Play a game while checking, before and after every dispatch, that an engine
 * restored from a JSON round-tripped snapshot is indistinguishable from the original:
 * same engine state, player views, logs and snapshot, and the same outcome for the
 * same dispatch (including anything drawn from ctx.random).
 *
 * Throws an Error describing the first mismatch.
 */
export async function runSnapshotRoundTrip<S extends GameState>(
  config: CroupierConfig<S>,
  players: PlayerId[],
  options: SnapshotRoundTripOptions<S> = {},
): Promise<SnapshotRoundTripResult<S>> {
  const maxSteps = options.maxSteps ?? 500;
  const decide = options.decide ?? defaultDecide(config);
  const engine = new CroupierCore(config, players, { seed: options.seed ?? 1 });

  let steps = 0;
  let stopReason: SnapshotRoundTripResult<S>["stopReason"] = "maxSteps";
  let error: string | undefined;
  while (steps < maxSteps) {
    const restored = CroupierCore.fromSnapshot(
      config,
      jsonRoundTrip(engine.toSnapshot()),
    );
    assertEquivalent(engine, restored, `step ${steps} (restore)`, false);

    const engineState = engine.getEngineState();
    if (engineState.finished) {
      stopReason = "finished";
      break;
    }

    const next = await pickNext(engine, decide, engineState);
    if (!next) {
      stopReason = "noDecision";
      break;
    }

    const a = engine.dispatch(next.playerId, next.decision.action, next.decision.payload);
    const b = restored.dispatch(next.playerId, next.decision.action, jsonRoundTrip(next.decision.payload));
    const label = `step ${steps} (${next.playerId} ${next.decision.action})`;
    assertSame(a, b, `${label} dispatch result`);
    // Log timestamps come from the wall clock, so ignore them after a fresh dispatch
    assertEquivalent(engine, restored, `${label} after dispatch`, true);
    if (!a.ok) {
      stopReason = "rejected";
      error = a.error;
      break;
    }
    steps++;
  }

  return { steps, finished: engine.getEngineState().finished, stopReason, error, engine };
}

function defaultDecide<S extends GameState>(
  config: CroupierConfig<S>,
): RoundTripDecide<S> {
  const bot = config.bot;
  if (!bot) {
    throw new Error(`Game "${config.name}" has no bot strategy; pass options.decide`);
  }
  return (engine, playerId, engineState) =>
    bot.decide(playerId, engine.getPlayerView(playerId), engineState);
}

/** Pick the first candidate decision that the engine accepts (trial-dispatched on a throwaway copy) */
async function pickNext<S extends GameState>(
  engine: CroupierCore<S>,
  decide: RoundTripDecide<S>,
  engineState: EngineState,
): Promise<{ playerId: PlayerId; decision: BotDecision } | null> {
  const current = ([] as PlayerId[]).concat(engineState.currentPlayers);
  const candidates = [
    ...current,
    ...engineState.players.filter((p) => !current.includes(p)),
  ];
  let rejected: { playerId: PlayerId; decision: BotDecision } | null = null;
  for (const playerId of candidates) {
    const decision = await decide(engine, playerId, engineState);
    if (!decision) continue;
    const trial = CroupierCore.fromSnapshot(engine.getConfig(), engine.toSnapshot({ logLimit: 0 }));
    if (trial.dispatch(playerId, decision.action, decision.payload).ok) {
      return { playerId, decision };
    }
    rejected ??= { playerId, decision };
  }
  // Nothing accepted: return a rejected decision so the caller reports it
  return rejected;
}

function assertEquivalent<S extends GameState>(
  a: CroupierCore<S>,
  b: CroupierCore<S>,
  label: string,
  ignoreTimestamps: boolean,
): void {
  const logs = (log: ActionLogEntry[]) =>
    ignoreTimestamps ? log.map(({ timestamp: _t, ...rest }) => rest) : log;
  assertSame(a.getEngineState(), b.getEngineState(), `${label}: engine state`);
  assertSame(a.getRevision(), b.getRevision(), `${label}: revision`);
  assertSame(a.getResult(), b.getResult(), `${label}: result`);
  for (const p of a.getEngineState().players) {
    assertSame(a.getPlayerView(p), b.getPlayerView(p), `${label}: player view of ${p}`);
    assertSame(logs(a.getPlayerLog(p)), logs(b.getPlayerLog(p)), `${label}: player log of ${p}`);
  }
  const snapshot = (e: CroupierCore<S>): CroupierSnapshot<S> => {
    const snap = e.toSnapshot();
    return { ...snap, log: logs(snap.log) as ActionLogEntry[] };
  };
  assertSame(snapshot(a), snapshot(b), `${label}: snapshot`);
}

function assertSame(a: unknown, b: unknown, label: string): void {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) {
    throw new Error(`Snapshot round-trip mismatch at ${label}\n  original: ${ja}\n  restored: ${jb}`);
  }
}
