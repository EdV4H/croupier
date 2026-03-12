import type { CSSProperties } from "react";

const CATEGORY_COLORS: Record<string, string> = {
  trust: "#22c55e",
  crisis: "#f59e0b",
  attack: "#ef4444",
  repair: "#3b82f6",
  relationship: "#a855f7",
};

interface PlayerSeatProps {
  name: string;
  trustPoints: number;
  eliminated: boolean;
  isMe: boolean;
  isCurrentTurn: boolean;
  handCount: number;
  mission: unknown;
  openedMission?: { name: string; description: string; bonus: number } | null;
  targetable?: boolean;
  onClick?: () => void;
}

export function PlayerSeat({
  name,
  trustPoints,
  eliminated,
  isMe,
  isCurrentTurn,
  handCount,
  mission,
  openedMission,
  targetable,
  onClick,
}: PlayerSeatProps) {
  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "10px 14px",
    borderRadius: 14,
    background: eliminated
      ? "rgba(30,30,30,0.7)"
      : targetable
        ? "rgba(239,68,68,0.12)"
        : isMe
          ? "rgba(45,212,191,0.12)"
          : "rgba(26,35,50,0.85)",
    border: targetable
      ? "2px solid rgba(239,68,68,0.7)"
      : isCurrentTurn
        ? "2px solid #2dd4bf"
        : isMe
          ? "2px solid rgba(45,212,191,0.3)"
          : "2px solid rgba(37,53,69,0.6)",
    minWidth: 100,
    opacity: eliminated ? 0.5 : 1,
    transition: "all 0.2s ease",
    boxShadow: targetable
      ? "0 0 16px rgba(239,68,68,0.3)"
      : isCurrentTurn
        ? "0 0 12px rgba(45,212,191,0.3)"
        : "none",
    cursor: targetable ? "pointer" : "default",
  };

  const nameStyle: CSSProperties = {
    color: isMe ? "#2dd4bf" : "#e2e8f0",
    fontSize: "0.75rem",
    fontWeight: 600,
    maxWidth: 90,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const pointsStyle: CSSProperties = {
    fontSize: "1.4rem",
    fontWeight: 700,
    color: eliminated
      ? "#64748b"
      : trustPoints <= 3
        ? "#ef4444"
        : trustPoints >= 15
          ? "#22c55e"
          : "#e2e8f0",
    lineHeight: 1,
  };

  return (
    <div style={containerStyle} onClick={targetable ? onClick : undefined}>
      {targetable && (
        <span style={{ fontSize: "0.55rem", fontWeight: 700, color: "#ef4444" }}>
          対象に選択
        </span>
      )}
      <span style={nameStyle}>
        {isMe ? `${name} (You)` : name}
      </span>
      <span style={pointsStyle}>
        {eliminated ? "OUT" : trustPoints}
      </span>
      {!eliminated && (
        <span style={{ color: "#64748b", fontSize: "0.6rem" }}>
          {handCount} cards
        </span>
      )}
      {/* Mission display */}
      {openedMission ? (
        <div style={missionOpenStyle}>
          <span style={{ fontSize: "0.55rem", color: "#94a3b8" }}>
            {openedMission.name}
          </span>
        </div>
      ) : isMe && mission && typeof mission === "object" ? (
        <div style={missionSecretStyle}>
          <span style={{ fontSize: "0.55rem", color: "#f59e0b", fontWeight: 600 }}>
            MISSION
          </span>
          <span style={{ fontSize: "0.55rem", color: "#94a3b8" }}>
            {(mission as any).name}
          </span>
        </div>
      ) : (
        <div style={missionHiddenStyle}>
          <span style={{ fontSize: "0.55rem", color: "#475569" }}>
            ???
          </span>
        </div>
      )}
    </div>
  );
}

const missionOpenStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 1,
  padding: "2px 6px",
  borderRadius: 4,
  background: "rgba(34,197,94,0.1)",
  border: "1px solid rgba(34,197,94,0.2)",
};

const missionSecretStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 1,
  padding: "2px 6px",
  borderRadius: 4,
  background: "rgba(245,158,11,0.1)",
  border: "1px solid rgba(245,158,11,0.2)",
};

const missionHiddenStyle: CSSProperties = {
  padding: "2px 6px",
  borderRadius: 4,
  background: "rgba(71,85,105,0.15)",
};
