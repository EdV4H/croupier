import { useRef, useEffect } from "react";
import type { CSSProperties } from "react";

const CATEGORY_COLORS: Record<string, string> = {
  trust: "#22c55e",
  crisis: "#f59e0b",
  attack: "#ef4444",
  repair: "#3b82f6",
  relationship: "#a855f7",
};

const CATEGORY_ICONS: Record<string, string> = {
  trust: "+",
  crisis: "!",
  attack: "⚔",
  repair: "♥",
  relationship: "⇄",
};

interface TurnHistoryEntry {
  turn: number;
  playerId: string;
  cardName: string;
  category: string;
  description: string;
  targetPlayerId?: string;
}

interface CardHistoryProps {
  turnHistory: TurnHistoryEntry[];
  currentPlayerId: string;
}

export function CardHistory({ turnHistory, currentPlayerId }: CardHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turnHistory.length]);

  if (turnHistory.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>Card History</div>
        <span style={{ color: "#475569", fontSize: "0.7rem", padding: "8px 0", textAlign: "center" }}>
          まだカードが使われていません
        </span>
      </div>
    );
  }

  // Show recent entries (last 20)
  const recent = turnHistory.slice(-20);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Card History</div>
      <div ref={scrollRef} style={scrollStyle}>
        {recent.map((ev, i) => {
          const color = CATEGORY_COLORS[ev.category] || "#64748b";
          const icon = CATEGORY_ICONS[ev.category] || "•";
          const isMe = ev.playerId === currentPlayerId;
          const isTargetMe = ev.targetPlayerId === currentPlayerId;

          return (
            <div key={i} style={entryStyle}>
              <div style={{
                ...iconStyle,
                color,
                background: `rgba(${hexToRgb(color)}, 0.15)`,
                border: `1px solid rgba(${hexToRgb(color)}, 0.3)`,
              }}>
                {icon}
              </div>
              <div style={entryContentStyle}>
                <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: isMe ? "#2dd4bf" : "#e2e8f0",
                  }}>
                    {ev.playerId}
                  </span>
                  <span style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color,
                  }}>
                    {ev.cardName}
                  </span>
                  {ev.targetPlayerId && (
                    <>
                      <span style={{ fontSize: "0.6rem", color: "#64748b" }}>→</span>
                      <span style={{
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: isTargetMe ? "#2dd4bf" : "#e2e8f0",
                      }}>
                        {ev.targetPlayerId}
                      </span>
                    </>
                  )}
                </div>
                <span style={{ fontSize: "0.6rem", color: "#64748b" }}>
                  {ev.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "#1a2332",
  borderRadius: 12,
  border: "1px solid #253545",
  overflow: "hidden",
  flex: 1,
  minHeight: 0,
};

const headerStyle: CSSProperties = {
  padding: "8px 12px",
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  borderBottom: "1px solid #253545",
  flexShrink: 0,
};

const scrollStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "6px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const entryStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  padding: "4px 6px",
  borderRadius: 6,
  background: "rgba(37,53,69,0.3)",
};

const iconStyle: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 5,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.65rem",
  fontWeight: 700,
  flexShrink: 0,
};

const entryContentStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
  minWidth: 0,
};

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
