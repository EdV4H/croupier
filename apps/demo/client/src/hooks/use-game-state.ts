import { useCallback, useEffect, useRef, useState } from "react";

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
}

export interface UseGameStateReturn {
  connected: boolean;
  gameState: GameStateData | null;
  roomDeleted: boolean;
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
    setRoomDeleted(false);
    setLastError(null);
    setLastActionResult(null);
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !playerId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/${roomId}/${playerId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "gameState":
            setGameState(msg.data);
            setLastError(null);
            break;
          case "actionResult":
            setLastActionResult(msg.data);
            if (!msg.data.ok) {
              setLastError(msg.data.error ?? "Action failed");
            }
            break;
          case "error":
            setLastError(msg.error);
            break;
          case "roomDeleted":
            setRoomDeleted(true);
            break;
          case "playerJoined":
            // Could handle player join notifications
            break;
          case "connected":
            // Initial connection ack
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    return () => {
      ws.close();
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

  return { connected, gameState, roomDeleted, dispatch, lastError, lastActionResult };
}
