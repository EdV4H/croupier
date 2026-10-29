/**
 * Room logic: every rule about rooms, turns, timers and bots lives here.
 * Functions take the current state and an input and return the next state plus
 * what to tell clients. No storage, sockets or timers: the host does that.
 */
import {
  BOT_NAMES,
  CroupierCore,
  createBotId,
  executeBotTakeover,
  getActiveTimeoutMs,
  isBotPlayer,
  type BotDecision,
  type BotStrategy,
  type EngineState,
  type PlayerId,
} from "@edv4h/croupier-core";
import type {
  ClientMessage,
  CreateRoomBody,
  GameStateData,
  PlayerBody,
  RoomSummary,
  ServerMessage,
} from "../protocol.js";
import {
  DEFAULT_SETTINGS,
  type Effect,
  type GameRegistry,
  type HttpResult,
  type Outcome,
  type RoomSettings,
  type RoomState,
} from "./types.js";

type Engine = CroupierCore<any>;

const toArray = (p: PlayerId | PlayerId[]) => (Array.isArray(p) ? p : [p]);

function http(status: number, body: unknown): HttpResult {
  return { status, body };
}

function unchanged<T>(state: RoomState | null, result: T, reply: ServerMessage[] = []): Outcome<T> {
  return { state, changed: false, effects: [], reply, result };
}

function changed<T>(
  state: RoomState | null,
  result: T,
  effects: Effect[] = [],
  reply: ServerMessage[] = [],
): Outcome<T> {
  return { state, changed: true, effects, reply, result };
}

export function summarize(state: RoomState): RoomSummary {
  return {
    id: state.id,
    gameId: state.gameId,
    creatorId: state.creatorId,
    players: [...state.players],
    status: state.status,
    started: state.status !== "waiting",
    createdAt: state.createdAt,
  };
}

/** Earliest pending timer, or null */
export function nextWakeup(state: RoomState): number | null {
  const times = Object.values(state.timers).filter((t): t is number => t !== null);
  return times.length > 0 ? Math.min(...times) : null;
}

export class RoomLogic {
  readonly settings: RoomSettings;

  constructor(
    readonly registry: GameRegistry,
    settings?: Partial<RoomSettings>,
  ) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  // ============================================================
  // Queries
  // ============================================================

  /** True when `secret` belongs to `playerId`, a member of the room */
  isMember(state: RoomState | null, playerId: string, secret: string): boolean {
    return !!state && state.players.includes(playerId) && state.secrets[playerId] === secret;
  }

  restoreEngine(state: RoomState): Engine | null {
    if (!state.engine || !state.configPlayers) return null;
    const config = this.registry.createConfig(state.gameId, state.configPlayers, state.gameOptions);
    return CroupierCore.fromSnapshot(config, state.engine);
  }

  gameStateFor(state: RoomState, engine: Engine, playerId: PlayerId): GameStateData {
    return {
      playerView: engine.getPlayerView(playerId),
      engineState: engine.getEngineState(),
      actionLog: engine.getPlayerLog(playerId),
      playerId,
      turnDeadline: state.timers.turnDeadline,
      revision: engine.getRevision(),
    };
  }

  /** Messages a connection receives when it opens */
  onConnect(state: RoomState, playerId: PlayerId): ServerMessage[] {
    const messages: ServerMessage[] = [
      { type: "connected", data: { roomId: state.id, playerId } },
      { type: "room", data: summarize(state) },
    ];
    const engine = this.restoreEngine(state);
    if (engine) messages.push({ type: "gameState", data: this.gameStateFor(state, engine, playerId) });
    return messages;
  }

  // ============================================================
  // Room lifecycle (REST)
  // ============================================================

  create(state: RoomState | null, roomId: string, input: CreateRoomBody, now: number): Outcome<HttpResult> {
    if (state) return unchanged(state, http(409, { error: "Room already exists" }));
    const game = this.registry.games.find((g) => g.id === input.gameId);
    if (!game) return unchanged(null, http(400, { error: `Unknown game: ${input.gameId}` }));

    const players = [input.playerId];
    const botCount = Math.min(input.botCount ?? 0, game.maxPlayers - 1, BOT_NAMES.length);
    for (let i = 0; i < botCount; i++) players.push(createBotId(BOT_NAMES[i]));

    const next: RoomState = {
      version: 1,
      id: roomId,
      gameId: input.gameId,
      creatorId: input.playerId,
      createdAt: now,
      players,
      secrets: { [input.playerId]: input.secret },
      gameOptions: input.gameOptions,
      status: "waiting",
      configPlayers: null,
      engine: null,
      timers: { turnDeadline: null, botAt: null, cleanupAt: now + this.settings.waitingTtlMs },
    };
    return changed(next, http(201, summarize(next)));
  }

  join(state: RoomState | null, input: PlayerBody, now: number): Outcome<HttpResult> {
    if (!state) return unchanged(null, http(404, { error: "Room not found" }));
    const { playerId, secret } = input;

    const owner = state.secrets[playerId];
    if (owner !== undefined && owner !== secret) {
      return unchanged(state, http(403, { error: "That name is already used in this room" }));
    }
    // Rejoin: already seated
    if (state.players.includes(playerId)) return unchanged(state, http(200, summarize(state)));
    if (state.status === "finished") return unchanged(state, http(400, { error: "Game already finished" }));

    const next = structuredClone(state);
    next.secrets[playerId] = secret;

    if (state.status === "playing") {
      const engine = this.restoreEngine(state)!;
      const result = engine.addPlayer(playerId);
      if (!result.ok) return unchanged(state, http(400, { error: result.error ?? "Cannot join mid-game" }));
      next.players.push(playerId);
      this.afterEngineChange(next, engine, now);
      return changed(next, http(200, summarize(next)), [{ type: "broadcastRoom" }, { type: "broadcastState" }]);
    }

    const game = this.registry.games.find((g) => g.id === state.gameId)!;
    if (state.players.length >= game.maxPlayers) return unchanged(state, http(400, { error: "Room is full" }));
    next.players.push(playerId);
    next.timers.cleanupAt = now + this.settings.waitingTtlMs;
    return changed(next, http(200, summarize(next)), [{ type: "broadcastRoom" }]);
  }

  /** Leave a room that has not started. Once started, a seat is kept (timeouts let bots cover it). */
  leave(state: RoomState | null, input: PlayerBody, now: number): Outcome<HttpResult> {
    if (!state) return unchanged(null, http(404, { error: "Room not found" }));
    if (!this.isMember(state, input.playerId, input.secret)) {
      return unchanged(state, http(403, { error: "Not a member of this room" }));
    }
    if (state.status !== "waiting") return unchanged(state, http(200, { left: false }));

    const next = structuredClone(state);
    next.players = next.players.filter((p) => p !== input.playerId);
    delete next.secrets[input.playerId];

    if (next.creatorId === input.playerId) {
      const heir = next.players.find((p) => !isBotPlayer(p));
      if (!heir) return changed(null, http(200, { left: true }), [{ type: "closeAll", reason: "deleted" }]);
      next.creatorId = heir;
    }
    next.timers.cleanupAt = now + this.settings.waitingTtlMs;
    return changed(next, http(200, { left: true }), [{ type: "broadcastRoom" }]);
  }

  start(state: RoomState | null, input: PlayerBody, now: number): Outcome<HttpResult> {
    if (!state) return unchanged(null, http(404, { error: "Room not found" }));
    if (!this.isMember(state, input.playerId, input.secret) || state.creatorId !== input.playerId) {
      return unchanged(state, http(403, { error: "Only the room creator can start the game" }));
    }
    if (state.status !== "waiting") return unchanged(state, http(400, { error: "Game already started" }));

    const next = structuredClone(state);
    const game = this.registry.games.find((g) => g.id === state.gameId)!;
    for (const name of BOT_NAMES) {
      if (next.players.length >= game.minPlayers) break;
      const botId = createBotId(name);
      if (!next.players.includes(botId)) next.players.push(botId);
    }

    let engine: Engine;
    try {
      const config = this.registry.createConfig(next.gameId, next.players, next.gameOptions);
      engine = new CroupierCore(config, next.players);
    } catch (e) {
      return unchanged(state, http(400, { error: e instanceof Error ? e.message : String(e) }));
    }
    next.status = "playing";
    next.configPlayers = [...next.players];
    this.afterEngineChange(next, engine, now);
    return changed(next, http(200, { started: true }), [{ type: "broadcastRoom" }, { type: "broadcastState" }]);
  }

  delete(state: RoomState | null, input: PlayerBody): Outcome<HttpResult> {
    if (!state) return unchanged(null, http(404, { error: "Room not found" }));
    if (!this.isMember(state, input.playerId, input.secret) || state.creatorId !== input.playerId) {
      return unchanged(state, http(403, { error: "Only the room creator can delete it" }));
    }
    return changed(null, http(204, null), [{ type: "closeAll", reason: "deleted" }]);
  }

  // ============================================================
  // WebSocket messages
  // ============================================================

  message(state: RoomState | null, playerId: PlayerId, msg: ClientMessage, now: number): Outcome<void> {
    if (!state) return unchanged(null, undefined, [{ type: "error", error: "Room not found" }]);
    const engine = this.restoreEngine(state);

    if (msg.type === "getState") {
      return unchanged(state, undefined, engine ? [{ type: "gameState", data: this.gameStateFor(state, engine, playerId) }] : []);
    }

    if (!engine) return unchanged(state, undefined, [{ type: "actionResult", data: { ok: false, error: "Game not started" } }]);
    const result = engine.dispatch(playerId, msg.action, msg.payload);
    const reply: ServerMessage[] = [{ type: "actionResult", data: result.ok ? { ok: true } : { ok: false, error: result.error } }];
    if (!result.ok) return unchanged(state, undefined, reply);

    const next = structuredClone(state);
    this.afterEngineChange(next, engine, now);
    return changed(next, undefined, [{ type: "broadcastState" }], reply);
  }

  // ============================================================
  // Timers
  // ============================================================

  /** Run every timer that is due at `now` */
  async wake(state: RoomState | null, now: number): Promise<Outcome<void>> {
    if (!state) return unchanged(null, undefined);
    const { timers } = state;
    if (timers.cleanupAt !== null && now >= timers.cleanupAt) {
      return changed(null, undefined, [{ type: "closeAll", reason: "expired" }]);
    }

    const engine = this.restoreEngine(state);
    if (!engine) return unchanged(state, undefined);
    const strategy = engine.getConfig().bot as BotStrategy | undefined;
    const next = structuredClone(state);
    let dirty = false;
    let moved = false;

    if (next.timers.turnDeadline !== null && now >= next.timers.turnDeadline) {
      dirty = true;
      const before = engine.getRevision();
      if (strategy) {
        try {
          // Same time bound as bot turns: a hung decide() must not block the room's queue
          const bounded: BotStrategy = { ...strategy, decide: (id, view, es) => this.decide(strategy, id, view, es) };
          await executeBotTakeover(engine, bounded);
        } catch {
          // A failing strategy must not break the room; treated as no move
        }
      }
      if (engine.getRevision() !== before) {
        moved = true;
        this.afterEngineChange(next, engine, now);
      } else {
        // Nothing could be played for the idle player: stop retrying every timeout
        next.timers.turnDeadline = null;
      }
    }

    if (next.timers.botAt !== null && now >= next.timers.botAt) {
      dirty = true;
      if (strategy && (await this.botTick(engine, strategy))) {
        moved = true;
        this.afterEngineChange(next, engine, now);
      } else {
        // No bot can act until something changes
        next.timers.botAt = null;
      }
    }

    if (!dirty) return unchanged(state, undefined);
    return changed(next, undefined, moved ? [{ type: "broadcastState" }] : []);
  }

  /** Let one bot act. Bots whose turn it is go first, then bots with unrestricted actions. */
  private async botTick(engine: Engine, strategy: BotStrategy): Promise<boolean> {
    const es = engine.getEngineState();
    if (es.finished) return false;
    const current = toArray(es.currentPlayers);
    const bots = es.players.filter(isBotPlayer);
    const ordered = [...bots.filter((b) => current.includes(b)), ...bots.filter((b) => !current.includes(b))];

    for (const botId of ordered) {
      const decision = await this.decide(strategy, botId, engine.getPlayerView(botId), engine.getEngineState());
      if (decision && engine.dispatch(botId, decision.action, decision.payload).ok) return true;
    }
    return false;
  }

  private async decide(
    strategy: BotStrategy,
    botId: PlayerId,
    view: unknown,
    es: EngineState,
  ): Promise<BotDecision | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve(strategy.decide(botId, view, es)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Bot decide() timed out")), this.settings.botDecideTimeoutMs);
        }),
      ]);
    } catch {
      try {
        return strategy.fallback?.(botId, view, es) ?? null;
      } catch {
        return null;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** Store the engine and recompute every timer after the game state changed */
  private afterEngineChange(next: RoomState, engine: Engine, now: number): void {
    next.engine = engine.toSnapshot({ logLimit: this.settings.logLimit });
    const es = engine.getEngineState();

    if (es.finished) {
      next.status = "finished";
      next.timers = { turnDeadline: null, botAt: null, cleanupAt: now + this.settings.finishedTtlMs };
      return;
    }

    const config = engine.getConfig();
    const timeoutMs = getActiveTimeoutMs(config, es);
    const humanTurn = toArray(es.currentPlayers).some((p) => !isBotPlayer(p));
    const hasBots = !!config.bot && es.players.some(isBotPlayer);
    next.timers = {
      turnDeadline: timeoutMs && humanTurn && config.bot ? now + timeoutMs : null,
      botAt: hasBots ? now + this.settings.botDelayMs : null,
      cleanupAt: now + this.settings.idleTtlMs,
    };
  }
}
