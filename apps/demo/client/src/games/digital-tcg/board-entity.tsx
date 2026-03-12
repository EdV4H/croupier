import type { CSSProperties } from "react";

interface BoardEntityProps {
  name: string;
  attack: number;
  currentHealth: number;
  maxHealth: number;
  selected?: boolean;
  targetCandidate?: boolean;
  summoningSickness?: boolean;
  hasAttacked?: boolean;
  onClick?: () => void;
}

export function BoardEntity({
  name,
  attack,
  currentHealth,
  maxHealth,
  selected,
  targetCandidate,
  summoningSickness,
  hasAttacked,
  onClick,
}: BoardEntityProps) {
  const damaged = currentHealth < maxHealth;
  const hpColor = damaged ? (currentHealth <= Math.floor(maxHealth / 2) ? "#ef4444" : "#f59e0b") : "#e2e8f0";

  const style: CSSProperties = {
    ...baseStyle,
    opacity: hasAttacked ? 0.7 : 1,
    cursor: (selected || targetCandidate || onClick) ? "pointer" : "default",
    boxShadow: selected
      ? "0 0 10px #2dd4bf, 0 0 3px #2dd4bf"
      : targetCandidate
        ? "0 0 10px #ef4444, 0 0 3px #ef4444"
        : "none",
    borderColor: selected ? "#2dd4bf" : targetCandidate ? "#ef4444" : "#253545",
  };

  return (
    <div style={style} onClick={onClick}>
      {/* Status badges */}
      {summoningSickness && (
        <div style={sicknessBadge}>Zzz</div>
      )}
      {hasAttacked && (
        <div style={attackedBadge}>✓</div>
      )}
      {/* Name */}
      <div style={entityNameStyle}>{name}</div>
      {/* Stats */}
      <div style={entityStatsStyle}>
        <span style={entityAtkStyle}>{attack}</span>
        <span style={{ ...entityHpStyle, color: hpColor }}>{currentHealth}</span>
      </div>
    </div>
  );
}

const baseStyle: CSSProperties = {
  width: 72,
  height: 90,
  background: "#1e2d3d",
  border: "1px solid #253545",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  position: "relative",
  flexShrink: 0,
  transition: "box-shadow 0.2s, border-color 0.2s",
};

const entityNameStyle: CSSProperties = {
  fontSize: "0.6rem",
  fontWeight: 600,
  color: "#e2e8f0",
  textAlign: "center",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  width: "100%",
  padding: "0 4px",
};

const entityStatsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const entityAtkStyle: CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 700,
  color: "#d4a843",
};

const entityHpStyle: CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 700,
};

const sicknessBadge: CSSProperties = {
  position: "absolute",
  top: 2,
  right: 2,
  fontSize: "0.55rem",
  color: "#a78bfa",
  fontWeight: 700,
};

const attackedBadge: CSSProperties = {
  position: "absolute",
  top: 2,
  left: 4,
  fontSize: "0.65rem",
  color: "#94a3b8",
  fontWeight: 700,
};
