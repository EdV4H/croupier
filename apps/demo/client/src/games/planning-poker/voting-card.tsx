import type { CSSProperties } from "react";

interface VotingCardProps {
  /** null = not voted, "selected" = face down (hidden), string = face up (value) */
  value: string | null;
  size?: "normal" | "small";
}

export function VotingCard({ value, size = "normal" }: VotingCardProps) {
  const isSmall = size === "small";
  const w = isSmall ? 40 : 56;
  const h = isSmall ? 56 : 80;

  const base: CSSProperties = {
    width: w,
    height: h,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "transform 0.2s, box-shadow 0.2s",
  };

  // Not voted — empty placeholder
  if (value === null) {
    return (
      <div style={{
        ...base,
        border: "2px dashed #253545",
        background: "#152029",
      }}>
        <span style={{ color: "#2a3f52", fontSize: isSmall ? "0.7rem" : "0.85rem" }}>—</span>
      </div>
    );
  }

  // Face down — "selected" but hidden
  if (value === "selected") {
    return (
      <div style={{
        ...base,
        background: "linear-gradient(135deg, #152029 0%, #1a2332 100%)",
        border: "1px solid #253545",
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)",
      }}>
        <span style={{
          color: "#2a3f52",
          fontSize: isSmall ? "1rem" : "1.4rem",
          fontWeight: 700,
        }}>?</span>
      </div>
    );
  }

  // Face up — show value
  return (
    <div style={{
      ...base,
      background: "#1e2d3d",
      border: "1px solid #253545",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    }}>
      <span style={{
        color: "#e2e8f0",
        fontSize: isSmall ? "1rem" : "1.5rem",
        fontWeight: 700,
        lineHeight: 1,
      }}>{value}</span>
    </div>
  );
}
