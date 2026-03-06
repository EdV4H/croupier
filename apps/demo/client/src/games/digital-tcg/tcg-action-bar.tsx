import type { CSSProperties } from "react";

interface TCGActionBarProps {
  isMyTurn: boolean;
  attackMode: boolean;
  onEndTurn: () => void;
  onCancelAttack: () => void;
}

export function TCGActionBar({ isMyTurn, attackMode, onEndTurn, onCancelAttack }: TCGActionBarProps) {
  if (!isMyTurn) {
    return (
      <div style={barStyle}>
        <span style={waitingText}>Opponent's Turn</span>
      </div>
    );
  }

  return (
    <div style={barStyle}>
      {attackMode && (
        <div style={attackModeRow}>
          <span style={attackModeText}>Select a target...</span>
          <button style={cancelBtn} onClick={onCancelAttack}>
            Cancel
          </button>
        </div>
      )}
      <button style={endTurnBtn} onClick={onEndTurn}>
        End Turn
      </button>
    </div>
  );
}

const barStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  background: "#1a2332",
  borderRadius: 10,
  border: "1px solid #253545",
  padding: "10px 16px",
};

const attackModeRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const attackModeText: CSSProperties = {
  color: "#ef4444",
  fontSize: "0.85rem",
  fontWeight: 600,
};

const cancelBtn: CSSProperties = {
  background: "#334155",
  color: "#e2e8f0",
  border: "none",
  borderRadius: 6,
  padding: "6px 14px",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 600,
};

const endTurnBtn: CSSProperties = {
  background: "#6366f1",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 24px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: 700,
  letterSpacing: 0.5,
};

const waitingText: CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.9rem",
  fontWeight: 600,
  fontStyle: "italic",
};
