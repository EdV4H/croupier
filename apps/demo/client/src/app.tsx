import { useCallback, useState } from "react";
import { GameBoard } from "./components/game-board.js";
import { GameSelector } from "./components/game-selector.js";
import { useGameState } from "./hooks/use-game-state.js";

type Screen =
  | { type: "login" }
  | { type: "lobby" }
  | { type: "waiting"; roomId: string; gameId: string }
  | { type: "playing"; roomId: string; gameId: string };

export function App() {
  const [screen, setScreen] = useState<Screen>({ type: "login" });
  const [playerId, setPlayerId] = useState("");
  const [playerInput, setPlayerInput] = useState("");

  const roomId = "roomId" in screen ? screen.roomId : null;
  const gameId = "gameId" in screen ? screen.gameId : null;
  const { connected, gameState, dispatch, lastError } = useGameState(
    roomId,
    playerId || null,
  );

  const handleLogin = useCallback(() => {
    if (playerInput.trim()) {
      setPlayerId(playerInput.trim());
      setScreen({ type: "lobby" });
    }
  }, [playerInput]);

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
  }, [screen]);

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
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
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
          <GameSelector playerId={playerId} onJoinRoom={handleJoinRoom} />
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
          </div>
          <GameBoard
            gameId={screen.gameId}
            gameState={gameState}
            dispatch={dispatch}
            lastError={lastError}
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

  return (
    <div style={styles.centered}>
      <div style={styles.waitingCard}>
        <h2 style={{ color: "#f1f5f9", marginBottom: "0.5rem" }}>
          Waiting Room
        </h2>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
          Game: {gameId} | Room: {roomId}
        </p>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
          Status: {connected ? "Connected" : "Connecting..."}
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
          <button style={styles.button} onClick={onStart}>
            Start Game
          </button>
          <button style={{ ...styles.button, background: "#475569" }} onClick={onBack}>
            Back
          </button>
        </div>
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
  gameContainer: { maxWidth: 960, margin: "0 auto" },
  header: {
    display: "flex", alignItems: "center", gap: "1rem",
    padding: "0.8rem 1rem", borderBottom: "1px solid #1e293b",
  },
  backBtn: {
    background: "none", border: "1px solid #334155", borderRadius: 6,
    color: "#94a3b8", padding: "0.4rem 0.8rem", cursor: "pointer",
    fontSize: "0.85rem",
  },
  headerInfo: { fontSize: "0.8rem", color: "#64748b" },
};
