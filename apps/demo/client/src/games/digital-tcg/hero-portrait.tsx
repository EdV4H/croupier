import type { CSSProperties } from "react";

interface HeroPortraitProps {
  life: number;
  isTarget?: boolean;
  onClick?: () => void;
}

export function HeroPortrait({ life, isTarget, onClick }: HeroPortraitProps) {
  const color = life > 15 ? "#22c55e" : life >= 8 ? "#d4a843" : "#ef4444";

  const style: CSSProperties = {
    ...baseStyle,
    borderColor: isTarget ? "#ef4444" : "#253545",
    boxShadow: isTarget ? "0 0 10px #ef4444, 0 0 3px #ef4444" : "none",
    cursor: isTarget ? "pointer" : "default",
  };

  return (
    <div style={style} onClick={isTarget ? onClick : undefined}>
      <span style={{ ...lifeStyle, color }}>{life}</span>
      <span style={labelStyle}>HP</span>
    </div>
  );
}

const baseStyle: CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  background: "#0f172a",
  border: "2px solid #253545",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  transition: "box-shadow 0.2s, border-color 0.2s",
};

const lifeStyle: CSSProperties = {
  fontSize: "1.2rem",
  fontWeight: 700,
  lineHeight: 1,
};

const labelStyle: CSSProperties = {
  fontSize: "0.55rem",
  color: "#94a3b8",
  fontWeight: 600,
  marginTop: 2,
};
