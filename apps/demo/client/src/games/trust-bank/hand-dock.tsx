import { useState } from "react";
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

interface HandCard {
  id: string;
  name: string;
  description: string;
  category: string;
  requiresTarget: boolean;
}

interface HandDockProps {
  hand: HandCard[];
  canPlay: boolean;
  onPlay?: (cardId: string) => void;
}

const CARD_W = 90;
const CARD_H = 80;

export function HandDock({ hand, canPlay, onPlay }: HandDockProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!hand || hand.length === 0) return null;

  return (
    <div style={dockStyle}>
      {hand.map((card) => {
        const color = CATEGORY_COLORS[card.category] || "#64748b";
        const isHovered = hoveredId === card.id;

        return (
          <div
            key={card.id}
            style={{
              width: CARD_W,
              height: CARD_H,
              position: "relative",
              zIndex: isHovered ? 5 : 3,
            }}
            onMouseEnter={() => setHoveredId(card.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => canPlay && onPlay?.(card.id)}
          >
            {/* The card itself — positioned absolute so height changes don't affect siblings */}
            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: CARD_W,
              transform: isHovered ? "translateY(-60px)" : "translateY(0)",
              transition: "transform 0.2s cubic-bezier(0.34, 1.2, 0.64, 1), border-color 0.2s, box-shadow 0.2s",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(20,30,45,0.95)",
              border: `2px solid ${isHovered ? color : `rgba(${hexToRgb(color)}, 0.4)`}`,
              boxShadow: isHovered
                ? `0 -4px 20px rgba(${hexToRgb(color)}, 0.4), 0 2px 8px rgba(0,0,0,0.5)`
                : "0 2px 6px rgba(0,0,0,0.3)",
              cursor: canPlay ? "pointer" : "default",
              overflow: "hidden",
              boxSizing: "border-box",
            }}>
              {/* Color accent top */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: color,
                borderRadius: "6px 6px 0 0",
              }} />

              {/* Category */}
              <span style={{
                fontSize: "0.5rem",
                fontWeight: 700,
                color,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginTop: 2,
              }}>
                {CATEGORY_LABELS[card.category] || card.category}
              </span>

              {/* Name */}
              <span style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#e2e8f0",
                textAlign: "center",
                lineHeight: 1.2,
              }}>
                {card.name}
              </span>

              {/* Description — shown on hover */}
              {isHovered && (
                <>
                  <span style={{
                    fontSize: "0.6rem",
                    color: "#94a3b8",
                    textAlign: "center",
                    lineHeight: 1.3,
                    marginTop: 2,
                  }}>
                    {card.description}
                  </span>
                  {card.requiresTarget && (
                    <span style={{ fontSize: "0.5rem", color: "#64748b", marginTop: 1 }}>
                      対象選択あり
                    </span>
                  )}
                  {canPlay && (
                    <span style={{
                      fontSize: "0.55rem",
                      fontWeight: 600,
                      color: "#2dd4bf",
                      marginTop: 4,
                    }}>
                      クリックでプレイ
                    </span>
                  )}
                </>
              )}
            </div>
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
  gap: 6,
  zIndex: 4,
  paddingBottom: 4,
  alignItems: "flex-end",
};

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
