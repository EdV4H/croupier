import { DurableObject } from "cloudflare:workers";
import {
  BotManager,
  CroupierCore,
  type EngineState,
  type PlayerId,
  BOT_NAMES,
  createBotId,
  isBotPlayer,
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

export class GameRoomDO extends DurableObject<Env> {
  private roomId = "";
  private gameId = "";
  private players: PlayerId[] = [];
  private engine: CroupierCore | null = null;
  private botManager: BotManager | null = null;
  private started = false;
  private createdAt = 0;

  private async updateLobby(): Promise<void> {
    const lobbyId = this.env.LOBBY.idFromName("singleton");
    const lobby = this.env.LOBBY.get(lobbyId);
    const summary: RoomSummary = {
      id: this.roomId,
      gameId: this.gameId,
      players: this.players,
      started: this.started,
      createdAt: this.createdAt,
    };
    await lobby.fetch(new Request("http://lobby/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
    }));
  }

  private broadcastGameState(): void {
    if (!this.engine) return;

    const engineState = this.engine.getEngineState();
    const actionLog = this.engine.getLog();

    for (const ws of this.ctx.getWebSockets()) {
      const tags = this.ctx.getTags(ws);
      const playerId = tags[0];
      if (!playerId) continue;

      try {
        const playerView = this.engine.getPlayerView(playerId);
        ws.send(
          JSON.stringify({
            type: "gameState",
            data: { playerView, engineState, actionLog, playerId },
          }),
        );
      } catch {
        // Connection may be closing
      }
    }
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
          pair[1].send(
            JSON.stringify({
              type: "gameState",
              data: { playerView, engineState, playerId },
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
      this.players = [playerId];
      this.createdAt = Date.now();

      if (botCount && botCount > 0) {
        const maxBots = Math.min(botCount, game.maxPlayers - 1, BOT_NAMES.length);
        for (let i = 0; i < maxBots; i++) {
          this.players.push(createBotId(BOT_NAMES[i]));
        }
      }

      await this.updateLobby();
      return Response.json(
        { id: this.roomId, gameId: this.gameId, players: this.players },
        { status: 201 },
      );
    }

    if (request.method === "POST" && path === "/join") {
      const { playerId } = (await request.json()) as { playerId: string };
      if (this.started) return Response.json({ error: "Game already started" }, { status: 400 });

      const game = AVAILABLE_GAMES.find((g) => g.id === this.gameId)!;
      if (this.players.length >= game.maxPlayers)
        return Response.json({ error: "Room is full" }, { status: 400 });
      if (this.players.includes(playerId))
        return Response.json({ error: "Already in room" }, { status: 400 });

      this.players.push(playerId);
      this.broadcastToRoom({
        type: "playerJoined",
        data: { playerId, players: this.players },
      });
      await this.updateLobby();
      return Response.json({ players: this.players });
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
      await this.updateLobby();
      return Response.json({ started: true });
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
          const actionLog = this.engine.getLog();
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
