import type { CSSProperties } from "react";
import { PokerCard, CardBack } from "./poker-card.js";

interface PlayerSeatProps {
  name: string;
  isBot: boolean;
  stack: number;
  currentBet: number;
  status: string; // "active" | "folded" | "allIn" | "busted"
  holeCards: { suit: string; rank: number; hidden?: boolean }[];
  isDealer: boolean;
  isCurrentTurn: boolean;
  isMe: boolean;
}

export function PlayerSeat({
  name,
  isBot,
  stack,
  currentBet,
  status,
  holeCards,
  isDealer,
  isCurrentTurn,
  isMe,
}: PlayerSeatProps) {
  const dimmed = status === "folded" || status === "busted";

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "0.5rem",
    borderRadius: 10,
    background: isMe ? "rgba(59,130,246,0.15)" : "rgba(15,23,42,0.7)",
    border: `1px solid ${isMe ? "#3b82f6" : "#334155"}`,
    opacity: dimmed ? 0.4 : 1,
    boxShadow: isCurrentTurn ? "0 0 12px 3px rgba(250,204,21,0.6)" : "none",
    minWidth: 90,
    position: "relative",
  };

  const statusColor: Record<string, string> = {
    active: "#22c55e",
    folded: "#64748b",
    allIn: "#ef4444",
    busted: "#475569",
  };

  return (
    <div style={containerStyle}>
      {/* Dealer button */}
      {isDealer && <div style={dealerBtnStyle}>D</div>}

      {/* Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{
          color: isMe ? "#60a5fa" : "#e2e8f0",
          fontSize: "0.75rem",
          fontWeight: 600,
          maxWidth: 80,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {isBot ? name.replace(/^bot:/, "") : name}
        </span>
        {isBot && <span style={botTagStyle}>Bot</span>}
      </div>

      {/* Hole cards */}
      <div style={{ display: "flex", gap: 3 }}>
        {holeCards.map((c, i) =>
          c.hidden
            ? <CardBack key={i} size="small" />
            : <PokerCard key={i} suit={c.suit} rank={c.rank} size="small" />,
        )}
        {holeCards.length === 0 && (
          <span style={{ color: "#475569", fontSize: "0.65rem" }}>--</span>
        )}
      </div>

      {/* Stack */}
      <span style={{ color: "#fbbf24", fontSize: "0.7rem", fontWeight: 600 }}>
        ${stack}
      </span>

      {/* Bet */}
      {currentBet > 0 && (
        <span style={{ color: "#94a3b8", fontSize: "0.65rem" }}>
          Bet: ${currentBet}
        </span>
      )}

      {/* Status badge */}
      {status !== "active" && (
        <span style={{
          fontSize: "0.6rem",
          fontWeight: 600,
          color: statusColor[status] ?? "#64748b",
          textTransform: "uppercase",
        }}>
          {status}
        </span>
      )}
    </div>
  );
}

const dealerBtnStyle: CSSProperties = {
  position: "absolute",
  top: -8,
  right: -8,
  width: 20,
  height: 20,
  borderRadius: "50%",
  background: "#fbbf24",
  color: "#0f172a",
  fontSize: "0.65rem",
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "2px solid #0f172a",
};

const botTagStyle: CSSProperties = {
  color: "#f59e0b",
  fontSize: "0.55rem",
  fontWeight: 600,
  background: "#422006",
  padding: "0 0.2rem",
  borderRadius: 3,
};
