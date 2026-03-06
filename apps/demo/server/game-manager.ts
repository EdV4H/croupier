import {
  BotManager,
  CroupierCore,
  type EngineState,
  type PlayerId,
  type PhaseGraph,
  BOT_NAMES,
  createBotId,
  isBotPlayer,
  extractPhaseGraph,
} from "@croupier/core";
export type { GameInfo } from "./shared/types.js";
export { AVAILABLE_GAMES, createGameConfig } from "./shared/game-registry.js";
import { AVAILABLE_GAMES, createGameConfig } from "./shared/game-registry.js";
import { TurnTimeoutManager } from "./turn-timeout-manager.js";

export interface Room {
  id: string;
  gameId: string;
  creatorId: PlayerId;
  players: PlayerId[];
  engine: CroupierCore | null;
  botManager: BotManager | null;
  turnTimeoutManager: TurnTimeoutManager | null;
  started: boolean;
  createdAt: number;
}

export class GameManager {
  private rooms = new Map<string, Room>();
  /** Callback invoked when a bot acts, so the server can broadcast state updates */
  onBotAction: ((roomId: string) => void) | null = null;

  private generateRoomId(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 100; attempt++) {
      let id = "";
      for (let i = 0; i < 4; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }
      if (!this.rooms.has(id)) return id;
    }
    throw new Error("Failed to generate unique room ID");
  }

  createRoom(gameId: string, creatorId: PlayerId, botCount?: number): Room {
    const game = AVAILABLE_GAMES.find((g) => g.id === gameId);
    if (!game) throw new Error(`Unknown game: ${gameId}`);

    const id = this.generateRoomId();
    const room: Room = {
      id,
      gameId,
      creatorId,
      players: [creatorId],
      engine: null,
      botManager: null,
      turnTimeoutManager: null,
      started: false,
      createdAt: Date.now(),
    };

    // Add requested bots
    if (botCount && botCount > 0) {
      const maxBots = Math.min(botCount, game.maxPlayers - 1, BOT_NAMES.length);
      for (let i = 0; i < maxBots; i++) {
        const botId = createBotId(BOT_NAMES[i]);
        room.players.push(botId);
      }
    }

    this.rooms.set(id, room);
    return room;
  }

  joinRoom(roomId: string, playerId: PlayerId): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error(`Room not found: ${roomId}`);
    if (room.players.includes(playerId)) throw new Error("Already in room");

    if (room.started && room.engine) {
      // Mid-game join: delegate to engine's addPlayer
      const result = room.engine.addPlayer(playerId);
      if (!result.ok) throw new Error(result.error ?? "Cannot join mid-game");
      room.players.push(playerId);
      return room;
    }

    // Pre-game join
    const game = AVAILABLE_GAMES.find((g) => g.id === room.gameId)!;
    if (room.players.length >= game.maxPlayers) throw new Error("Room is full");

    room.players.push(playerId);
    return room;
  }

  startGame(roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error(`Room not found: ${roomId}`);
    if (room.started) throw new Error("Game already started");

    const game = AVAILABLE_GAMES.find((g) => g.id === room.gameId)!;

    // Auto-fill empty slots with bots
    let botIdx = 0;
    while (room.players.length < game.minPlayers && botIdx < BOT_NAMES.length) {
      const botId = createBotId(BOT_NAMES[botIdx]);
      if (!room.players.includes(botId)) {
        room.players.push(botId);
      }
      botIdx++;
    }

    const config = createGameConfig(room.gameId, room.players);
    room.engine = new CroupierCore(config, room.players);
    room.started = true;

    // Start BotManager if there are bot players and a bot strategy
    const botIds = room.players.filter(isBotPlayer);
    if (botIds.length > 0 && config.bot) {
      room.botManager = new BotManager(room.engine, botIds, { delayMs: 1000 });

      // Listen for state changes from bot actions to broadcast updates
      room.engine.on("stateChange", () => {
        if (this.onBotAction) {
          this.onBotAction(roomId);
        }
      });

      room.botManager.start();
    }

    // Start TurnTimeoutManager if bot strategy exists and any phase has turnTimeoutMs
    if (config.bot) {
      const hasTimeout = Object.values(config.phases).some((p) => {
        if (p.turnTimeoutMs) return true;
        if (p.stages) {
          return Object.values(p.stages).some((s) => s.turnTimeoutMs);
        }
        return false;
      });

      if (hasTimeout) {
        room.turnTimeoutManager = new TurnTimeoutManager(
          room.engine,
          () => {
            if (this.onBotAction) {
              this.onBotAction(roomId);
            }
          },
        );
      }
    }

    return room;
  }

  dispatch(
    roomId: string,
    playerId: PlayerId,
    action: string,
    payload?: unknown,
  ) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error(`Room not found: ${roomId}`);
    if (!room.engine) throw new Error("Game not started");

    return room.engine.dispatch(playerId, action, payload);
  }

  getPlayerView(roomId: string, playerId: PlayerId): unknown {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error(`Room not found: ${roomId}`);
    if (!room.engine) throw new Error("Game not started");

    return room.engine.getPlayerView(playerId);
  }

  getEngineState(roomId: string): EngineState | null {
    const room = this.rooms.get(roomId);
    if (!room?.engine) return null;
    return room.engine.getEngineState();
  }

  getActionLog(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room?.engine) return [];
    return room.engine.getLog();
  }

  getPlayerLog(roomId: string, playerId: PlayerId) {
    const room = this.rooms.get(roomId);
    if (!room?.engine) return [];
    return room.engine.getPlayerLog(playerId);
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  listRooms(): Room[] {
    return [...this.rooms.values()];
  }

  getPhaseGraph(gameId: string): PhaseGraph {
    // Create a temporary config with dummy players to extract the topology
    const config = createGameConfig(gameId, ["__dummy1__", "__dummy2__"]);
    return extractPhaseGraph(config);
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room?.botManager) {
      room.botManager.stop();
    }
    if (room?.turnTimeoutManager) {
      room.turnTimeoutManager.dispose();
    }
    this.rooms.delete(roomId);
  }
}
