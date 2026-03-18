import { useCallback, useEffect, useState } from "react";
import { DeckCustomizer } from "./deck-customizer.js";

interface GameInfo {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

interface RoomInfo {
  id: string;
  gameId: string;
  players: string[];
  started: boolean;
  creatorId: string;
}

interface GameSelectorProps {
  playerId: string;
  onJoinRoom: (roomId: string, gameId: string) => void;
  onChangeName: (name: string) => void;
}

export function GameSelector({ playerId, onJoinRoom, onChangeName }: GameSelectorProps) {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [botCounts, setBotCounts] = useState<Record<string, number>>({});
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);
  const [joinRoomInput, setJoinRoomInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(playerId);
  const [gameOptions, setGameOptions] = useState<Partial<Record<string, Record<string, unknown>>>>({});
  const [customizingGameId, setCustomizingGameId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [gamesRes, roomsRes] = await Promise.all([
        fetch("/api/games"),
        fetch("/api/rooms"),
      ]);
      if (!gamesRes.ok) throw new Error(`Games API error: ${gamesRes.status}`);
      if (!roomsRes.ok) throw new Error(`Rooms API error: ${roomsRes.status}`);
      setGames(await gamesRes.json());
      setRooms(await roomsRes.json());
    } catch (err) {
      console.error("Failed to fetch game data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const CUSTOMIZABLE_GAMES = ["values-card", "trust-bank", "digital-tcg", "daifugo"];

  const createRoom = async (gameId: string) => {
    const botCount = botCounts[gameId] ?? 0;
    const opts = gameOptions[gameId];
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, playerId, botCount, ...(opts ? { gameOptions: opts } : {}) }),
    });
    const data = await res.json();
    if (data.id) {
      setCreatedRoomId(data.id);
      setCreatedGameId(gameId);
    }
  };

  const handleJoinByRoomId = async () => {
    const roomId = joinRoomInput.trim().toUpperCase();
    if (!roomId) {
      setJoinError("Please enter a Room ID");
      return;
    }
    setJoinError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error ?? "Failed to join room");
        return;
      }
      onJoinRoom(roomId, data.gameId);
    } catch {
      setJoinError("Failed to join room");
    }
  };

  const goToCreatedRoom = () => {
    if (createdRoomId && createdGameId) {
      onJoinRoom(createdRoomId, createdGameId);
    }
  };

  const deleteRoom = async (roomId: string) => {
    await fetch(`/api/rooms/${roomId}?playerId=${encodeURIComponent(playerId)}`, {
      method: "DELETE",
    });
    fetchData();
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Croupier</h1>
      <p style={styles.subtitle}>Universal Game Engine Demo</p>
      <div style={styles.playerInfo}>
        {editing ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            Playing as:{" "}
            <input
              style={styles.nameInput}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  const trimmed = nameInput.trim();
                  if (trimmed && !trimmed.startsWith("bot:")) {
                    onChangeName(trimmed);
                    setEditing(false);
                  }
                }
                if (e.key === "Escape") {
                  setNameInput(playerId);
                  setEditing(false);
                }
              }}
              autoFocus
            />
            <button
              style={styles.nameBtn}
              onClick={() => {
                const trimmed = nameInput.trim();
                if (trimmed && !trimmed.startsWith("bot:")) {
                  onChangeName(trimmed);
                  setEditing(false);
                }
              }}
            >
              Save
            </button>
            <button
              style={{ ...styles.nameBtn, background: "#475569" }}
              onClick={() => { setNameInput(playerId); setEditing(false); }}
            >
              Cancel
            </button>
          </span>
        ) : (
          <span>
            Playing as: <strong>{playerId}</strong>{" "}
            <button style={styles.nameBtn} onClick={() => { setNameInput(playerId); setEditing(true); }}>
              Edit
            </button>
          </span>
        )}
      </div>

      {/* Created Room ID modal */}
      {createdRoomId && (
        <div style={styles.overlay} onClick={() => setCreatedRoomId(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#f1f5f9", marginBottom: "0.5rem" }}>Room Created!</h2>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "1rem" }}>
              Share this Room ID with your friends:
            </p>
            <div style={styles.roomIdDisplay}>{createdRoomId}</div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
              <button
                style={styles.button}
                onClick={goToCreatedRoom}
              >
                Go to Waiting Room
              </button>
              <button
                style={{ ...styles.button, background: "#475569" }}
                onClick={() => navigator.clipboard.writeText(createdRoomId)}
              >
                Copy ID
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Room section */}
      <h2 style={styles.sectionTitle}>Join Room</h2>
      <div style={styles.joinCard}>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: 0 }}>
          Enter the 4-character Room ID to join:
        </p>
        <div style={styles.joinRow}>
          <input
            style={styles.roomIdInput}
            type="text"
            placeholder="e.g. A3F7"
            maxLength={4}
            value={joinRoomInput}
            onChange={(e) => {
              setJoinRoomInput(e.target.value.toUpperCase());
              setJoinError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleJoinByRoomId()}
          />
          <button style={styles.button} onClick={handleJoinByRoomId}>
            Join
          </button>
        </div>
        {joinError && <p style={styles.errorText}>{joinError}</p>}
      </div>

      {/* Available Games */}
      <h2 style={styles.sectionTitle}>Create Room</h2>
      <div style={styles.gameGrid}>
        {games.map((game) => (
          <div key={game.id} style={styles.gameCard}>
            <h3 style={styles.gameName}>{game.name}</h3>
            <p style={styles.gameDesc}>{game.description}</p>
            <p style={styles.gamePlayers}>
              {game.minPlayers}–{game.maxPlayers} players
            </p>
            <div style={styles.botStepper}>
              <span style={styles.botLabel}>Bots:</span>
              <button
                style={styles.stepperBtn}
                onClick={() =>
                  setBotCounts((prev) => ({
                    ...prev,
                    [game.id]: Math.max(0, (prev[game.id] ?? 0) - 1),
                  }))
                }
                disabled={(botCounts[game.id] ?? 0) <= 0}
              >
                -
              </button>
              <span style={styles.stepperValue}>{botCounts[game.id] ?? 0}</span>
              <button
                style={styles.stepperBtn}
                onClick={() =>
                  setBotCounts((prev) => ({
                    ...prev,
                    [game.id]: Math.min(game.maxPlayers - 1, (prev[game.id] ?? 0) + 1),
                  }))
                }
                disabled={(botCounts[game.id] ?? 0) >= game.maxPlayers - 1}
              >
                +
              </button>
            </div>
            {CUSTOMIZABLE_GAMES.includes(game.id) && (
              <button
                style={styles.customizeBtn}
                onClick={() => setCustomizingGameId(game.id)}
              >
                {gameOptions[game.id]
                  ? (game.id === "daifugo" ? "Rules Customized" : "Deck Customized")
                  : (game.id === "daifugo" ? "Customize Rules" : "Customize Deck")}
              </button>
            )}
            <button
              style={styles.button}
              onClick={() => createRoom(game.id)}
            >
              Create Room
            </button>
          </div>
        ))}
      </div>

      {/* Deck Customizer Modal */}
      {customizingGameId && (
        <DeckCustomizer
          gameId={customizingGameId}
          onSave={(opts) => {
            const gid = customizingGameId;
            if (gid) setGameOptions((prev) => ({ ...prev, [gid]: opts }));
            setCustomizingGameId(null);
          }}
          onClose={() => setCustomizingGameId(null)}
        />
      )}

      {rooms.filter((r) => r.started && r.players.includes(playerId)).length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>Active Games</h2>
          <div style={styles.roomList}>
            {rooms
              .filter((r) => r.started && r.players.includes(playerId))
              .map((room) => (
                <div key={room.id} style={styles.roomCard}>
                  <span style={styles.roomInfo}>
                    {games.find((g) => g.id === room.gameId)?.name ?? room.gameId}
                    {" — "}
                    {room.players.length} player(s)
                  </span>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      style={styles.rejoinButton}
                      onClick={() => onJoinRoom(room.id, room.gameId)}
                    >
                      Rejoin
                    </button>
                    {room.creatorId === playerId && (
                      <button
                        style={styles.deleteButton}
                        onClick={() => deleteRoom(room.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 800, margin: "0 auto", padding: "2rem" },
  loading: { textAlign: "center", padding: "4rem", color: "#94a3b8" },
  title: { fontSize: "2.5rem", fontWeight: 700, textAlign: "center", color: "#f1f5f9" },
  subtitle: { textAlign: "center", color: "#94a3b8", marginBottom: "2rem" },
  playerInfo: { textAlign: "center", color: "#94a3b8", marginBottom: "2rem", fontSize: "0.9rem" },
  nameInput: {
    background: "#0f172a", color: "#f1f5f9", border: "1px solid #334155",
    borderRadius: 6, padding: "0.3rem 0.6rem", fontSize: "0.9rem", outline: "none",
    width: 140,
  },
  nameBtn: {
    background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6,
    padding: "0.25rem 0.6rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 500,
  },
  sectionTitle: { fontSize: "1.3rem", fontWeight: 600, margin: "2rem 0 1rem", color: "#cbd5e1" },
  gameGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" },
  gameCard: {
    background: "#1e293b", borderRadius: 12, padding: "1.5rem",
    border: "1px solid #334155", display: "flex", flexDirection: "column", gap: "0.5rem",
  },
  gameName: { fontSize: "1.1rem", color: "#f1f5f9" },
  gameDesc: { fontSize: "0.85rem", color: "#94a3b8", flex: 1 },
  gamePlayers: { fontSize: "0.8rem", color: "#64748b" },
  button: {
    background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8,
    padding: "0.6rem 1rem", cursor: "pointer", fontSize: "0.9rem", fontWeight: 500,
  },
  customizeBtn: {
    background: "transparent", color: "#94a3b8", border: "1px solid #475569", borderRadius: 8,
    padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.8rem",
  },
  roomList: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  roomCard: {
    background: "#1e293b", borderRadius: 8, padding: "0.8rem 1rem",
    border: "1px solid #334155", display: "flex", alignItems: "center",
    justifyContent: "space-between",
  },
  roomInfo: { fontSize: "0.9rem", color: "#cbd5e1" },
  rejoinButton: {
    background: "#22c55e", color: "#fff", border: "none", borderRadius: 6,
    padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
  },
  deleteButton: {
    background: "#ef4444", color: "#fff", border: "none", borderRadius: 6,
    padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
  },
  botStepper: {
    display: "flex", alignItems: "center", gap: "0.5rem",
  },
  botLabel: { fontSize: "0.85rem", color: "#94a3b8" },
  stepperBtn: {
    width: 28, height: 28, borderRadius: 6,
    background: "#334155", color: "#f1f5f9", border: "1px solid #475569",
    cursor: "pointer", fontSize: "1rem", lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  stepperValue: {
    minWidth: 20, textAlign: "center", fontSize: "0.9rem", color: "#f1f5f9", fontWeight: 600,
  },
  joinCard: {
    background: "#1e293b", borderRadius: 12, padding: "1.5rem",
    border: "1px solid #334155", display: "flex", flexDirection: "column", gap: "0.8rem",
  },
  joinRow: {
    display: "flex", gap: "0.5rem", alignItems: "center",
  },
  roomIdInput: {
    background: "#0f172a", color: "#f1f5f9", border: "1px solid #334155",
    borderRadius: 8, padding: "0.6rem 1rem", fontSize: "1.2rem", outline: "none",
    width: 120, textAlign: "center", letterSpacing: "0.2em", fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  errorText: {
    color: "#ef4444", fontSize: "0.85rem", margin: 0,
  },
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.6)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  modal: {
    background: "#1e293b", borderRadius: 16, padding: "2.5rem",
    border: "1px solid #334155", textAlign: "center", minWidth: 360,
  },
  roomIdDisplay: {
    fontSize: "3rem", fontWeight: 800, color: "#3b82f6",
    letterSpacing: "0.3em", fontFamily: "monospace",
    background: "#0f172a", borderRadius: 12, padding: "1rem 2rem",
    border: "2px dashed #334155", userSelect: "all" as const,
  },
};
