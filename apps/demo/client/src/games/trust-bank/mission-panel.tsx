import type { CSSProperties } from "react";

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#22c55e",
  normal: "#3b82f6",
  hard: "#ef4444",
};

interface MissionPanelProps {
  mission: {
    id: string;
    name: string;
    description: string;
    difficulty: string;
    bonus: number;
  } | null;
  completed: boolean;
}

export function MissionPanel({ mission, completed }: MissionPanelProps) {
  if (!mission) return null;

  const diffColor = DIFFICULTY_COLORS[mission.difficulty] || "#64748b";

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={{ color: "#f59e0b", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
          Secret Mission
        </span>
        {completed && (
          <span style={completedBadgeStyle}>CLEAR!</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 700 }}>
          {mission.name}
        </span>
        <span style={{
          fontSize: "0.55rem",
          fontWeight: 600,
          padding: "1px 6px",
          borderRadius: 4,
          color: diffColor,
          background: `rgba(${hexToRgb(diffColor)}, 0.15)`,
          border: `1px solid rgba(${hexToRgb(diffColor)}, 0.3)`,
          textTransform: "uppercase",
        }}>
          {mission.difficulty}
        </span>
      </div>
      <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
        {mission.description}
      </span>
      <span style={{ color: "#f59e0b", fontSize: "0.7rem", fontWeight: 500 }}>
        Bonus: +{mission.bonus} pt
      </span>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "10px 14px",
  borderRadius: 10,
  background: "rgba(245,158,11,0.06)",
  border: "1px solid rgba(245,158,11,0.2)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const completedBadgeStyle: CSSProperties = {
  fontSize: "0.6rem",
  fontWeight: 700,
  padding: "1px 8px",
  borderRadius: 6,
  color: "#22c55e",
  background: "rgba(34,197,94,0.15)",
  border: "1px solid rgba(34,197,94,0.3)",
};

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
