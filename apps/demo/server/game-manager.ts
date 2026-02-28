import {
  BotManager,
  CroupierCore,
  type CroupierConfig,
  type EngineState,
  type PlayerId,
  BOT_NAMES,
  createBotId,
  isBotPlayer,
} from "@croupier/core";
import { createTexasHoldemConfig } from "@croupier/plugin-texas-holdem";
import { createPlanningPokerConfig } from "@croupier/plugin-planning-poker";
import { createValuesCardConfig } from "@croupier/plugin-values-card";
import { createDigitalTCGConfig } from "@croupier/plugin-digital-tcg";

export interface GameInfo {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

export const AVAILABLE_GAMES: GameInfo[] = [
  {
    id: "texas-holdem",
    name: "Texas Hold'em",
    description: "Classic poker game with community cards",
    minPlayers: 2,
    maxPlayers: 8,
  },
  {
    id: "planning-poker",
    name: "Planning Poker",
    description: "Agile estimation tool for teams",
    minPlayers: 2,
    maxPlayers: 10,
  },
  {
    id: "values-card",
    name: "Values Card",
    description: "Discover and share your values with your team",
    minPlayers: 2,
    maxPlayers: 6,
  },
  {
    id: "digital-tcg",
    name: "Digital TCG",
    description: "Turn-based trading card game",
    minPlayers: 2,
    maxPlayers: 2,
  },
];

function createGameConfig(
  gameId: string,
  players: PlayerId[],
): CroupierConfig<any> {
  switch (gameId) {
    case "texas-holdem":
      return createTexasHoldemConfig();
    case "planning-poker":
      return createPlanningPokerConfig({
        facilitators: [players[0]],
      });
    case "values-card":
      return createValuesCardConfig();
    case "digital-tcg":
      return createDigitalTCGConfig();
    default:
      throw new Error(`Unknown game: ${gameId}`);
  }
}

export interface Room {
  id: string;
  gameId: string;
  players: PlayerId[];
  engine: CroupierCore | null;
  botManager: BotManager | null;
  started: boolean;
  createdAt: number;
}

export class GameManager {
  private rooms = new Map<string, Room>();
  private roomCounter = 0;
  /** Callback invoked when a bot acts, so the server can broadcast state updates */
  onBotAction: ((roomId: string) => void) | null = null;

  createRoom(gameId: string, creatorId: PlayerId): Room {
    const game = AVAILABLE_GAMES.find((g) => g.id === gameId);
    if (!game) throw new Error(`Unknown game: ${gameId}`);

    const id = `room_${++this.roomCounter}`;
    const room: Room = {
      id,
      gameId,
      players: [creatorId],
      engine: null,
      botManager: null,
      started: false,
      createdAt: Date.now(),
    };
    this.rooms.set(id, room);
    return room;
  }

  joinRoom(roomId: string, playerId: PlayerId): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error(`Room not found: ${roomId}`);
    if (room.started) throw new Error("Game already started");

    const game = AVAILABLE_GAMES.find((g) => g.id === room.gameId)!;
    if (room.players.length >= game.maxPlayers) throw new Error("Room is full");
    if (room.players.includes(playerId)) throw new Error("Already in room");

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

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  listRooms(): Room[] {
    return [...this.rooms.values()];
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room?.botManager) {
      room.botManager.stop();
    }
    this.rooms.delete(roomId);
  }
}
