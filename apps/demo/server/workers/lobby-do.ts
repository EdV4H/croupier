import { DurableObject } from "cloudflare:workers";
import type { RoomSummary } from "../shared/types.js";

export class LobbyDO extends DurableObject {
  private generateRoomId(existingIds: Set<string>): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 100; attempt++) {
      let id = "";
      for (let i = 0; i < 4; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }
      if (!existingIds.has(id)) return id;
    }
    throw new Error("Failed to generate unique room ID");
  }

  async createId(gameId: string): Promise<string> {
    const entries = await this.ctx.storage.list<RoomSummary>({ prefix: "room:" });
    const existingIds = new Set([...entries.values()].map((r) => r.id));

    const roomId = this.generateRoomId(existingIds);
    const summary: RoomSummary = {
      id: roomId,
      gameId,
      players: [],
      started: false,
      createdAt: Date.now(),
      creatorId: "",
    };
    await this.ctx.storage.put(`room:${roomId}`, summary);
    return roomId;
  }

  async updateRoom(summary: RoomSummary): Promise<void> {
    await this.ctx.storage.put(`room:${summary.id}`, summary);
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.ctx.storage.delete(`room:${roomId}`);
  }

  async listRooms(): Promise<RoomSummary[]> {
    const entries = await this.ctx.storage.list<RoomSummary>({
      prefix: "room:",
    });
    return [...entries.values()];
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "POST" && path === "/create-id") {
      const { gameId } = (await request.json()) as { gameId: string };
      const roomId = await this.createId(gameId);
      return Response.json({ roomId });
    }

    if (request.method === "POST" && path === "/update") {
      const summary = (await request.json()) as RoomSummary;
      await this.updateRoom(summary);
      return new Response(null, { status: 204 });
    }

    if (request.method === "GET" && path === "/list") {
      const rooms = await this.listRooms();
      return Response.json(rooms);
    }

    if (request.method === "DELETE" && path.startsWith("/rooms/")) {
      const roomId = path.slice("/rooms/".length);
      await this.deleteRoom(roomId);
      return new Response(null, { status: 204 });
    }

    return new Response("Not Found", { status: 404 });
  }
}
