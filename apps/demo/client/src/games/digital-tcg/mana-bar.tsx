import type { CSSProperties } from "react";

interface ManaBarProps {
  current: number;
  max: number;
}

export function ManaBar({ current, max }: ManaBarProps) {
  const crystals = [];
  for (let i = 0; i < 10; i++) {
    let style: CSSProperties;
    if (i < current) {
      // Available mana
      style = { ...crystalBase, background: "#3b82f6", border: "1px solid #60a5fa" };
    } else if (i < max) {
      // Spent mana
      style = { ...crystalBase, background: "#1e293b", border: "1px solid #334155" };
    } else {
      // Locked
      style = { ...crystalBase, background: "#0f172a", border: "1px solid #1a2332", opacity: 0.3 };
    }
    crystals.push(<div key={i} style={style} />);
  }

  return (
    <div style={containerStyle}>
      <div style={crystalsRow}>{crystals}</div>
      <span style={labelStyle}>
        {current}/{max}
      </span>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const crystalsRow: CSSProperties = {
  display: "flex",
  gap: 3,
};

const crystalBase: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: "50%",
  transition: "background 0.2s",
};

const labelStyle: CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "#94a3b8",
  fontFamily: "monospace",
};
