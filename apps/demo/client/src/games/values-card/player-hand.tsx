import { useState } from "react";
import type { CSSProperties } from "react";
import { ValueCard } from "./value-card.js";

interface Card {
  id: string;
  name: string;
}

interface PlayerHandProps {
  playerId: string;
  hand: Card[];
  handCount?: number;
  isMe: boolean;
  isCurrentTurn: boolean;
  stage: string | null;
  onDiscard?: (cardId: string) => void;
}

export function PlayerHand({
  playerId,
  hand,
  handCount,
  isMe,
  isCurrentTurn,
  stage,
  onDiscard,
}: PlayerHandProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isBot = playerId.startsWith("bot:");
  const displayName = isBot ? playerId.slice(4) : playerId;
  const canDiscard = isMe && isCurrentTurn && stage === "waitingForDiscard" && !!onDiscard;

  const handleCardClick = (cardId: string) => {
    if (!canDiscard) return;
    if (selectedId === cardId) {
      onDiscard!(cardId);
      setSelectedId(null);
    } else {
      setSelectedId(cardId);
    }
  };

  return (
    <div
      style={{
        ...containerStyle,
        border: `1.5px solid ${isMe ? "rgba(45,212,191,0.3)" : "#253545"}`,
      }}
    >
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: isMe ? "#2dd4bf" : "#e2e8f0", fontSize: "0.8rem", fontWeight: 600 }}>
            {displayName}
            {isMe && " (You)"}
          </span>
          {isBot && <span style={botTagStyle}>Bot</span>}
        </div>
        {isCurrentTurn && (
          <span style={turnBadgeStyle}>Current Turn</span>
        )}
      </div>

      {/* Cards */}
      <div style={cardsStyle}>
        {hand.length > 0
          ? hand.map((card) => (
              <ValueCard
                key={card.id}
                name={card.name}
                variant={canDiscard ? "selectable" : "hand"}
                selected={canDiscard && selectedId === card.id}
                onClick={canDiscard ? () => handleCardClick(card.id) : undefined}
              />
            ))
          : Array.from({ length: handCount ?? 0 }).map((_, i) => (
              <div key={i} style={cardBackStyle} />
            ))}
      </div>

      {/* Discard hint */}
      {canDiscard && (
        <p style={hintStyle}>
          {selectedId ? "Click again to confirm discard" : "Click a card to discard"}
        </p>
      )}
    </div>
  );
}

const containerStyle: CSSProperties = {
  background: "#1a2332",
  borderRadius: 12,
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const botTagStyle: CSSProperties = {
  color: "#f59e0b",
  fontSize: "0.6rem",
  fontWeight: 600,
  background: "#422006",
  padding: "0 4px",
  borderRadius: 3,
};

const turnBadgeStyle: CSSProperties = {
  color: "#2dd4bf",
  fontSize: "0.65rem",
  fontWeight: 600,
  background: "rgba(45,212,191,0.12)",
  padding: "2px 8px",
  borderRadius: 10,
  boxShadow: "0 0 6px rgba(45,212,191,0.15)",
};

const cardsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const cardBackStyle: CSSProperties = {
  width: 72,
  height: 48,
  background: "linear-gradient(135deg, #1e2d3d 0%, #253545 100%)",
  border: "1.5px solid #253545",
  borderRadius: 10,
  boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
  flexShrink: 0,
};

const hintStyle: CSSProperties = {
  color: "#7a8fa3",
  fontSize: "0.7rem",
  margin: 0,
};
