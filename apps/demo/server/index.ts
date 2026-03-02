import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { AVAILABLE_GAMES, GameManager } from "./game-manager.js";
import { RoomManager } from "./rooms.js";

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

/** List rooms */
app.get("/api/rooms", (c) => {
  const rooms = gameManager.listRooms().map((r) => ({
    id: r.id,
    gameId: r.gameId,
    players: r.players,
    started: r.started,
    createdAt: r.createdAt,
  }));
  return c.json(rooms);
});

/** Create a room */
app.post("/api/rooms", async (c) => {
  const body = await c.req.json<{ gameId: string; playerId: string }>();
  try {
    const room = gameManager.createRoom(body.gameId, body.playerId);
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
    roomManager.broadcastToRoom(roomId, {
      type: "playerJoined",
      data: { playerId: body.playerId, players: room.players },
    });
    return c.json({ players: room.players });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

/** Start a game */
app.post("/api/rooms/:roomId/start", async (c) => {
  const roomId = c.req.param("roomId");
  try {
    gameManager.startGame(roomId);
    roomManager.broadcastGameState(roomId);
    return c.json({ started: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
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
        roomManager.addConnection(ws, playerId, roomId);
        // Send initial state if game is started
        const room = gameManager.getRoom(roomId);
        if (room?.started) {
          try {
            const playerView = gameManager.getPlayerView(roomId, playerId);
            const engineState = gameManager.getEngineState(roomId);
            ws.send(
              JSON.stringify({
                type: "gameState",
                data: { playerView, engineState, playerId },
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
