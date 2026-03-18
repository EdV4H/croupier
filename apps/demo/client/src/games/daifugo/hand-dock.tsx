import { useState } from "react";
import type { CSSProperties } from "react";
import { PlayingCard, type CardData } from "./playing-card.js";

interface HandDockProps {
  hand: CardData[];
  selectedIds: Set<string>;
  canPlay: boolean;
  onToggle: (cardId: string) => void;
}

export function HandDock({ hand, selectedIds, canPlay, onToggle }: HandDockProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!hand || hand.length === 0) return null;

  // Sort hand by rank, then suit
  const SUIT_ORDER: Record<string, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3, joker: 4 };
  const sorted = [...hand].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return (SUIT_ORDER[a.suit] ?? 5) - (SUIT_ORDER[b.suit] ?? 5);
  });

  return (
    <div style={dockStyle}>
      {sorted.map((card) => {
        const isHovered = hoveredId === card.id;
        const isSelected = selectedIds.has(card.id);

        return (
          <div
            key={card.id}
            style={{
              position: "relative",
              zIndex: isHovered ? 10 : isSelected ? 8 : 3,
              transform: isHovered
                ? "translateY(-20px)"
                : isSelected
                  ? "translateY(-12px)"
                  : "translateY(0)",
              transition: "transform 0.2s cubic-bezier(0.34, 1.2, 0.64, 1)",
            }}
            onMouseEnter={() => setHoveredId(card.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <PlayingCard
              card={card}
              selected={isSelected}
              disabled={!canPlay}
              onClick={() => canPlay && onToggle(card.id)}
              size="medium"
            />
          </div>
        );
      })}
    </div>
  );
}

const dockStyle: CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  gap: 3,
  zIndex: 4,
  paddingBottom: 4,
  alignItems: "flex-end",
};
