import { useCallback, useEffect, useState } from "react";

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
}

interface GameSelectorProps {
  playerId: string;
  onJoinRoom: (roomId: string, gameId: string) => void;
}

export function GameSelector({ playerId, onJoinRoom }: GameSelectorProps) {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);

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

  const createRoom = async (gameId: string) => {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, playerId }),
    });
    const data = await res.json();
    if (data.id) {
      onJoinRoom(data.id, gameId);
    }
  };

  const joinRoom = async (roomId: string, gameId: string) => {
    await fetch(`/api/rooms/${roomId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    onJoinRoom(roomId, gameId);
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Croupier</h1>
      <p style={styles.subtitle}>Universal Game Engine Demo</p>
      <p style={styles.playerInfo}>Playing as: <strong>{playerId}</strong></p>

      <h2 style={styles.sectionTitle}>Available Games</h2>
      <div style={styles.gameGrid}>
        {games.map((game) => (
          <div key={game.id} style={styles.gameCard}>
            <h3 style={styles.gameName}>{game.name}</h3>
            <p style={styles.gameDesc}>{game.description}</p>
            <p style={styles.gamePlayers}>
              {game.minPlayers}–{game.maxPlayers} players
            </p>
            <button
              style={styles.button}
              onClick={() => createRoom(game.id)}
            >
              Create Room
            </button>
          </div>
        ))}
      </div>

      {rooms.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>Open Rooms</h2>
          <div style={styles.roomList}>
            {rooms
              .filter((r) => !r.started)
              .map((room) => (
                <div key={room.id} style={styles.roomCard}>
                  <span style={styles.roomInfo}>
                    {games.find((g) => g.id === room.gameId)?.name ?? room.gameId}
                    {" — "}
                    {room.players.length} player(s):{" "}
                    {room.players.map((p, i) => (
                      <span key={p}>
                        {i > 0 && ", "}
                        {p.startsWith("bot:") ? (
                          <span style={styles.botName}>{p.slice(4)} (Bot)</span>
                        ) : (
                          p
                        )}
                      </span>
                    ))}
                  </span>
                  {!room.players.includes(playerId) ? (
                    <button
                      style={styles.buttonSmall}
                      onClick={() => joinRoom(room.id, room.gameId)}
                    >
                      Join
                    </button>
                  ) : (
                    <span style={styles.badge}>Joined</span>
                  )}
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
  buttonSmall: {
    background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6,
    padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.8rem",
  },
  roomList: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  roomCard: {
    background: "#1e293b", borderRadius: 8, padding: "0.8rem 1rem",
    border: "1px solid #334155", display: "flex", alignItems: "center",
    justifyContent: "space-between",
  },
  roomInfo: { fontSize: "0.9rem", color: "#cbd5e1" },
  badge: { fontSize: "0.75rem", color: "#22c55e", fontWeight: 600 },
  botName: { color: "#f59e0b", fontStyle: "italic" },
};
