import { Hono } from "hono";
import { cors } from "hono/cors";
import { AVAILABLE_GAMES, createGameConfig } from "../shared/game-registry.js";
import { extractPhaseGraph } from "@croupier/core";

export { LobbyDO } from "./lobby-do.js";
export { GameRoomDO } from "./game-room-do.js";

interface Env {
  LOBBY: DurableObjectNamespace;
  GAME_ROOM: DurableObjectNamespace;
}

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

// ============================================================
// Helpers
// ============================================================

function getLobby(env: Env) {
  return env.LOBBY.get(env.LOBBY.idFromName("singleton"));
}

function getGameRoom(env: Env, roomId: string) {
  return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomId));
}

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
    const config = createGameConfig(gameId, ["__dummy1__", "__dummy2__"]);
    const graph = extractPhaseGraph(config);
    return c.json(graph);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

/** List rooms */
app.get("/api/rooms", async (c) => {
  const lobby = getLobby(c.env);
  const res = await lobby.fetch(new Request("http://lobby/list"));
  const rooms = await res.json();
  return c.json(rooms);
});

/** Create a room */
app.post("/api/rooms", async (c) => {
  const body = await c.req.json<{
    gameId: string;
    playerId: string;
    botCount?: number;
  }>();

  // Allocate room ID via Lobby
  const lobby = getLobby(c.env);
  const idRes = await lobby.fetch(
    new Request("http://lobby/create-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: body.gameId }),
    }),
  );
  const { roomId } = (await idRes.json()) as { roomId: string };

  // Initialize GameRoom DO
  const room = getGameRoom(c.env, roomId);
  const createRes = await room.fetch(
    new Request("http://game-room/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        gameId: body.gameId,
        playerId: body.playerId,
        botCount: body.botCount,
      }),
    }),
  );
  const data = await createRes.json();
  return c.json(data, 201);
});

/** Join a room */
app.post("/api/rooms/:roomId/join", async (c) => {
  const roomId = c.req.param("roomId");
  const body = await c.req.json<{ playerId: string }>();
  const room = getGameRoom(c.env, roomId);
  const res = await room.fetch(
    new Request("http://game-room/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const data = await res.json();
  if (!res.ok) return c.json(data, res.status as any);
  return c.json(data);
});

/** Start a game */
app.post("/api/rooms/:roomId/start", async (c) => {
  const roomId = c.req.param("roomId");
  const room = getGameRoom(c.env, roomId);
  const res = await room.fetch(
    new Request("http://game-room/start", { method: "POST" }),
  );
  const data = await res.json();
  if (!res.ok) return c.json(data, res.status as any);
  return c.json(data);
});

/** Delete a room (creator only) */
app.delete("/api/rooms/:roomId", async (c) => {
  const roomId = c.req.param("roomId");
  const playerId = c.req.query("playerId");
  if (!playerId) return c.json({ error: "playerId required" }, 400);

  // Ask GameRoomDO to verify creator & close WebSockets
  const room = getGameRoom(c.env, roomId);
  const deleteRes = await room.fetch(
    new Request("http://game-room/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    }),
  );
  if (!deleteRes.ok) {
    const data = await deleteRes.json();
    return c.json(data, deleteRes.status as any);
  }

  // Remove from Lobby
  const lobby = getLobby(c.env);
  await lobby.fetch(
    new Request(`http://lobby/rooms/${roomId}`, { method: "DELETE" }),
  );
  return c.body(null, 204);
});

/** Get room info */
app.get("/api/rooms/:roomId", async (c) => {
  const roomId = c.req.param("roomId");
  const room = getGameRoom(c.env, roomId);
  const res = await room.fetch(new Request("http://game-room/info"));
  const data = await res.json();
  return c.json(data);
});

// ============================================================
// WebSocket — forward upgrade to GameRoom DO
// ============================================================

app.get("/ws/:roomId/:playerId", async (c) => {
  const roomId = c.req.param("roomId");
  const playerId = c.req.param("playerId");
  const room = getGameRoom(c.env, roomId);

  // Forward the raw request to the DO so it can handle the WS upgrade
  return room.fetch(
    new Request(`http://game-room/ws/${playerId}`, {
      headers: c.req.raw.headers,
    }),
  );
});

export default app;
