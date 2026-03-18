import type { CSSProperties } from "react";

const SUIT_SYMBOL: Record<string, string> = {
  spades: "\u2660", hearts: "\u2665", diamonds: "\u2666", clubs: "\u2663",
};

const RANK_LABEL: Record<number, string> = {
  3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
  11: "J", 12: "Q", 13: "K", 14: "A", 15: "2",
};

export interface CardData {
  id: string;
  suit: string;
  rank: number;
}

interface PlayingCardProps {
  card: CardData;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  size?: "large" | "medium" | "small";
}

const SIZE = {
  large:  { w: 56, h: 80, font: "1rem", suitFont: "1.3rem" },
  medium: { w: 44, h: 64, font: "0.85rem", suitFont: "1rem" },
  small:  { w: 32, h: 46, font: "0.65rem", suitFont: "0.8rem" },
};

export function PlayingCard({ card, selected, disabled, onClick, size = "medium" }: PlayingCardProps) {
  const isJoker = card.suit === "joker";
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const s = SIZE[size];

  const label = isJoker ? "JK" : RANK_LABEL[card.rank] ?? String(card.rank);
  const symbol = isJoker ? "\u2605" : SUIT_SYMBOL[card.suit] ?? "?";
  const color = isJoker ? "#a855f7" : isRed ? "#ef6b6b" : "#c8d6e5";

  const style: CSSProperties = {
    width: s.w,
    height: s.h,
    background: selected ? "rgba(34,197,94,0.2)" : "#1e2d3d",
    borderRadius: 8,
    border: selected ? "2px solid #4ade80" : "1.5px solid #253545",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color,
    fontWeight: 700,
    flexShrink: 0,
    boxShadow: selected
      ? "0 0 12px rgba(74,222,128,0.3), 0 2px 6px rgba(0,0,0,0.4)"
      : "0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
    userSelect: "none",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "all 0.15s ease",
  };

  return (
    <div style={style} onClick={disabled ? undefined : onClick}>
      <span style={{ fontSize: s.font, lineHeight: 1 }}>{label}</span>
      <span style={{ fontSize: s.suitFont, lineHeight: 1 }}>{symbol}</span>
    </div>
  );
}

export function CardBack({ size = "medium" }: { size?: "large" | "medium" | "small" }) {
  const s = SIZE[size];
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
    boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
    userSelect: "none",
  };
  return (
    <div style={style}>
      <span style={{ color: "#2a3f52", fontSize: s.suitFont, fontWeight: 700 }}>?</span>
    </div>
  );
}
