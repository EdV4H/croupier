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

interface TrustCardProps {
  name: string;
  description: string;
  category: string;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export function TrustCard({
  name,
  description,
  category,
  onClick,
  selected,
  disabled,
  compact,
}: TrustCardProps) {
  const color = CATEGORY_COLORS[category] || "#64748b";

  const cardStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: compact ? 2 : 6,
    padding: compact ? "8px 10px" : "12px 14px",
    borderRadius: 10,
    background: disabled
      ? "rgba(30,30,30,0.6)"
      : selected
        ? `rgba(${hexToRgb(color)}, 0.2)`
        : "rgba(26,35,50,0.9)",
    border: selected
      ? `2px solid ${color}`
      : `2px solid rgba(${hexToRgb(color)}, 0.3)`,
    cursor: disabled ? "not-allowed" : onClick ? "pointer" : "default",
    opacity: disabled ? 0.5 : 1,
    transition: "all 0.15s ease",
    minWidth: compact ? 100 : 130,
    maxWidth: compact ? 140 : 180,
    position: "relative",
    overflow: "hidden",
  };

  const categoryBadgeStyle: CSSProperties = {
    fontSize: "0.55rem",
    fontWeight: 600,
    color,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  };

  const nameStyle: CSSProperties = {
    fontSize: compact ? "0.75rem" : "0.85rem",
    fontWeight: 700,
    color: "#e2e8f0",
    lineHeight: 1.2,
  };

  const descStyle: CSSProperties = {
    fontSize: "0.6rem",
    color: "#94a3b8",
    lineHeight: 1.3,
  };

  // Top accent bar
  const accentStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: color,
    borderRadius: "10px 10px 0 0",
  };

  return (
    <div
      style={cardStyle}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={(e) => {
        if (!disabled && onClick) {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px rgba(${hexToRgb(color)}, 0.3)`;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      <div style={accentStyle} />
      <span style={categoryBadgeStyle}>
        {CATEGORY_LABELS[category] || category}
      </span>
      <span style={nameStyle}>{name}</span>
      {!compact && <span style={descStyle}>{description}</span>}
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
