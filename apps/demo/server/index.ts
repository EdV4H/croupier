import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { isBotPlayer } from "@croupier/core";
import { AVAILABLE_GAMES, GameManager } from "./game-manager.js";
import { RoomManager } from "./rooms.js";
import { createLogger } from "./shared/logger.js";

const log = createLogger("local");

const app = new Hono();
const gameManager = new GameManager();
const roomManager = new RoomManager(gameManager);

// Wire up bot action broadcasts — when a bot acts, push state to all clients
gameManager.onBotAction = (roomId: string) => {
  roomManager.broadcastGameState(roomId);
};

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Middleware
app.use("/api/*", cors());

// ============================================================
// REST API
// ============================================================

/** List available games */
app.get("/api/games", (c) => {
  return c.json(AVAILABLE_GAMES);
});

/** Get phase graph for a game type */
app.get("/api/games/:gameId/phase-graph", (c) => {
  const gameId = c.req.param("gameId");
  try {
    const graph = gameManager.getPhaseGraph(gameId);
    return c.json(graph);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

/** List rooms */
app.get("/api/rooms", (c) => {
  const rooms = gameManager.listRooms().map((r) => ({
    id: r.id,
    gameId: r.gameId,
    players: r.players,
    started: r.started,
    createdAt: r.createdAt,
    creatorId: r.creatorId,
  }));
  return c.json(rooms);
});

/** Create a room */
app.post("/api/rooms", async (c) => {
  const body = await c.req.json<{ gameId: string; playerId: string; botCount?: number; gameOptions?: Record<string, unknown> }>();
  try {
    const room = gameManager.createRoom(body.gameId, body.playerId, body.botCount, body.gameOptions);
    log.info("room.create", { roomId: room.id, gameId: body.gameId, creatorId: body.playerId, botCount: body.botCount, gameOptions: !!body.gameOptions });
    return c.json(
      { id: room.id, gameId: room.gameId, players: room.players },
      201,
    );
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

/** Join a room */
app.post("/api/rooms/:roomId/join", async (c) => {
  const roomId = c.req.param("roomId");
  const body = await c.req.json<{ playerId: string }>();
  try {
    const room = gameManager.joinRoom(roomId, body.playerId);
    log.info("room.join", { roomId, playerId: body.playerId });
    roomManager.broadcastToRoom(roomId, {
      type: "playerJoined",
      data: { playerId: body.playerId, players: room.players },
    });
    // If game is already started (mid-game join), broadcast updated game state
    if (room.started) {
      roomManager.broadcastGameState(roomId);
    }
    return c.json({ gameId: room.gameId, players: room.players });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

/** Start a game (creator only) */
app.post("/api/rooms/:roomId/start", async (c) => {
  const roomId = c.req.param("roomId");
  const body = await c.req.json<{ playerId?: string }>().catch(() => ({}));
  const room = gameManager.getRoom(roomId);
  if (!room) return c.json({ error: "Room not found" }, 404);
  if (body.playerId !== room.creatorId) {
    return c.json({ error: "Only the room creator can start the game" }, 403);
  }
  try {
    gameManager.startGame(roomId);
    const startedRoom = gameManager.getRoom(roomId)!;
    const botIds = startedRoom.players.filter(isBotPlayer);
    log.info("game.start", { roomId, gameId: startedRoom.gameId, players: startedRoom.players, botIds });
    roomManager.broadcastGameState(roomId);
    return c.json({ started: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

/** Delete a room (creator only) */
app.delete("/api/rooms/:roomId", (c) => {
  const roomId = c.req.param("roomId");
  const playerId = c.req.query("playerId");
  const room = gameManager.getRoom(roomId);
  if (!room) return c.json({ error: "Room not found" }, 404);
  if (playerId !== room.creatorId) {
    return c.json({ error: "Only the room creator can delete it" }, 403);
  }
  log.info("room.delete", { roomId });
  roomManager.closeRoom(roomId);
  gameManager.deleteRoom(roomId);
  return c.body(null, 204);
});

/** Get room info */
app.get("/api/rooms/:roomId", (c) => {
  const roomId = c.req.param("roomId");
  const room = gameManager.getRoom(roomId);
  if (!room) return c.json({ error: "Room not found" }, 404);
  return c.json({
    id: room.id,
    gameId: room.gameId,
    players: room.players,
    started: room.started,
    creatorId: room.creatorId,
  });
});

// ============================================================
// WebSocket
// ============================================================

app.get(
  "/ws/:roomId/:playerId",
  upgradeWebSocket((c) => {
    const roomId = c.req.param("roomId");
    const playerId = c.req.param("playerId");

    return {
      onOpen(evt, ws) {
        log.info("ws.connect", { roomId, playerId });
        roomManager.addConnection(ws, playerId, roomId);
        // Send initial state if game is started
        const room = gameManager.getRoom(roomId);
        if (room?.started) {
          try {
            const playerView = gameManager.getPlayerView(roomId, playerId);
            const engineState = gameManager.getEngineState(roomId);
            const actionLog = gameManager.getPlayerLog(roomId, playerId);
            const turnDeadline = room.turnTimeoutManager?.getDeadline() ?? null;
            ws.send(
              JSON.stringify({
                type: "gameState",
                data: { playerView, engineState, actionLog, playerId, turnDeadline },
              }),
            );
          } catch {
            // Game not yet started
          }
        }
        ws.send(
          JSON.stringify({
            type: "connected",
            data: { roomId, playerId },
          }),
        );
      },
      onMessage(evt, ws) {
        const data = typeof evt.data === "string" ? evt.data : "";
        roomManager.handleMessage(ws, data);
      },
      onClose(evt, ws) {
        log.info("ws.disconnect", { roomId, playerId });
        roomManager.removeConnection(ws);
      },
    };
  }),
);

// ============================================================
// Start Server
// ============================================================

const port = Number(process.env.PORT) || 9615;
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Croupier demo server running on http://localhost:${info.port}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Try: kill $(lsof -ti:${port})`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

injectWebSocket(server);
