import type { WSContext } from "hono/ws";
import type { PlayerId } from "@croupier/core";
import type { GameManager } from "./game-manager.js";

interface ClientConnection {
  ws: WSContext;
  playerId: PlayerId;
  roomId: string;
}

export class RoomManager {
  private connections = new Map<WSContext, ClientConnection>();
  private roomConnections = new Map<string, Set<WSContext>>();

  constructor(private gameManager: GameManager) {}

  addConnection(ws: WSContext, playerId: PlayerId, roomId: string): void {
    this.connections.set(ws, { ws, playerId, roomId });
    if (!this.roomConnections.has(roomId)) {
      this.roomConnections.set(roomId, new Set());
    }
    this.roomConnections.get(roomId)!.add(ws);
  }

  removeConnection(ws: WSContext): void {
    const conn = this.connections.get(ws);
    if (conn) {
      this.roomConnections.get(conn.roomId)?.delete(ws);
      if (this.roomConnections.get(conn.roomId)?.size === 0) {
        this.roomConnections.delete(conn.roomId);
      }
      this.connections.delete(ws);
    }
  }

  getConnection(ws: WSContext): ClientConnection | undefined {
    return this.connections.get(ws);
  }

  /** Send player-specific game state to each player in a room */
  broadcastGameState(roomId: string): void {
    const clients = this.roomConnections.get(roomId);
    if (!clients) return;

    const room = this.gameManager.getRoom(roomId);
    if (!room?.engine) return;

    const engineState = this.gameManager.getEngineState(roomId);
    const actionLog = this.gameManager.getActionLog(roomId);
    const turnDeadline = room.turnTimeoutManager?.getDeadline() ?? null;

    for (const ws of clients) {
      const conn = this.connections.get(ws);
      if (!conn) continue;

      try {
        const playerView = this.gameManager.getPlayerView(
          roomId,
          conn.playerId,
        );
        ws.send(
          JSON.stringify({
            type: "gameState",
            data: {
              playerView,
              engineState,
              actionLog,
              playerId: conn.playerId,
              turnDeadline,
            },
          }),
        );
      } catch {
        // Connection may be closed
      }
    }

    // Auto-delete: clean up 30s after game finishes (clients see result screen first)
    if (engineState?.finished) {
      setTimeout(() => {
        this.closeRoom(roomId);
        this.gameManager.deleteRoom(roomId);
      }, 30_000);
    }
  }

  /** Broadcast a generic message to all clients in a room */
  broadcastToRoom(roomId: string, message: unknown): void {
    const clients = this.roomConnections.get(roomId);
    if (!clients) return;

    const msg = JSON.stringify(message);
    for (const ws of clients) {
      try {
        ws.send(msg);
      } catch {
        // Connection may be closed
      }
    }
  }

  /** Broadcast roomDeleted to all clients in a room and close their connections */
  closeRoom(roomId: string): void {
    const clients = this.roomConnections.get(roomId);
    if (!clients) return;

    const msg = JSON.stringify({ type: "roomDeleted" });
    for (const ws of clients) {
      try {
        ws.send(msg);
        ws.close();
      } catch {
        // Connection may already be closed
      }
      this.connections.delete(ws);
    }
    this.roomConnections.delete(roomId);
  }

  handleMessage(ws: WSContext, raw: string): void {
    const conn = this.connections.get(ws);
    if (!conn) return;

    let msg: { type: string; [key: string]: unknown };
    try {
      msg = JSON.parse(raw);
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
      return;
    }

    switch (msg.type) {
      case "action": {
        const { action, payload } = msg as {
          action: string;
          payload?: unknown;
        };
        try {
          const result = this.gameManager.dispatch(
            conn.roomId,
            conn.playerId,
            action,
            payload,
          );
          ws.send(JSON.stringify({ type: "actionResult", data: result }));

          if (result.ok) {
            this.broadcastGameState(conn.roomId);
          }
        } catch (e: any) {
          ws.send(
            JSON.stringify({ type: "error", error: e.message }),
          );
        }
        break;
      }

      case "getState": {
        try {
          const playerView = this.gameManager.getPlayerView(
            conn.roomId,
            conn.playerId,
          );
          const engineState = this.gameManager.getEngineState(conn.roomId);
          const actionLog = this.gameManager.getActionLog(conn.roomId);
          ws.send(
            JSON.stringify({
              type: "gameState",
              data: {
                playerView,
                engineState,
                actionLog,
                playerId: conn.playerId,
              },
            }),
          );
        } catch (e: any) {
          ws.send(
            JSON.stringify({ type: "error", error: e.message }),
          );
        }
        break;
      }

      default:
        ws.send(
          JSON.stringify({
            type: "error",
            error: `Unknown message type: ${msg.type}`,
          }),
        );
    }
  }
}
