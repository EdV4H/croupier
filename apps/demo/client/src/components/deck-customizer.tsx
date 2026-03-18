import { useState } from "react";
import {
  VALUES_CARD_PRESETS,
  TRUST_BANK_PRESETS,
  TCG_PRESETS,
  ALL_VALUES_CARDS,
  ALL_TRUST_BANK_CARDS,
  ALL_TCG_CARDS,
  type ValuesCard,
  type TCGCard,
} from "../games/deck-presets.js";

interface DeckCustomizerProps {
  gameId: string;
  onSave: (gameOptions: Record<string, unknown>) => void;
  onClose: () => void;
}

export function DeckCustomizer({ gameId, onSave, onClose }: DeckCustomizerProps) {
  switch (gameId) {
    case "values-card":
      return <ValuesCardCustomizer onSave={onSave} onClose={onClose} />;
    case "trust-bank":
      return <TrustBankCustomizer onSave={onSave} onClose={onClose} />;
    case "digital-tcg":
      return <TCGCustomizer onSave={onSave} onClose={onClose} />;
    default:
      return (
        <div style={styles.overlay} onClick={onClose}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <p style={{ color: "#94a3b8" }}>This game does not support deck customization.</p>
            <button style={styles.button} onClick={onClose}>Close</button>
          </div>
        </div>
      );
  }
}

// ============================================================
// Values Card Customizer
// ============================================================

let valuesCardNextId = 0;

function ValuesCardCustomizer({ onSave, onClose }: { onSave: (o: Record<string, unknown>) => void; onClose: () => void }) {
  const [presetId, setPresetId] = useState("default");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(ALL_VALUES_CARDS.map((c) => c.id)));
  const [customCards, setCustomCards] = useState<ValuesCard[]>([]);
  const [newCardName, setNewCardName] = useState("");

  const applyPreset = (id: string) => {
    setPresetId(id);
    const preset = VALUES_CARD_PRESETS.find((p) => p.id === id);
    if (preset) {
      setSelectedIds(new Set(preset.cards.map((c) => c.id)));
    }
  };

  const toggleCard = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPresetId("custom");
  };

  const addCustomCard = () => {
    const name = newCardName.trim();
    if (!name) return;
    const id = `custom-${++valuesCardNextId}`;
    setCustomCards((prev) => [...prev, { id, name }]);
    setSelectedIds((prev) => new Set(prev).add(id));
    setNewCardName("");
    setPresetId("custom");
  };

  const removeCustomCard = (id: string) => {
    setCustomCards((prev) => prev.filter((c) => c.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSave = () => {
    const allCards = [...ALL_VALUES_CARDS, ...customCards];
    const cards = allCards.filter((c) => selectedIds.has(c.id));
    if (cards.length < 10) {
      alert("最低10枚のカードが必要です");
      return;
    }
    onSave({ cards });
  };

  const selectedCount = [...selectedIds].filter((id) =>
    ALL_VALUES_CARDS.some((c) => c.id === id) || customCards.some((c) => c.id === id)
  ).length;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>Values Card - Deck Customizer</h2>

        {/* Preset selector */}
        <div style={styles.row}>
          <label style={styles.label}>Preset:</label>
          <select style={styles.select} value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            {VALUES_CARD_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {presetId === "custom" && <option value="custom">Custom</option>}
          </select>
        </div>

        <p style={styles.hint}>Selected: {selectedCount} cards</p>

        {/* Card list */}
        <div style={styles.cardList}>
          {ALL_VALUES_CARDS.map((card) => (
            <label key={card.id} style={styles.cardItem}>
              <input
                type="checkbox"
                checked={selectedIds.has(card.id)}
                onChange={() => toggleCard(card.id)}
              />
              <span style={styles.cardName}>{card.name}</span>
            </label>
          ))}
          {customCards.map((card) => (
            <label key={card.id} style={styles.cardItem}>
              <input
                type="checkbox"
                checked={selectedIds.has(card.id)}
                onChange={() => toggleCard(card.id)}
              />
              <span style={{ ...styles.cardName, color: "#22d3ee" }}>{card.name}</span>
              <button style={styles.removeBtn} onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeCustomCard(card.id); }}>x</button>
            </label>
          ))}
        </div>

        {/* Add custom card */}
        <div style={styles.addRow}>
          <input
            style={styles.input}
            type="text"
            placeholder="カスタムカード名"
            value={newCardName}
            onChange={(e) => setNewCardName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addCustomCard()}
          />
          <button style={styles.smallBtn} onClick={addCustomCard}>Add</button>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button style={styles.button} onClick={handleSave}>Save</button>
          <button style={styles.resetBtn} onClick={() => applyPreset("default")}>Reset</button>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Trust Bank Customizer
// ============================================================

const TRUST_BANK_CATEGORIES: { key: string; label: string }[] = [
  { key: "trust", label: "Trust (信頼構築)" },
  { key: "crisis", label: "Crisis (信頼危機)" },
  { key: "attack", label: "Attack (攻撃)" },
  { key: "repair", label: "Repair (修復)" },
  { key: "relationship", label: "Relationship (関係)" },
];

function TrustBankCustomizer({ onSave, onClose }: { onSave: (o: Record<string, unknown>) => void; onClose: () => void }) {
  const [presetId, setPresetId] = useState("default");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(ALL_TRUST_BANK_CARDS.map((c) => c.id)));

  const applyPreset = (id: string) => {
    setPresetId(id);
    const preset = TRUST_BANK_PRESETS.find((p) => p.id === id);
    if (preset) {
      setSelectedIds(new Set(preset.cards.map((c) => c.id)));
    }
  };

  const toggleCard = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPresetId("custom");
  };

  const handleSave = () => {
    const cards = ALL_TRUST_BANK_CARDS.filter((c) => selectedIds.has(c.id));
    if (cards.length < 12) {
      alert("最低12枚のカードが必要です（3枚×4人分）");
      return;
    }
    onSave({ cards });
  };

  const selectedCount = [...selectedIds].filter((id) =>
    ALL_TRUST_BANK_CARDS.some((c) => c.id === id)
  ).length;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>Trust Bank - Deck Customizer</h2>

        <div style={styles.row}>
          <label style={styles.label}>Preset:</label>
          <select style={styles.select} value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            {TRUST_BANK_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {presetId === "custom" && <option value="custom">Custom</option>}
          </select>
        </div>

        <p style={styles.hint}>Selected: {selectedCount} cards</p>

        <div style={styles.cardList}>
          {TRUST_BANK_CATEGORIES.map((cat) => {
            const cards = ALL_TRUST_BANK_CARDS.filter((c) => c.category === cat.key);
            if (cards.length === 0) return null;
            return (
              <div key={cat.key}>
                <h4 style={styles.catHeader}>{cat.label}</h4>
                {cards.map((card) => (
                  <label key={card.id} style={styles.cardItem}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(card.id)}
                      onChange={() => toggleCard(card.id)}
                    />
                    <span style={styles.cardName}>{card.name}</span>
                    <span style={styles.cardDesc}>{card.description}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>

        <div style={styles.actions}>
          <button style={styles.button} onClick={handleSave}>Save</button>
          <button style={styles.resetBtn} onClick={() => applyPreset("default")}>Reset</button>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Digital TCG Customizer (Player 1 & Player 2 decks)
// ============================================================

let tcgNextId = 0;

function TCGCustomizer({ onSave, onClose }: { onSave: (o: Record<string, unknown>) => void; onClose: () => void }) {
  const [p1PresetId, setP1PresetId] = useState("default");
  const [p2PresetId, setP2PresetId] = useState("default");
  const [p1Cards, setP1Cards] = useState<TCGCard[]>([...ALL_TCG_CARDS]);
  const [p2Cards, setP2Cards] = useState<TCGCard[]>([...ALL_TCG_CARDS]);
  const [newCard, setNewCard] = useState({ name: "", cost: 1, attack: 1, health: 1 });

  const applyPreset = (player: 1 | 2, id: string) => {
    const preset = TCG_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    if (player === 1) {
      setP1PresetId(id);
      setP1Cards([...preset.cards]);
    } else {
      setP2PresetId(id);
      setP2Cards([...preset.cards]);
    }
  };

  const removeCard = (player: 1 | 2, index: number) => {
    if (player === 1) {
      setP1Cards((prev) => prev.filter((_, i) => i !== index));
      setP1PresetId("custom");
    } else {
      setP2Cards((prev) => prev.filter((_, i) => i !== index));
      setP2PresetId("custom");
    }
  };

  const addCardToDeck = (player: 1 | 2) => {
    const name = newCard.name.trim();
    if (!name) return;
    const card: TCGCard = {
      id: `custom-${++tcgNextId}`,
      name,
      cost: newCard.cost,
      attack: newCard.attack,
      health: newCard.health,
      type: "creature",
    };
    if (player === 1) {
      setP1Cards((prev) => [...prev, card]);
      setP1PresetId("custom");
    } else {
      setP2Cards((prev) => [...prev, card]);
      setP2PresetId("custom");
    }
  };

  const handleSave = () => {
    if (p1Cards.length < 5 || p2Cards.length < 5) {
      alert("Each deck needs at least 5 cards");
      return;
    }
    onSave({ deck1: p1Cards, deck2: p2Cards });
  };

  const renderDeck = (player: 1 | 2, presetId: string, cards: TCGCard[]) => (
    <div style={styles.deckColumn}>
      <h3 style={styles.deckTitle}>Player {player} Deck</h3>
      <div style={styles.row}>
        <label style={styles.label}>Preset:</label>
        <select
          style={styles.select}
          value={presetId}
          onChange={(e) => applyPreset(player, e.target.value)}
        >
          {TCG_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          {presetId === "custom" && <option value="custom">Custom</option>}
        </select>
      </div>
      <p style={styles.hint}>{cards.length} cards</p>
      <div style={styles.tcgCardList}>
        {cards.map((card, i) => (
          <div key={`${card.id}-${i}`} style={styles.tcgCardItem}>
            <span style={styles.tcgCardName}>{card.name}</span>
            <span style={styles.tcgStat}>Cost:{card.cost}</span>
            <span style={styles.tcgStat}>ATK:{card.attack}</span>
            <span style={styles.tcgStat}>HP:{card.health}</span>
            <button style={styles.removeBtn} onClick={(e) => { e.stopPropagation(); removeCard(player, i); }}>x</button>
          </div>
        ))}
      </div>
      <button style={styles.smallBtn} onClick={() => addCardToDeck(player)}>+ Add Card</button>
    </div>
  );

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>Digital TCG - Deck Customizer</h2>

        <div style={styles.tcgColumns}>
          {renderDeck(1, p1PresetId, p1Cards)}
          {renderDeck(2, p2PresetId, p2Cards)}
        </div>

        {/* New card form */}
        <div style={styles.addForm}>
          <input style={styles.input} type="text" placeholder="Name" value={newCard.name} onChange={(e) => setNewCard((p) => ({ ...p, name: e.target.value }))} />
          <label style={styles.labelSmall}>Cost:<input style={styles.numInput} type="number" min={0} max={10} value={newCard.cost} onChange={(e) => setNewCard((p) => ({ ...p, cost: Number(e.target.value) }))} /></label>
          <label style={styles.labelSmall}>ATK:<input style={styles.numInput} type="number" min={0} max={20} value={newCard.attack} onChange={(e) => setNewCard((p) => ({ ...p, attack: Number(e.target.value) }))} /></label>
          <label style={styles.labelSmall}>HP:<input style={styles.numInput} type="number" min={1} max={20} value={newCard.health} onChange={(e) => setNewCard((p) => ({ ...p, health: Number(e.target.value) }))} /></label>
        </div>

        <div style={styles.actions}>
          <button style={styles.button} onClick={handleSave}>Save</button>
          <button style={styles.resetBtn} onClick={() => { applyPreset(1, "default"); applyPreset(2, "default"); }}>Reset</button>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.6)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  modal: {
    background: "#1e293b", borderRadius: 16, padding: "2rem",
    border: "1px solid #334155", maxWidth: 560, width: "90vw",
    maxHeight: "85vh", overflow: "auto",
  },
  modalTitle: { color: "#f1f5f9", fontSize: "1.3rem", marginBottom: "1rem" },
  row: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" },
  label: { color: "#94a3b8", fontSize: "0.85rem", minWidth: 50 },
  labelSmall: { color: "#94a3b8", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4 },
  select: {
    background: "#0f172a", color: "#f1f5f9", border: "1px solid #334155",
    borderRadius: 6, padding: "0.4rem 0.6rem", fontSize: "0.85rem", flex: 1,
  },
  selectSmall: {
    background: "#0f172a", color: "#f1f5f9", border: "1px solid #334155",
    borderRadius: 6, padding: "0.3rem 0.4rem", fontSize: "0.8rem",
  },
  hint: { color: "#64748b", fontSize: "0.8rem", margin: "0.3rem 0" },
  cardList: {
    maxHeight: 300, overflowY: "auto", marginBottom: "0.8rem",
    background: "#0f172a", borderRadius: 8, padding: "0.5rem",
  },
  cardItem: {
    display: "flex", alignItems: "center", gap: "0.4rem",
    padding: "0.25rem 0.3rem", cursor: "pointer", fontSize: "0.85rem",
  },
  cardName: { color: "#e2e8f0", flex: "0 0 auto" },
  cardDesc: { color: "#64748b", fontSize: "0.75rem", flex: 1 },
  catHeader: { color: "#3b82f6", fontSize: "0.85rem", margin: "0.6rem 0 0.2rem", fontWeight: 600 },
  addRow: { display: "flex", gap: "0.4rem", marginBottom: "1rem" },
  addForm: { display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem", alignItems: "center" },
  input: {
    background: "#0f172a", color: "#f1f5f9", border: "1px solid #334155",
    borderRadius: 6, padding: "0.4rem 0.6rem", fontSize: "0.85rem", flex: 1, minWidth: 100,
  },
  numInput: {
    background: "#0f172a", color: "#f1f5f9", border: "1px solid #334155",
    borderRadius: 6, padding: "0.3rem 0.4rem", fontSize: "0.8rem", width: 50,
  },
  smallBtn: {
    background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6,
    padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 500, whiteSpace: "nowrap",
  },
  removeBtn: {
    background: "none", color: "#ef4444", border: "none", cursor: "pointer",
    fontSize: "0.8rem", padding: "0 4px", fontWeight: 700,
  },
  actions: { display: "flex", gap: "0.5rem", justifyContent: "flex-end" },
  button: {
    background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8,
    padding: "0.6rem 1.2rem", cursor: "pointer", fontSize: "0.9rem", fontWeight: 500,
  },
  resetBtn: {
    background: "#475569", color: "#fff", border: "none", borderRadius: 8,
    padding: "0.6rem 1rem", cursor: "pointer", fontSize: "0.9rem",
  },
  cancelBtn: {
    background: "transparent", color: "#94a3b8", border: "1px solid #334155",
    borderRadius: 8, padding: "0.6rem 1rem", cursor: "pointer", fontSize: "0.9rem",
  },
  // TCG specific
  tcgColumns: { display: "flex", gap: "1rem", marginBottom: "1rem" },
  deckColumn: { flex: 1 },
  deckTitle: { color: "#e2e8f0", fontSize: "1rem", marginBottom: "0.5rem" },
  tcgCardList: {
    maxHeight: 220, overflowY: "auto",
    background: "#0f172a", borderRadius: 8, padding: "0.4rem", marginBottom: "0.4rem",
  },
  tcgCardItem: {
    display: "flex", alignItems: "center", gap: "0.3rem",
    padding: "0.2rem 0.3rem", fontSize: "0.8rem",
  },
  tcgCardName: { color: "#e2e8f0", flex: 1 },
  tcgStat: { color: "#64748b", fontSize: "0.75rem" },
};
