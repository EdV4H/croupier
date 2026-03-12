import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";

const CATEGORY_COLORS: Record<string, string> = {
  trust: "#22c55e",
  crisis: "#f59e0b",
  attack: "#ef4444",
  repair: "#3b82f6",
  relationship: "#a855f7",
};

const CATEGORY_LABELS: Record<string, string> = {
  trust: "信頼構築",
  crisis: "信頼危機",
  attack: "攻撃",
  repair: "修復",
  relationship: "関係",
};

interface TurnHistoryEntry {
  turn: number;
  playerId: string;
  cardName: string;
  category: string;
  description: string;
  targetPlayerId?: string;
}

interface CardEffectOverlayProps {
  turnHistory: TurnHistoryEntry[];
  currentPlayerId: string;
}

interface VisibleEffect {
  entry: TurnHistoryEntry;
  key: number;
  phase: "enter" | "visible" | "exit";
}

export function CardEffectOverlay({ turnHistory, currentPlayerId }: CardEffectOverlayProps) {
  const [effect, setEffect] = useState<VisibleEffect | null>(null);
  const prevLenRef = useRef(turnHistory.length);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const prevLen = prevLenRef.current;
    prevLenRef.current = turnHistory.length;

    if (turnHistory.length > prevLen && turnHistory.length > 0) {
      const latest = turnHistory[turnHistory.length - 1];
      const key = Date.now();

      // Clear any running timer
      if (timerRef.current) clearTimeout(timerRef.current);

      // Enter
      setEffect({ entry: latest, key, phase: "enter" });

      // Visible after brief enter animation
      timerRef.current = setTimeout(() => {
        setEffect((prev) => prev && prev.key === key ? { ...prev, phase: "visible" } : prev);
      }, 30);

      // Start exit
      timerRef.current = setTimeout(() => {
        setEffect((prev) => prev && prev.key === key ? { ...prev, phase: "exit" } : prev);
      }, 1200);

      // Remove
      timerRef.current = setTimeout(() => {
        setEffect((prev) => prev && prev.key === key ? null : prev);
      }, 1600);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [turnHistory.length]);

  if (!effect) return null;

  const { entry, phase } = effect;
  const color = CATEGORY_COLORS[entry.category] || "#64748b";
  const isMe = entry.playerId === currentPlayerId;
  const isTargetMe = entry.targetPlayerId === currentPlayerId;

  const containerStyle: CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: phase === "enter"
      ? "translate(-50%, -50%) scale(0.5)"
      : phase === "exit"
        ? "translate(-50%, -50%) scale(0.9) translateY(-20px)"
        : "translate(-50%, -50%) scale(1)",
    opacity: phase === "enter" ? 0 : phase === "exit" ? 0 : 1,
    transition: phase === "enter"
      ? "all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)"
      : "all 0.4s ease-out",
    zIndex: 10,
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  };

  const cardStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "14px 24px",
    borderRadius: 14,
    background: `linear-gradient(135deg, rgba(${hexToRgb(color)}, 0.25), rgba(${hexToRgb(color)}, 0.1))`,
    border: `2px solid ${color}`,
    boxShadow: `0 0 30px rgba(${hexToRgb(color)}, 0.4), 0 4px 20px rgba(0,0,0,0.5)`,
    backdropFilter: "blur(8px)",
    minWidth: 160,
  };

  return (
    <div style={containerStyle}>
      {/* Player name */}
      <span style={{
        fontSize: "0.7rem",
        fontWeight: 600,
        color: isMe ? "#2dd4bf" : "#e2e8f0",
        textShadow: "0 1px 4px rgba(0,0,0,0.5)",
      }}>
        {entry.playerId}
      </span>

      {/* Card */}
      <div style={cardStyle}>
        <span style={{
          fontSize: "0.55rem",
          fontWeight: 600,
          color,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}>
          {CATEGORY_LABELS[entry.category] || entry.category}
        </span>
        <span style={{
          fontSize: "1rem",
          fontWeight: 700,
          color: "#fff",
          textShadow: `0 0 8px rgba(${hexToRgb(color)}, 0.5)`,
          textAlign: "center",
        }}>
          {entry.cardName}
        </span>
        <span style={{
          fontSize: "0.65rem",
          color: "#cbd5e1",
          textAlign: "center",
          maxWidth: 200,
        }}>
          {entry.description}
        </span>
      </div>

      {/* Target */}
      {entry.targetPlayerId && (
        <span style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          color: isTargetMe ? "#2dd4bf" : "#fca5a5",
          textShadow: "0 1px 4px rgba(0,0,0,0.5)",
        }}>
          → {entry.targetPlayerId}
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
