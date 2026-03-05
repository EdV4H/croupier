import type { CSSProperties } from "react";
import { VotingCard } from "./voting-card.js";

interface PlayerCardProps {
  name: string;
  role: "facilitator" | "voter";
  selectedCard: string | null;
  isMe: boolean;
}

export function PlayerCard({ name, role, selectedCard, isMe }: PlayerCardProps) {
  const isBot = name.startsWith("bot:");
  const displayName = isBot ? name.slice(4) : name;

  return (
    <div style={{
      ...containerStyle,
      border: isMe
        ? "1px solid rgba(45,212,191,0.3)"
        : "1px solid #253545",
    }}>
      <div style={headerStyle}>
        <span style={{
          color: isMe ? "#2dd4bf" : "#e2e8f0",
          fontSize: "0.8rem",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flexShrink: 1,
          minWidth: 0,
        }}>
          {displayName}
        </span>
        <span style={{
          fontSize: "0.6rem",
          fontWeight: 600,
          padding: "0.1rem 0.4rem",
          borderRadius: 8,
          color: "#fff",
          background: role === "facilitator" ? "#d4a843" : "#7a8fa3",
          flexShrink: 0,
        }}>
          {role === "facilitator" ? "F" : "V"}
        </span>
        {isBot && (
          <span style={botTagStyle}>Bot</span>
        )}
      </div>
      <VotingCard value={selectedCard} />
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  padding: 8,
  borderRadius: 10,
  background: "#1a2332",
  width: 100,
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 3,
  maxWidth: "100%",
  overflow: "hidden",
};

const botTagStyle: CSSProperties = {
  color: "#f59e0b",
  fontSize: "0.55rem",
  fontWeight: 600,
  background: "#422006",
  padding: "0 0.2rem",
  borderRadius: 3,
  flexShrink: 0,
};
