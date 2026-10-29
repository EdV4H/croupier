import { useCallback, useEffect, useRef, useState } from "react";
import { getPlayerSecret } from "../lib/identity.js";

export interface ActionLogEntry {
  playerId: string;
  action: string;
  payload?: unknown;
  phase: string;
  stage?: string;
  timestamp: number;
}

export interface GameStateData {
  playerView: any;
  engineState: {
    phase: string;
    stage?: string;
    currentPlayers: string | string[];
    finished: boolean;
    result?: any;
  };
  actionLog: ActionLogEntry[];
  playerId: string;
  turnDeadline?: number | null;
  /** Increases with every state change; older states are dropped */
  revision: number;
}

export interface UseGameStateReturn {
  connected: boolean;
  gameState: GameStateData | null;
  roomDeleted: boolean;
  roomPlayers: string[] | null;
  dispatch: (action: string, payload?: unknown) => void;
  lastError: string | null;
  lastActionResult: { ok: boolean; error?: string } | null;
}

export function useGameState(
  roomId: string | null,
  playerId: string | null,
): UseGameStateReturn {
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<GameStateData | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<string[] | null>(null);
  const [roomDeleted, setRoomDeleted] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Reset game state when roomId changes (e.g., leaving a game)
  useEffect(() => {
    setGameState(null);
    setRoomPlayers(null);
    setRoomDeleted(false);
    setLastError(null);
    setLastActionResult(null);
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !playerId) return;

    let disposed = false;
    let gone = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let latestRevision = -1;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const secret = encodeURIComponent(getPlayerSecret());
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/ws/${roomId}/${encodeURIComponent(playerId)}?secret=${secret}`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };

      ws.onclose = async () => {
        if (wsRef.current === ws) wsRef.current = null;
        setConnected(false);
        if (disposed || gone) return;
        // Reconnect unless the room no longer exists
        const res = await fetch(`/api/rooms/${roomId}`).catch(() => null);
        if (disposed) return;
        if (res?.status === 404) {
          gone = true;
          setRoomDeleted(true);
          return;
        }
        const delay = Math.min(10_000, 500 * 2 ** attempt++);
        retryTimer = setTimeout(connect, delay);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "gameState":
              if (msg.data.revision < latestRevision) break;
              latestRevision = msg.data.revision;
              setGameState(msg.data);
              // Don't clear lastError on gameState — let it persist briefly
              break;
            case "actionResult":
              setLastActionResult(msg.data);
              if (!msg.data.ok) {
                setLastError(msg.data.error ?? "Action failed");
                setTimeout(() => setLastError(null), 3000);
              } else {
                setLastError(null);
              }
              break;
            case "error":
              setLastError(msg.error);
              setTimeout(() => setLastError(null), 3000);
              break;
            case "roomDeleted":
              gone = true;
              setRoomDeleted(true);
              break;
            case "room":
              setRoomPlayers(msg.data?.players ?? null);
              break;
          }
        } catch {
          // Ignore parse errors
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [roomId, playerId]);

  const dispatch = useCallback(
    (action: string, payload?: unknown) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "action", action, payload }),
        );
      }
    },
    [],
  );

  return { connected, gameState, roomDeleted, roomPlayers, dispatch, lastError, lastActionResult };
}
