import type { CSSProperties } from "react";

const RANK_LABELS: Record<string, { label: string; color: string }> = {
  daifugo:   { label: "大富豪", color: "#f59e0b" },
  fugo:      { label: "富豪",   color: "#22c55e" },
  heimin:    { label: "平民",   color: "#94a3b8" },
  hinmin:    { label: "貧民",   color: "#f97316" },
  daihinmin: { label: "大貧民", color: "#ef4444" },
};

interface PlayerSeatProps {
  name: string;
  isMe: boolean;
  isCurrentTurn: boolean;
  handCount: number;
  rank: string | null;
  finishOrder: number | null;
  score: number;
  passed: boolean;
}

export function PlayerSeat({
  name,
  isMe,
  isCurrentTurn,
  handCount,
  rank,
  finishOrder,
  score,
  passed,
}: PlayerSeatProps) {
  const finished = finishOrder !== null;
  const rankInfo = rank ? RANK_LABELS[rank] : null;

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    padding: "8px 14px",
    borderRadius: 14,
    background: finished
      ? "rgba(30,40,55,0.7)"
      : isMe
        ? "rgba(45,212,191,0.12)"
        : "rgba(26,35,50,0.85)",
    border: isCurrentTurn
      ? "2px solid #2dd4bf"
      : isMe
        ? "2px solid rgba(45,212,191,0.3)"
        : "2px solid rgba(37,53,69,0.6)",
    minWidth: 90,
    opacity: finished ? 0.7 : 1,
    transition: "all 0.2s ease",
    boxShadow: isCurrentTurn
      ? "0 0 12px rgba(45,212,191,0.3)"
      : "0 2px 8px rgba(0,0,0,0.3)",
  };

  return (
    <div style={containerStyle}>
      <span style={{
        color: isMe ? "#2dd4bf" : "#e2e8f0",
        fontSize: "0.75rem",
        fontWeight: 600,
        maxWidth: 90,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {isMe ? `${name} (You)` : name}
      </span>

      {/* Card count or finish */}
      {finished ? (
        <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#64748b", lineHeight: 1 }}>
          #{finishOrder}
        </span>
      ) : (
        <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", lineHeight: 1 }}>
          {handCount}
        </span>
      )}

      <span style={{ color: "#64748b", fontSize: "0.6rem" }}>
        {finished ? "上がり" : `${handCount} cards`}
      </span>

      {/* Rank badge */}
      {rankInfo && (
        <span style={{
          fontSize: "0.55rem",
          fontWeight: 700,
          color: rankInfo.color,
          padding: "1px 6px",
          borderRadius: 4,
          background: `rgba(${hexToRgb(rankInfo.color)}, 0.15)`,
          border: `1px solid rgba(${hexToRgb(rankInfo.color)}, 0.3)`,
        }}>
          {rankInfo.label}
        </span>
      )}

      {/* Score */}
      <span style={{ color: "#64748b", fontSize: "0.55rem" }}>
        {score} pt
      </span>

      {/* Pass indicator */}
      {passed && !finished && (
        <span style={{
          fontSize: "0.5rem",
          fontWeight: 600,
          color: "#f59e0b",
          padding: "1px 5px",
          borderRadius: 3,
          background: "rgba(245,158,11,0.15)",
        }}>
          PASS
        </span>
      )}
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
