import type { CSSProperties } from "react";

interface TCGCardProps {
  name: string;
  cost: number;
  attack: number;
  health: number;
  playable?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}

export function TCGCard({ name, cost, attack, health, playable, dimmed, onClick }: TCGCardProps) {
  const cardStyle: CSSProperties = {
    ...baseCardStyle,
    opacity: dimmed ? 0.5 : 1,
    cursor: playable ? "pointer" : "default",
    boxShadow: playable ? "0 0 8px #2dd4bf, 0 0 2px #2dd4bf" : "none",
    borderColor: playable ? "#2dd4bf" : "#253545",
  };

  return (
    <div style={cardStyle} onClick={playable ? onClick : undefined}>
      {/* Cost - top left */}
      <div style={costStyle}>{cost}</div>
      {/* Name - center */}
      <div style={nameStyle}>{name}</div>
      {/* Stats row */}
      <div style={statsRowStyle}>
        <span style={atkStyle}>{attack}</span>
        <span style={hpStyle}>{health}</span>
      </div>
    </div>
  );
}

export function TCGCardBack() {
  return (
    <div style={cardBackStyle}>
      <span style={{ fontSize: "1.5rem", color: "#475569" }}>?</span>
    </div>
  );
}

const baseCardStyle: CSSProperties = {
  width: 80,
  height: 110,
  background: "#1e2d3d",
  border: "1px solid #253545",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 4px",
  position: "relative",
  flexShrink: 0,
  transition: "box-shadow 0.2s, border-color 0.2s",
};

const costStyle: CSSProperties = {
  position: "absolute",
  top: 4,
  left: 4,
  width: 22,
  height: 22,
  borderRadius: "50%",
  background: "#3b82f6",
  color: "#fff",
  fontSize: "0.75rem",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const nameStyle: CSSProperties = {
  fontSize: "0.65rem",
  fontWeight: 600,
  color: "#e2e8f0",
  textAlign: "center",
  marginTop: 26,
  lineHeight: 1.2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  width: "100%",
  padding: "0 2px",
};

const statsRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  width: "100%",
  padding: "0 4px",
};

const atkStyle: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 4,
  background: "#d4a843",
  color: "#fff",
  fontSize: "0.7rem",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const hpStyle: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 4,
  background: "#ef4444",
  color: "#fff",
  fontSize: "0.7rem",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cardBackStyle: CSSProperties = {
  width: 80,
  height: 110,
  background: "#0f172a",
  border: "1px solid #253545",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
