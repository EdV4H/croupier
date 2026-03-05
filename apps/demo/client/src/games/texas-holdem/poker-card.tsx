import type { CSSProperties } from "react";

const RANK_LABEL: Record<number, string> = {
  1: "A", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7",
  8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K",
};

const SUIT_SYMBOL: Record<string, string> = {
  hearts: "\u2665", diamonds: "\u2666", clubs: "\u2663", spades: "\u2660",
};

type CardSize = "large" | "medium" | "small";

const SIZE_MAP: Record<CardSize, { w: number; h: number; font: string; suitFont: string }> = {
  large:  { w: 72, h: 100, font: "1.2rem", suitFont: "1.6rem" },
  medium: { w: 52, h: 72,  font: "0.9rem", suitFont: "1.2rem" },
  small:  { w: 36, h: 50,  font: "0.65rem", suitFont: "0.85rem" },
};

interface PokerCardProps {
  suit: string;
  rank: number;
  size?: CardSize;
}

export function PokerCard({ suit, rank, size = "medium" }: PokerCardProps) {
  const isRed = suit === "hearts" || suit === "diamonds";
  const s = SIZE_MAP[size];
  const label = RANK_LABEL[rank] ?? String(rank);
  const symbol = SUIT_SYMBOL[suit] ?? "?";

  const style: CSSProperties = {
    width: s.w,
    height: s.h,
    background: "#fff",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: isRed ? "#dc2626" : "#1e293b",
    fontWeight: 700,
    flexShrink: 0,
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    userSelect: "none",
  };

  return (
    <div style={style}>
      <span style={{ fontSize: s.font, lineHeight: 1 }}>{label}</span>
      <span style={{ fontSize: s.suitFont, lineHeight: 1 }}>{symbol}</span>
    </div>
  );
}

interface CardBackProps {
  size?: CardSize;
}

export function CardBack({ size = "medium" }: CardBackProps) {
  const s = SIZE_MAP[size];

  const style: CSSProperties = {
    width: s.w,
    height: s.h,
    background: "linear-gradient(135deg, #1e40af, #3b82f6)",
    borderRadius: 6,
    border: "1px solid #60a5fa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    userSelect: "none",
  };

  return (
    <div style={style}>
      <span style={{ color: "#93c5fd", fontSize: s.suitFont, fontWeight: 700 }}>?</span>
    </div>
  );
}
