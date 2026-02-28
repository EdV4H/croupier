interface PlayerHandProps {
  cards: any[];
  onSelect?: (cardId: string) => void;
  selectedId?: string | null;
}

export function PlayerHand({ cards, onSelect, selectedId }: PlayerHandProps) {
  return (
    <div style={styles.hand}>
      {cards.map((card, i) => {
        const isHidden = card.hidden;
        const id = card.id ?? `hidden_${i}`;
        const isSelected = selectedId === id;

        return (
          <div
            key={id}
            style={{
              ...styles.card,
              ...(isHidden ? styles.hiddenCard : {}),
              ...(isSelected ? styles.selectedCard : {}),
              ...(onSelect && !isHidden ? styles.clickable : {}),
            }}
            onClick={() => onSelect && !isHidden && onSelect(id)}
          >
            {isHidden ? (
              <span style={styles.hiddenText}>?</span>
            ) : (
              <>
                <span style={styles.cardName}>
                  {card.name ?? card.suit?.[0]?.toUpperCase()}
                </span>
                {card.rank && (
                  <span style={styles.cardRank}>
                    {rankToString(card.rank)}
                  </span>
                )}
                {card.cost !== undefined && (
                  <span style={styles.cardCost}>{card.cost}</span>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function rankToString(rank: number): string {
  switch (rank) {
    case 14: return "A";
    case 13: return "K";
    case 12: return "Q";
    case 11: return "J";
    default: return String(rank);
  }
}

const styles: Record<string, React.CSSProperties> = {
  hand: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  card: {
    width: 60, height: 84, borderRadius: 8,
    background: "#f8fafc", color: "#0f172a", display: "flex",
    flexDirection: "column", alignItems: "center", justifyContent: "center",
    fontSize: "0.75rem", fontWeight: 600, border: "2px solid #cbd5e1",
    position: "relative",
  },
  hiddenCard: { background: "#334155", color: "#64748b", border: "2px solid #475569" },
  selectedCard: { border: "2px solid #3b82f6", boxShadow: "0 0 8px rgba(59,130,246,0.5)" },
  clickable: { cursor: "pointer" },
  hiddenText: { fontSize: "1.5rem", color: "#64748b" },
  cardName: { fontSize: "0.7rem", textAlign: "center" },
  cardRank: { fontSize: "1.1rem", fontWeight: 700 },
  cardCost: {
    position: "absolute", top: 2, left: 4, fontSize: "0.65rem",
    background: "#3b82f6", color: "#fff", borderRadius: "50%",
    width: 16, height: 16, display: "flex", alignItems: "center",
    justifyContent: "center",
  },
};
