import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { extractPhaseGraph } from "@edv4h/croupier-core";
import type { RoomSummary } from "../protocol.js";
import type { GameRegistry, HttpResult } from "../room/types.js";

/** What the HTTP layer needs from a runtime. Node calls a RoomHost directly; Workers call Durable Objects. */
export interface RoomGateway {
  createRoom(body: unknown): Promise<HttpResult>;
  joinRoom(roomId: string, body: unknown): Promise<HttpResult>;
  leaveRoom(roomId: string, body: unknown): Promise<HttpResult>;
  startGame(roomId: string, body: unknown): Promise<HttpResult>;
  deleteRoom(roomId: string, body: unknown): Promise<HttpResult>;
  getRoom(roomId: string): Promise<HttpResult>;
  listRooms(): Promise<RoomSummary[]>;
  /** Open a WebSocket for a room member; must answer 403/404 without upgrading otherwise */
  connect(c: Context, roomId: string, playerId: string, secret: string): Promise<Response>;
}

function reply(c: Context, result: HttpResult): Response {
  if (result.status === 204) return c.body(null, 204);
  return c.json(result.body as object, result.status as ContentfulStatusCode);
}

async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

/** Add the REST and WebSocket routes to `app` */
export function mountRoutes(app: Hono<any>, gateway: RoomGateway, registry: GameRegistry): Hono<any> {
  app.use("/api/*", cors());

  app.get("/api/games", (c) => c.json(registry.games));

  app.get("/api/games/:gameId/phase-graph", (c) => {
    const gameId = c.req.param("gameId");
    if (!registry.games.some((g) => g.id === gameId)) return c.json({ error: `Unknown game: ${gameId}` }, 404);
    try {
      return c.json(extractPhaseGraph(registry.createConfig(gameId, ["__dummy1__", "__dummy2__"])));
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  app.get("/api/rooms", async (c) => c.json(await gateway.listRooms()));
  app.post("/api/rooms", async (c) => reply(c, await gateway.createRoom(await jsonBody(c))));
  app.get("/api/rooms/:roomId", async (c) => reply(c, await gateway.getRoom(c.req.param("roomId"))));
  app.post("/api/rooms/:roomId/join", async (c) => reply(c, await gateway.joinRoom(c.req.param("roomId"), await jsonBody(c))));
  app.post("/api/rooms/:roomId/leave", async (c) => reply(c, await gateway.leaveRoom(c.req.param("roomId"), await jsonBody(c))));
  app.post("/api/rooms/:roomId/start", async (c) => reply(c, await gateway.startGame(c.req.param("roomId"), await jsonBody(c))));
  app.delete("/api/rooms/:roomId", async (c) => reply(c, await gateway.deleteRoom(c.req.param("roomId"), await jsonBody(c))));

  app.get("/ws/:roomId/:playerId", (c) => {
    if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") return c.json({ error: "Expected a WebSocket upgrade" }, 426);
    return gateway.connect(c, c.req.param("roomId"), c.req.param("playerId"), c.req.query("secret") ?? "");
  });

  return app;
}

export function createApp(gateway: RoomGateway, registry: GameRegistry): Hono {
  return mountRoutes(new Hono(), gateway, registry);
}
