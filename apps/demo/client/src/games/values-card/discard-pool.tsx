import { useMemo } from "react";
import type { CSSProperties } from "react";
import { ValueCard } from "./value-card.js";

interface Card {
  id: string;
  name: string;
}

interface DiscardEntry {
  card: Card;
  discardedBy: string;
}

interface DiscardPoolProps {
  discardPool: DiscardEntry[];
  onPickCard?: (cardId: string) => void;
  canPick: boolean;
}

export function DiscardPool({ discardPool, onPickCard, canPick }: DiscardPoolProps) {
  // Group by discardedBy
  const grouped = useMemo(() => {
    const map: Record<string, DiscardEntry[]> = {};
    for (const entry of discardPool) {
      const key = entry.discardedBy;
      if (!map[key]) map[key] = [];
      map[key].push(entry);
    }
    return map;
  }, [discardPool]);

  const playerIds = Object.keys(grouped);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Discard Pool</span>
        <span style={countStyle}>{discardPool.length}</span>
      </div>

      {playerIds.length === 0 ? (
        <p style={emptyStyle}>No discards yet</p>
      ) : (
        <div style={groupsStyle}>
          {playerIds.map((pid) => {
            const isBot = pid.startsWith("bot:");
            const displayName = isBot ? pid.slice(4) : pid;
            return (
              <div key={pid} style={groupStyle}>
                <div style={groupHeaderStyle}>
                  <span style={{ color: "#7a8fa3", fontSize: "0.7rem", fontWeight: 600 }}>
                    {displayName}
                  </span>
                  {isBot && <span style={botTagStyle}>Bot</span>}
                </div>
                <div style={cardsRowStyle}>
                  {grouped[pid].map((entry) => (
                    <ValueCard
                      key={entry.card.id}
                      name={entry.card.name}
                      variant={canPick ? "selectable" : "discard"}
                      size="small"
                      onClick={canPick && onPickCard ? () => onPickCard(entry.card.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const containerStyle: CSSProperties = {
  background: "#1a2332",
  borderRadius: 16,
  padding: 12,
  border: "1px solid #253545",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
};

const titleStyle: CSSProperties = {
  color: "#7a8fa3",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const countStyle: CSSProperties = {
  color: "#64748b",
  fontSize: "0.65rem",
  background: "#0f172a",
  padding: "1px 6px",
  borderRadius: 8,
};

const emptyStyle: CSSProperties = {
  color: "#4a5f73",
  fontSize: "0.8rem",
  textAlign: "center",
  margin: "1rem 0",
};

const groupsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const groupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const groupHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const botTagStyle: CSSProperties = {
  color: "#f59e0b",
  fontSize: "0.55rem",
  fontWeight: 600,
  background: "#422006",
  padding: "0 3px",
  borderRadius: 3,
};

const cardsRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
};
