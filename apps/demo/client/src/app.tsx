import { useCallback, useState } from "react";
import { GameBoard } from "./components/game-board.js";
import type { UIMode } from "./components/game-board.js";
import { GameSelector } from "./components/game-selector.js";
import { useGameState } from "./hooks/use-game-state.js";

type Screen =
  | { type: "login" }
  | { type: "lobby" }
  | { type: "waiting"; roomId: string; gameId: string }
  | { type: "playing"; roomId: string; gameId: string };

export function App() {
  const saved = localStorage.getItem("croupier-player-id");
  const [screen, setScreen] = useState<Screen>(saved ? { type: "lobby" } : { type: "login" });
  const [playerId, setPlayerId] = useState(saved ?? "");
  const [playerInput, setPlayerInput] = useState(saved ?? "");
  const [uiMode, setUiMode] = useState<UIMode>(
    () => (localStorage.getItem("croupier-ui-mode") as UIMode) || "rich",
  );
  const toggleUiMode = useCallback(() => {
    setUiMode((prev) => {
      const next = prev === "generic" ? "rich" : "generic";
      localStorage.setItem("croupier-ui-mode", next);
      return next;
    });
  }, []);

  const roomId = "roomId" in screen ? screen.roomId : null;
  const gameId = "gameId" in screen ? screen.gameId : null;
  const { connected, gameState, roomDeleted, dispatch, lastError } = useGameState(
    roomId,
    playerId || null,
  );

  const handleLogin = useCallback(() => {
    if (playerInput.trim()) {
      const name = playerInput.trim();
      setPlayerId(name);
      localStorage.setItem("croupier-player-id", name);
      setScreen({ type: "lobby" });
    }
  }, [playerInput]);

  const handleChangeName = useCallback((newName: string) => {
    setPlayerId(newName);
    localStorage.setItem("croupier-player-id", newName);
  }, []);

  const handleJoinRoom = useCallback(
    (roomId: string, gameId: string) => {
      setScreen({ type: "waiting", roomId, gameId });
    },
    [],
  );

  const handleStartGame = useCallback(async () => {
    if (!("roomId" in screen)) return;
    try {
      const res = await fetch(`/api/rooms/${screen.roomId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (data.started) {
        setScreen({
          type: "playing",
          roomId: screen.roomId,
          gameId: (screen as any).gameId,
        });
      }
    } catch (e: any) {
      console.error(e);
    }
  }, [screen, playerId]);

  // Navigate to lobby when room is deleted (unless viewing game results)
  if (
    roomDeleted &&
    screen.type !== "lobby" &&
    screen.type !== "login" &&
    screen.type !== "playing"
  ) {
    setScreen({ type: "lobby" });
  }

  // Auto-transition to playing when game state arrives
  if (
    screen.type === "waiting" &&
    gameState?.engineState &&
    !gameState.engineState.finished
  ) {
    setScreen({
      type: "playing",
      roomId: screen.roomId,
      gameId: screen.gameId,
    });
  }

  switch (screen.type) {
    case "login":
      return (
        <div style={styles.centered}>
          <div style={styles.loginCard}>
            <h1 style={styles.title}>Croupier</h1>
            <p style={styles.subtitle}>Enter your player name</p>
            <input
              style={styles.input}
              type="text"
              placeholder="Player name"
              value={playerInput}
              onChange={(e) => setPlayerInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleLogin()}
              autoFocus
            />
            <button style={styles.button} onClick={handleLogin}>
              Enter
            </button>
          </div>
        </div>
      );

    case "lobby":
      return (
        <div>
          <GameSelector playerId={playerId} onJoinRoom={handleJoinRoom} onChangeName={handleChangeName} />
        </div>
      );

    case "waiting":
      return (
        <WaitingRoom
          roomId={screen.roomId}
          gameId={screen.gameId}
          playerId={playerId}
          connected={connected}
          onStart={handleStartGame}
          onBack={() => setScreen({ type: "lobby" })}
        />
      );

    case "playing":
      if (!gameState) {
        return (
          <div style={styles.centered}>
            <p style={{ color: "#94a3b8" }}>
              {connected ? "Loading game state..." : "Connecting..."}
            </p>
          </div>
        );
      }
      return (
        <div style={styles.gameContainer}>
          <div style={styles.header}>
            <button
              style={styles.backBtn}
              onClick={() => setScreen({ type: "lobby" })}
            >
              &larr; Leave
            </button>
            <span style={styles.headerInfo}>
              Room: {screen.roomId} | Game: {screen.gameId} | Player: {playerId}
            </span>
            {["texas-holdem", "planning-poker", "values-card", "digital-tcg"].includes(screen.gameId) && (
              <button
                style={{
                  ...styles.backBtn,
                  marginLeft: "auto",
                  background: uiMode === "rich" ? "#6366f1" : "none",
                  color: uiMode === "rich" ? "#fff" : "#94a3b8",
                  borderColor: uiMode === "rich" ? "#6366f1" : "#334155",
                }}
                onClick={toggleUiMode}
              >
                {uiMode === "rich" ? "Rich UI" : "Generic UI"}
              </button>
            )}
          </div>
          <GameBoard
            gameId={screen.gameId}
            gameState={gameState}
            dispatch={dispatch}
            lastError={lastError}
            uiMode={uiMode}
            onLeave={() => setScreen({ type: "lobby" })}
          />
        </div>
      );
  }
}

function WaitingRoom({
  roomId,
  gameId,
  playerId,
  connected,
  onStart,
  onBack,
}: {
  roomId: string;
  gameId: string;
  playerId: string;
  connected: boolean;
  onStart: () => void;
  onBack: () => void;
}) {
  const [roomData, setRoomData] = useState<any>(null);

  // Fetch room data
  useState(() => {
    fetch(`/api/rooms/${roomId}`)
      .then((r) => r.json())
      .then(setRoomData);
  });

  const copyRoomId = () => navigator.clipboard.writeText(roomId);

  return (
    <div style={styles.centered}>
      <div style={styles.waitingCard}>
        <h2 style={{ color: "#f1f5f9", marginBottom: "0.5rem" }}>
          Waiting Room
        </h2>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Share this Room ID with your friends:
        </p>
        <div
          style={styles.roomIdBadge}
          onClick={copyRoomId}
          title="Click to copy"
        >
          {roomId}
        </div>
        <p style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.3rem" }}>
          Click to copy
        </p>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "1rem" }}>
          Game: {gameId} | {connected ? "Connected" : "Connecting..."}
        </p>
        {roomData && (
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            Players:{" "}
            {roomData.players?.map((p: string, i: number) => (
              <span key={p}>
                {i > 0 && ", "}
                {p.startsWith("bot:") ? (
                  <span style={{ color: "#f59e0b", fontStyle: "italic" }}>
                    {p.slice(4)} (Bot)
                  </span>
                ) : (
                  p
                )}
              </span>
            )) ?? "Loading..."}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          {roomData?.creatorId === playerId && (
            <button style={styles.button} onClick={onStart}>
              Start Game
            </button>
          )}
          <button style={{ ...styles.button, background: "#475569" }} onClick={onBack}>
            Back
          </button>
        </div>
        {roomData && roomData.creatorId !== playerId && (
          <p style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.5rem" }}>
            Waiting for the host to start...
          </p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  centered: {
    display: "flex", alignItems: "center", justifyContent: "center",
    minHeight: "100vh",
  },
  loginCard: {
    background: "#1e293b", borderRadius: 16, padding: "2.5rem",
    border: "1px solid #334155", display: "flex", flexDirection: "column",
    gap: "1rem", minWidth: 320, textAlign: "center",
  },
  waitingCard: {
    background: "#1e293b", borderRadius: 16, padding: "2rem",
    border: "1px solid #334155", minWidth: 360, textAlign: "center",
  },
  roomIdBadge: {
    fontSize: "2.5rem", fontWeight: 800, color: "#3b82f6",
    letterSpacing: "0.3em", fontFamily: "monospace",
    background: "#0f172a", borderRadius: 12, padding: "0.8rem 1.5rem",
    border: "2px dashed #334155", cursor: "pointer",
    userSelect: "all" as const, display: "inline-block",
  },
  title: { fontSize: "2rem", fontWeight: 700, color: "#f1f5f9" },
  subtitle: { color: "#94a3b8", fontSize: "0.9rem" },
  input: {
    background: "#0f172a", color: "#f1f5f9", border: "1px solid #334155",
    borderRadius: 8, padding: "0.7rem 1rem", fontSize: "1rem", outline: "none",
  },
  button: {
    background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8,
    padding: "0.7rem 1.2rem", cursor: "pointer", fontSize: "0.95rem",
    fontWeight: 600,
  },
  gameContainer: {
    display: "flex", flexDirection: "column",
    height: "100vh", overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", gap: "1rem",
    padding: "0.8rem 1rem", borderBottom: "1px solid #1e293b",
    flexShrink: 0,
  },
  backBtn: {
    background: "none", border: "1px solid #334155", borderRadius: 6,
    color: "#94a3b8", padding: "0.4rem 0.8rem", cursor: "pointer",
    fontSize: "0.85rem",
  },
  headerInfo: { fontSize: "0.8rem", color: "#64748b" },
};
