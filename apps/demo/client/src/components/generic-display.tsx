import type { GameStateData } from "../hooks/use-game-state.js";

// ============================================================
// Helpers
// ============================================================

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

// ============================================================
// Type detection helpers
// ============================================================

function isPlayingCard(v: unknown): v is { suit: string; rank: string } {
  return v != null && typeof v === "object" && "suit" in v && "rank" in v;
}

function isHiddenCard(v: unknown): v is { hidden: true } {
  return v != null && typeof v === "object" && "hidden" in v && (v as any).hidden === true;
}

function isTcgCard(v: unknown): v is { id: string; name: string; cost: number; attack: number } {
  return v != null && typeof v === "object" && "id" in v && "name" in v && "cost" in v && "attack" in v;
}

function isEntity(v: unknown): v is { card: { id: string; name: string }; currentHealth: number } {
  return v != null && typeof v === "object" && "card" in v && "currentHealth" in v;
}

function isDiscardEntry(v: unknown): v is { card: { id: string; name: string }; discardedBy: string } {
  return v != null && typeof v === "object" && "card" in v && "discardedBy" in v;
}

function isNamedItem(v: unknown): v is { id: string; name: string } {
  return v != null && typeof v === "object" && "id" in v && "name" in v;
}

function isTaskObject(v: unknown): v is { id: string; title: string } {
  return v != null && typeof v === "object" && "id" in v && "title" in v;
}

// ============================================================
// Card renderers
// ============================================================

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "\u2665", diamonds: "\u2666", clubs: "\u2663", spades: "\u2660",
};
const SUIT_COLORS: Record<string, string> = {
  hearts: "#ef4444", diamonds: "#ef4444", clubs: "#f1f5f9", spades: "#f1f5f9",
};

function PlayingCardChip({ card }: { card: { suit: string; rank: string } }) {
  const color = SUIT_COLORS[card.suit] ?? "#f1f5f9";
  return (
    <div style={s.playingCard}>
      <span style={{ color, fontWeight: 700, fontSize: "1rem" }}>{card.rank}</span>
      <span style={{ color, fontSize: "0.9rem" }}>{SUIT_SYMBOLS[card.suit] ?? card.suit}</span>
    </div>
  );
}

function HiddenCardChip() {
  return (
    <div style={s.hiddenCard}>
      <span style={{ fontSize: "1.2rem" }}>?</span>
    </div>
  );
}

// ============================================================
// SmartValue — auto-detect and render a value
// ============================================================

function SmartValue({ label, value, compact }: { label: string; value: unknown; compact?: boolean }) {
  // 1. null / undefined
  if (value == null) {
    return (
      <div style={s.field}>
        <span style={s.fieldLabel}>{formatLabel(label)}</span>
        <span style={s.dash}>—</span>
      </div>
    );
  }

  // 2. number
  if (typeof value === "number") {
    return (
      <div style={compact ? s.fieldInline : s.field}>
        <span style={s.fieldLabel}>{formatLabel(label)}</span>
        <span style={s.numberBadge}>{value}</span>
      </div>
    );
  }

  // 3. string
  if (typeof value === "string") {
    return (
      <div style={compact ? s.fieldInline : s.field}>
        <span style={s.fieldLabel}>{formatLabel(label)}</span>
        <span style={s.textVal}>{value}</span>
      </div>
    );
  }

  // 4. boolean
  if (typeof value === "boolean") {
    return (
      <div style={compact ? s.fieldInline : s.field}>
        <span style={s.fieldLabel}>{formatLabel(label)}</span>
        <span style={{ color: value ? "#22c55e" : "#ef4444" }}>{value ? "✓" : "✗"}</span>
      </div>
    );
  }

  // Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div style={s.field}>
          <span style={s.fieldLabel}>{formatLabel(label)}</span>
          <span style={s.dash}>—</span>
        </div>
      );
    }

    const first = value[0];

    // 5. Playing cards array
    if (isPlayingCard(first)) {
      if (compact) {
        return (
          <div style={s.fieldInline}>
            <span style={s.fieldLabel}>{formatLabel(label)}</span>
            <span style={s.countBadge}>{value.length} cards</span>
          </div>
        );
      }
      return (
        <div style={s.field}>
          <span style={s.fieldLabel}>{formatLabel(label)}</span>
          <div style={s.cardRow}>
            {value.map((c: any, i: number) => <PlayingCardChip key={i} card={c} />)}
          </div>
        </div>
      );
    }

    // 6. Hidden cards array
    if (isHiddenCard(first)) {
      if (compact) {
        return (
          <div style={s.fieldInline}>
            <span style={s.fieldLabel}>{formatLabel(label)}</span>
            <span style={s.countBadge}>{value.length} hidden</span>
          </div>
        );
      }
      return (
        <div style={s.field}>
          <span style={s.fieldLabel}>{formatLabel(label)}</span>
          <div style={s.cardRow}>
            {value.map((_: any, i: number) => <HiddenCardChip key={i} />)}
          </div>
        </div>
      );
    }

    // 7. TCG cards
    if (isTcgCard(first)) {
      if (compact) {
        return (
          <div style={s.fieldInline}>
            <span style={s.fieldLabel}>{formatLabel(label)}</span>
            <span style={s.countBadge}>{value.length} cards</span>
          </div>
        );
      }
      return (
        <div style={s.field}>
          <span style={s.fieldLabel}>{formatLabel(label)}</span>
          <div style={s.cardRow}>
            {value.map((c: any) => (
              <div key={c.id} style={s.tcgCard}>
                <div style={s.tcgName}>{c.name}</div>
                <div style={s.tcgStats}>
                  <span style={s.tcgCost}>{c.cost}</span>
                  <span style={s.tcgAtk}>{c.attack}</span>
                  <span style={s.tcgHp}>{c.health}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 8. Entities (TCG board)
    if (isEntity(first)) {
      if (compact) {
        return (
          <div style={s.fieldInline}>
            <span style={s.fieldLabel}>{formatLabel(label)}</span>
            <span style={s.countBadge}>{value.length} entities</span>
          </div>
        );
      }
      return (
        <div style={s.field}>
          <span style={s.fieldLabel}>{formatLabel(label)}</span>
          <div style={s.cardRow}>
            {value.map((e: any) => (
              <div key={e.card.id} style={s.entityCard}>
                <div style={s.tcgName}>{e.card.name}</div>
                <div style={s.tcgStats}>
                  <span style={s.tcgAtk}>{e.card.attack}</span>
                  <span style={s.tcgHp}>{e.currentHealth}</span>
                </div>
                {e.hasAttacked && <span style={s.entityTag}>Attacked</span>}
                {e.summoningSickness && <span style={s.entityTag}>Sleeping</span>}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 9. Discard pool entries
    if (isDiscardEntry(first)) {
      if (compact) {
        return (
          <div style={s.fieldInline}>
            <span style={s.fieldLabel}>{formatLabel(label)}</span>
            <span style={s.countBadge}>{value.length} cards</span>
          </div>
        );
      }
      return (
        <div style={s.field}>
          <span style={s.fieldLabel}>{formatLabel(label)}</span>
          <div style={s.tagRow}>
            {value.map((e: any, i: number) => (
              <span key={i} style={s.discardTag}>
                {e.card.name} <span style={s.discardFrom}>({e.discardedBy})</span>
              </span>
            ))}
          </div>
        </div>
      );
    }

    // 10. Named items (Values Card hand)
    if (isNamedItem(first)) {
      if (compact) {
        return (
          <div style={s.fieldInline}>
            <span style={s.fieldLabel}>{formatLabel(label)}</span>
            <span style={s.countBadge}>{value.length} items</span>
          </div>
        );
      }
      return (
        <div style={s.field}>
          <span style={s.fieldLabel}>{formatLabel(label)}</span>
          <div style={s.tagRow}>
            {value.map((item: any) => (
              <span key={item.id} style={s.namedTag}>{item.name}</span>
            ))}
          </div>
        </div>
      );
    }

    // 11. String array (Planning Poker deck)
    if (typeof first === "string") {
      if (compact) {
        return (
          <div style={s.fieldInline}>
            <span style={s.fieldLabel}>{formatLabel(label)}</span>
            <span style={s.countBadge}>{value.length}</span>
          </div>
        );
      }
      return (
        <div style={s.field}>
          <span style={s.fieldLabel}>{formatLabel(label)}</span>
          <div style={s.tagRow}>
            {value.map((v: string, i: number) => (
              <span key={i} style={s.stringTag}>{v}</span>
            ))}
          </div>
        </div>
      );
    }

    // Array fallback
    return (
      <div style={s.field}>
        <span style={s.fieldLabel}>{formatLabel(label)}</span>
        <pre style={s.jsonFallback}>{JSON.stringify(value, null, 2)}</pre>
      </div>
    );
  }

  // 12. Task object
  if (isTaskObject(value)) {
    return (
      <div style={s.field}>
        <span style={s.fieldLabel}>{formatLabel(label)}</span>
        <span style={s.taskDisplay}>{(value as any).title}</span>
      </div>
    );
  }

  // 13. Generic object fallback
  if (typeof value === "object") {
    return (
      <div style={s.field}>
        <span style={s.fieldLabel}>{formatLabel(label)}</span>
        <pre style={s.jsonFallback}>{JSON.stringify(value, null, 2)}</pre>
      </div>
    );
  }

  return null;
}

// ============================================================
// Section wrapper
// ============================================================

function Section({ title, highlight, children }: { title: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ ...s.section, borderColor: highlight ? "#3b82f6" : "#334155" }}>
      <div style={s.sectionTitle}>{title}</div>
      <div style={s.sectionBody}>{children}</div>
    </div>
  );
}

// ============================================================
// GenericDisplay — main export
// ============================================================

interface GenericDisplayProps {
  playerView: any;
  playerId: string;
  engineState: GameStateData["engineState"];
}

export function GenericDisplay({ playerView, playerId }: GenericDisplayProps) {
  if (!playerView) return null;

  const { players, playerOrder, ...sharedFields } = playerView;
  const myState = players?.[playerId] ?? {};
  const others = (playerOrder ?? []).filter((pid: string) => pid !== playerId);

  return (
    <div style={s.container}>
      {/* Game Board — shared fields */}
      <Section title="Game Board">
        {Object.keys(sharedFields).length > 0 ? (
          Object.entries(sharedFields).map(([k, v]) => (
            <SmartValue key={k} label={k} value={v} />
          ))
        ) : (
          <span style={s.dash}>—</span>
        )}
      </Section>

      {/* Your Hand — my state */}
      <Section title="Your Hand" highlight>
        {Object.keys(myState).length > 0 ? (
          Object.entries(myState).map(([k, v]) => (
            <SmartValue key={k} label={k} value={v} />
          ))
        ) : (
          <span style={s.dash}>—</span>
        )}
      </Section>

      {/* Other Players */}
      {others.length > 0 && (
        <Section title="Other Players">
          <div style={s.playersGrid}>
            {others.map((pid: string) => {
              const other = players?.[pid];
              if (!other) return null;
              const isBot = pid.startsWith("bot:");
              const displayName = isBot ? pid.slice(4) : pid;
              return (
                <div key={pid} style={s.otherPlayer}>
                  <div style={s.otherName}>
                    {displayName}
                    {isBot && <span style={s.botBadge}>Bot</span>}
                  </div>
                  {Object.entries(other).map(([k, v]) => (
                    <SmartValue key={k} label={k} value={v} compact />
                  ))}
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const s: Record<string, React.CSSProperties> = {
  container: {
    display: "flex", flexDirection: "column", gap: "0.8rem",
  },
  section: {
    background: "#1e293b", borderRadius: 10, border: "1px solid #334155",
    overflow: "hidden",
  },
  sectionTitle: {
    color: "#60a5fa", fontSize: "0.78rem", fontWeight: 600,
    textTransform: "uppercase" as const, letterSpacing: 1.2,
    padding: "0.6rem 1rem", borderBottom: "1px solid #334155",
    background: "#0f172a",
  },
  sectionBody: {
    padding: "0.8rem 1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem 1.2rem",
  },
  // Fields
  field: {
    display: "flex", flexDirection: "column", gap: "0.2rem",
  },
  fieldInline: {
    display: "flex", alignItems: "center", gap: "0.4rem",
  },
  fieldLabel: {
    color: "#64748b", fontSize: "0.72rem", fontWeight: 500,
    textTransform: "uppercase" as const, letterSpacing: 0.5,
  },
  dash: { color: "#475569", fontSize: "0.85rem" },
  numberBadge: {
    color: "#f59e0b", fontWeight: 700, fontSize: "0.95rem",
    fontFamily: "monospace",
  },
  textVal: { color: "#e2e8f0", fontSize: "0.9rem" },
  countBadge: {
    color: "#94a3b8", fontSize: "0.75rem", background: "#0f172a",
    padding: "0.1rem 0.4rem", borderRadius: 6,
  },
  // Cards
  cardRow: { display: "flex", gap: "0.4rem", flexWrap: "wrap" },
  playingCard: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    width: 48, height: 68, background: "#1a1a2e", borderRadius: 6,
    border: "1px solid #475569",
  },
  hiddenCard: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 48, height: 68, background: "#1e3a5f", borderRadius: 6,
    border: "1px solid #3b82f6", color: "#60a5fa",
  },
  // TCG
  tcgCard: {
    display: "flex", flexDirection: "column", alignItems: "center",
    background: "#0f172a", borderRadius: 6, border: "1px solid #475569",
    padding: "0.4rem 0.6rem", minWidth: 70, gap: "0.2rem",
  },
  tcgName: { color: "#e2e8f0", fontSize: "0.78rem", fontWeight: 600, textAlign: "center" as const },
  tcgStats: { display: "flex", gap: "0.4rem", fontSize: "0.72rem", fontFamily: "monospace" },
  tcgCost: { color: "#818cf8" },
  tcgAtk: { color: "#f59e0b" },
  tcgHp: { color: "#22c55e" },
  // Entity
  entityCard: {
    display: "flex", flexDirection: "column", alignItems: "center",
    background: "#0f172a", borderRadius: 6, border: "1px solid #475569",
    padding: "0.4rem 0.6rem", minWidth: 80, gap: "0.2rem",
  },
  entityTag: {
    color: "#94a3b8", fontSize: "0.6rem", background: "#1e293b",
    padding: "0.1rem 0.3rem", borderRadius: 3,
  },
  // Tags
  tagRow: { display: "flex", gap: "0.3rem", flexWrap: "wrap" },
  stringTag: {
    color: "#e2e8f0", fontSize: "0.8rem", background: "#334155",
    padding: "0.2rem 0.5rem", borderRadius: 4,
  },
  namedTag: {
    color: "#c4b5fd", fontSize: "0.8rem", background: "#1e1b4b",
    padding: "0.2rem 0.6rem", borderRadius: 4, border: "1px solid #4c1d95",
  },
  discardTag: {
    color: "#fca5a5", fontSize: "0.8rem", background: "#450a0a",
    padding: "0.2rem 0.5rem", borderRadius: 4,
  },
  discardFrom: { color: "#7f1d1d", fontSize: "0.7rem" },
  // Task
  taskDisplay: {
    color: "#e2e8f0", fontSize: "0.95rem", fontWeight: 600,
    background: "#0f172a", padding: "0.4rem 0.7rem", borderRadius: 6,
    border: "1px solid #334155",
  },
  // Other players
  playersGrid: { display: "flex", gap: "0.6rem", flexWrap: "wrap" },
  otherPlayer: {
    display: "flex", flexDirection: "column", gap: "0.3rem",
    background: "#0f172a", borderRadius: 8, padding: "0.7rem 0.8rem",
    border: "1px solid #334155", minWidth: 120, flex: "1 1 140px", maxWidth: 220,
  },
  otherName: {
    color: "#cbd5e1", fontSize: "0.82rem", fontWeight: 600,
    display: "flex", gap: "0.3rem", alignItems: "center",
    marginBottom: "0.2rem",
  },
  botBadge: {
    color: "#f59e0b", fontSize: "0.6rem", fontWeight: 600,
    background: "#422006", padding: "0.1rem 0.3rem", borderRadius: 3,
  },
  // Fallback
  jsonFallback: {
    fontSize: "0.72rem", color: "#94a3b8", background: "#0f172a",
    padding: "0.4rem 0.6rem", borderRadius: 4, overflow: "auto",
    maxHeight: 120, margin: 0,
  },
};
