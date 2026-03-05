import type { CSSProperties } from "react";

interface DeckSelectorProps {
  deck: string[];
  selectedCard: string | null;
  onSelect: (card: string) => void;
}

export function DeckSelector({ deck, selectedCard, onSelect }: DeckSelectorProps) {
  return (
    <div style={containerStyle}>
      <span style={labelStyle}>Select your estimate</span>
      <div style={cardsRowStyle}>
        {deck.map((card) => {
          const isSelected = selectedCard === card;
          return (
            <button
              key={card}
              style={{
                ...cardBtnStyle,
                border: isSelected ? "2px solid #2dd4bf" : "1px solid #253545",
                background: isSelected ? "#1a2332" : "#1e2d3d",
                transform: isSelected ? "scale(1.05)" : "scale(1)",
                boxShadow: isSelected ? "0 0 12px rgba(45,212,191,0.2)" : "none",
              }}
              onClick={() => onSelect(card)}
            >
              <span style={{
                color: isSelected ? "#2dd4bf" : "#e2e8f0",
                fontSize: "1.1rem",
                fontWeight: 700,
              }}>{card}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  background: "#1a2332",
  borderRadius: 16,
  padding: 12,
  border: "1px solid #253545",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const labelStyle: CSSProperties = {
  color: "#7a8fa3",
  fontSize: "0.8rem",
  fontWeight: 600,
};

const cardsRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const cardBtnStyle: CSSProperties = {
  width: 52,
  height: 68,
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
};
