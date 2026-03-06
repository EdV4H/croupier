import { DurableObject } from "cloudflare:workers";
import {
  BotManager,
  CroupierCore,
  type EngineState,
  type PlayerId,
  BOT_NAMES,
  createBotId,
  isBotPlayer,
  getActiveTimeoutMs,
  executeBotTakeover,
} from "@croupier/core";
import {
  AVAILABLE_GAMES,
  createGameConfig,
} from "../shared/game-registry.js";
import type { RoomSummary } from "../shared/types.js";

interface Env {
  LOBBY: DurableObjectNamespace;
  GAME_ROOM: DurableObjectNamespace;
}

interface GameRoomState {
  roomId: string;
  gameId: string;
  players: PlayerId[];
  creatorId: string;
  started: boolean;
  createdAt: number;
}

export class GameRoomDO extends DurableObject<Env> {
  private roomId = "";
  private gameId = "";
  private players: PlayerId[] = [];
  private engine: CroupierCore | null = null;
  private botManager: BotManager | null = null;
  private creatorId = "";
  private started = false;
  private createdAt = 0;
  private turnTimeoutDeadline: number | null = null;

  private async saveState(): Promise<void> {
    await this.ctx.storage.put<GameRoomState>("state", {
      roomId: this.roomId,
      gameId: this.gameId,
      players: this.players,
      creatorId: this.creatorId,
      started: this.started,
      createdAt: this.createdAt,
    });
  }

  private async loadState(): Promise<boolean> {
    const state = await this.ctx.storage.get<GameRoomState>("state");
    if (!state) return false;
    this.roomId = state.roomId;
    this.gameId = state.gameId;
    this.players = state.players;
    this.creatorId = state.creatorId;
    this.started = state.started;
    this.createdAt = state.createdAt;
    return true;
  }

  private async updateLobby(): Promise<void> {
    const lobbyId = this.env.LOBBY.idFromName("singleton");
    const lobby = this.env.LOBBY.get(lobbyId);
    const summary: RoomSummary = {
      id: this.roomId,
      gameId: this.gameId,
      players: this.players,
      started: this.started,
      createdAt: this.createdAt,
      creatorId: this.creatorId,
    };
    await lobby.fetch(new Request("http://lobby/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
    }));
  }

  private async scheduleTurnTimeout(): Promise<void> {
    if (!this.engine) return;

    const config = this.engine.getConfig();
    const engineState = this.engine.getEngineState();

    if (engineState.finished) {
      this.turnTimeoutDeadline = null;
      return;
    }

    const timeoutMs = getActiveTimeoutMs(config, engineState);
    if (!timeoutMs) {
      this.turnTimeoutDeadline = null;
      return;
    }

    // Only set timer if there are human players in currentPlayers
    const currentPlayers = Array.isArray(engineState.currentPlayers)
      ? engineState.currentPlayers
      : [engineState.currentPlayers];
    const hasHumans = currentPlayers.some((pid) => !isBotPlayer(pid));
    if (!hasHumans) {
      this.turnTimeoutDeadline = null;
      return;
    }

    this.turnTimeoutDeadline = Date.now() + timeoutMs;
    await this.ctx.storage.setAlarm(this.turnTimeoutDeadline);
  }

  private broadcastGameState(): void {
    if (!this.engine) return;

    const engineState = this.engine.getEngineState();
    const turnDeadline = this.turnTimeoutDeadline;

    for (const ws of this.ctx.getWebSockets()) {
      const tags = this.ctx.getTags(ws);
      const playerId = tags[0];
      if (!playerId) continue;

      try {
        const playerView = this.engine.getPlayerView(playerId);
        const actionLog = this.engine.getPlayerLog(playerId);
        ws.send(
          JSON.stringify({
            type: "gameState",
            data: { playerView, engineState, actionLog, playerId, turnDeadline },
          }),
        );
      } catch {
        // Connection may be closing
      }
    }

    // Auto-delete: schedule cleanup 30s after game finishes (clients see result screen first)
    if (engineState.finished) {
      this.ctx.storage.setAlarm(Date.now() + 30_000);
    }
  }

  async alarm(): Promise<void> {
    await this.loadState();

    // Determine if this is a turn timeout or a cleanup alarm
    if (this.turnTimeoutDeadline && this.engine && !this.engine.getEngineState().finished) {
      // Turn timeout — bot takeover
      this.turnTimeoutDeadline = null;
      const config = this.engine.getConfig();
      if (config.bot) {
        await executeBotTakeover(this.engine, config.bot);
        this.broadcastGameState();
        // Schedule next timeout if game is still going
        await this.scheduleTurnTimeout();
      }
      return;
    }

    // Cleanup alarm — notify clients and remove from Lobby after game finished
    const roomDeletedMsg = JSON.stringify({ type: "roomDeleted" });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(roomDeletedMsg);
        ws.close(1000, "Room expired");
      } catch {
        // Already closed
      }
    }
    const lobbyId = this.env.LOBBY.idFromName("singleton");
    const lobby = this.env.LOBBY.get(lobbyId);
    await lobby.fetch(
      new Request(`http://lobby/rooms/${this.roomId}`, { method: "DELETE" }),
    );
  }

  private broadcastToRoom(message: unknown): void {
    const msg = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        // Connection may be closing
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.loadState();

    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const match = path.match(/^\/ws\/(.+)$/);
      if (!match) return new Response("Bad Request", { status: 400 });
      const playerId = match[1];

      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1], [playerId]);

      // Send initial state after accept
      if (this.started && this.engine) {
        try {
          const playerView = this.engine.getPlayerView(playerId);
          const engineState = this.engine.getEngineState();
          const actionLog = this.engine.getPlayerLog(playerId);
          pair[1].send(
            JSON.stringify({
              type: "gameState",
              data: { playerView, engineState, actionLog, playerId },
            }),
          );
        } catch {
          // Game may not be ready
        }
      }
      pair[1].send(
        JSON.stringify({
          type: "connected",
          data: { roomId: this.roomId, playerId },
        }),
      );

      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    // REST endpoints
    if (request.method === "POST" && path === "/create") {
      const { roomId, gameId, playerId, botCount } = (await request.json()) as {
        roomId: string;
        gameId: string;
        playerId: string;
        botCount?: number;
      };
      const game = AVAILABLE_GAMES.find((g) => g.id === gameId);
      if (!game) return Response.json({ error: `Unknown game: ${gameId}` }, { status: 400 });

      this.roomId = roomId;
      this.gameId = gameId;
      this.creatorId = playerId;
      this.players = [playerId];
      this.createdAt = Date.now();

      if (botCount && botCount > 0) {
        const maxBots = Math.min(botCount, game.maxPlayers - 1, BOT_NAMES.length);
        for (let i = 0; i < maxBots; i++) {
          this.players.push(createBotId(BOT_NAMES[i]));
        }
      }

      await this.saveState();
      await this.updateLobby();
      return Response.json(
        { id: this.roomId, gameId: this.gameId, players: this.players },
        { status: 201 },
      );
    }

    if (request.method === "POST" && path === "/join") {
      const { playerId } = (await request.json()) as { playerId: string };
      if (this.players.includes(playerId))
        return Response.json({ error: "Already in room" }, { status: 400 });

      if (this.started && this.engine) {
        // Mid-game join: delegate to engine's addPlayer
        const result = this.engine.addPlayer(playerId);
        if (!result.ok)
          return Response.json({ error: result.error ?? "Cannot join mid-game" }, { status: 400 });
        this.players.push(playerId);
        await this.saveState();
        this.broadcastToRoom({
          type: "playerJoined",
          data: { playerId, players: this.players },
        });
        this.broadcastGameState();
        await this.updateLobby();
        return Response.json({ gameId: this.gameId, players: this.players });
      }

      // Pre-game join
      const game = AVAILABLE_GAMES.find((g) => g.id === this.gameId)!;
      if (this.players.length >= game.maxPlayers)
        return Response.json({ error: "Room is full" }, { status: 400 });

      this.players.push(playerId);
      await this.saveState();
      this.broadcastToRoom({
        type: "playerJoined",
        data: { playerId, players: this.players },
      });
      await this.updateLobby();
      return Response.json({ gameId: this.gameId, players: this.players });
    }

    if (request.method === "POST" && path === "/start") {
      if (this.started) return Response.json({ error: "Game already started" }, { status: 400 });

      const game = AVAILABLE_GAMES.find((g) => g.id === this.gameId)!;

      // Auto-fill with bots
      let botIdx = 0;
      while (this.players.length < game.minPlayers && botIdx < BOT_NAMES.length) {
        const botId = createBotId(BOT_NAMES[botIdx]);
        if (!this.players.includes(botId)) {
          this.players.push(botId);
        }
        botIdx++;
      }

      const config = createGameConfig(this.gameId, this.players);
      this.engine = new CroupierCore(config, this.players);
      this.started = true;
      await this.saveState();

      // Start BotManager
      const botIds = this.players.filter(isBotPlayer);
      if (botIds.length > 0 && config.bot) {
        this.botManager = new BotManager(this.engine, botIds, { delayMs: 1000 });
        this.engine.on("stateChange", () => {
          this.broadcastGameState();
        });
        this.botManager.start();
      }

      this.broadcastGameState();
      await this.scheduleTurnTimeout();
      await this.updateLobby();
      return Response.json({ started: true });
    }

    if (request.method === "POST" && path === "/delete") {
      const { playerId } = (await request.json()) as { playerId: string };
      if (playerId !== this.creatorId) {
        return Response.json({ error: "Only the room creator can delete it" }, { status: 403 });
      }
      if (this.botManager) {
        this.botManager.stop();
        this.botManager = null;
      }
      const msg = JSON.stringify({ type: "roomDeleted" });
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(msg);
          ws.close(1000, "Room deleted");
        } catch {
          // Connection may be closing
        }
      }
      this.engine = null;
      await this.ctx.storage.deleteAll();
      return Response.json({ ok: true });
    }

    if (request.method === "GET" && path === "/info") {
      return Response.json({
        id: this.roomId,
        gameId: this.gameId,
        players: this.players,
        started: this.started,
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (!this.engine) return;

    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const tags = this.ctx.getTags(ws);
    const playerId = tags[0];
    if (!playerId) return;

    let msg: { type: string; [key: string]: unknown };
    try {
      msg = JSON.parse(raw);
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
      return;
    }

    switch (msg.type) {
      case "action": {
        const { action, payload } = msg as unknown as { action: string; payload?: unknown };
        try {
          const result = this.engine.dispatch(playerId, action, payload);
          ws.send(JSON.stringify({ type: "actionResult", data: result }));
          if (result.ok) {
            this.broadcastGameState();
            await this.scheduleTurnTimeout();
          }
        } catch (e: any) {
          ws.send(JSON.stringify({ type: "error", error: e.message }));
        }
        break;
      }

      case "getState": {
        try {
          const playerView = this.engine.getPlayerView(playerId);
          const engineState = this.engine.getEngineState();
          const actionLog = this.engine.getPlayerLog(playerId);
          ws.send(
            JSON.stringify({
              type: "gameState",
              data: { playerView, engineState, actionLog, playerId },
            }),
          );
        } catch (e: any) {
          ws.send(JSON.stringify({ type: "error", error: e.message }));
        }
        break;
      }

      default:
        ws.send(
          JSON.stringify({ type: "error", error: `Unknown message type: ${msg.type}` }),
        );
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    ws.close(code, reason);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    ws.close(1011, "WebSocket error");
  }
}
