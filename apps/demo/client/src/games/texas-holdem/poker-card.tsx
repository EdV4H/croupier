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
  large:  { w: 64, h: 90, font: "1.1rem", suitFont: "1.4rem" },
  medium: { w: 46, h: 64,  font: "0.85rem", suitFont: "1.1rem" },
  small:  { w: 32, h: 44,  font: "0.6rem", suitFont: "0.8rem" },
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
    background: "#1e2d3d",
    borderRadius: 8,
    border: "1px solid #253545",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: isRed ? "#ef6b6b" : "#c8d6e5",
    fontWeight: 700,
    flexShrink: 0,
    boxShadow: "0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
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
    background: "linear-gradient(135deg, #152029, #1a2332)",
    borderRadius: 8,
    border: "1px solid #253545",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: "0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
    userSelect: "none",
  };

  return (
    <div style={style}>
      <span style={{ color: "#2a3f52", fontSize: s.suitFont, fontWeight: 700 }}>?</span>
    </div>
  );
}
