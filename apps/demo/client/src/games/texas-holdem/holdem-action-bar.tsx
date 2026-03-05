import { useState, useCallback } from "react";
import type { CSSProperties } from "react";

interface ActionBarProps {
  playerView: any;
  playerId: string;
  dispatch: (action: string, payload?: unknown) => void;
}

export function HoldemActionBar({ playerView, playerId, dispatch }: ActionBarProps) {
  const pv = playerView;
  const player = pv.players?.[playerId];
  const stack = player?.stack ?? 0;
  const currentBet = player?.currentBet ?? 0;
  const highestBet = pv.currentHighestBet ?? 0;
  const bigBlind = pv.bigBlind ?? 2;

  const callAmount = Math.min(highestBet - currentBet, stack);
  const canCheck = callAmount === 0;
  const minRaise = highestBet + bigBlind;
  const [raiseAmount, setRaiseAmount] = useState(minRaise);

  // Sync slider min when minRaise changes
  const effectiveRaise = Math.max(raiseAmount, minRaise);
  const pot = pv.pot ?? 0;

  const handleRaise = useCallback(() => {
    dispatch("raise", { amount: effectiveRaise });
  }, [dispatch, effectiveRaise]);

  const presets = [
    { label: "Min", value: minRaise },
    { label: "1/2 Pot", value: Math.max(minRaise, Math.floor(pot / 2 + highestBet)) },
    { label: "Pot", value: Math.max(minRaise, pot + highestBet) },
  ];

  return (
    <div style={containerStyle}>
      {/* Fold */}
      <button style={foldBtnStyle} onClick={() => dispatch("fold")}>
        Fold
      </button>

      {/* Check / Call */}
      {canCheck ? (
        <button style={checkBtnStyle} onClick={() => dispatch("check")}>
          Check
        </button>
      ) : (
        <button style={callBtnStyle} onClick={() => dispatch("call")}>
          Call ${callAmount}
        </button>
      )}

      {/* Raise section */}
      {stack > callAmount && (
        <div style={raiseSectionStyle}>
          <div style={presetRowStyle}>
            {presets.map((p) => (
              <button
                key={p.label}
                style={{
                  ...presetBtnStyle,
                  background: effectiveRaise === p.value ? "#2dd4bf" : "#152029",
                  color: effectiveRaise === p.value ? "#0f1923" : "#e2e8f0",
                }}
                onClick={() => setRaiseAmount(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <input
              type="range"
              min={minRaise}
              max={stack + currentBet}
              step={bigBlind}
              value={effectiveRaise}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              style={{ flex: 1, accentColor: "#2dd4bf" }}
            />
            <span style={{ color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 600, minWidth: 50, textAlign: "right" }}>
              ${effectiveRaise}
            </span>
          </div>
          <button style={raiseBtnStyle} onClick={handleRaise}>
            Raise
          </button>
        </div>
      )}

      {/* All-In */}
      <button style={allInBtnStyle} onClick={() => dispatch("allIn")}>
        All-In ${stack}
      </button>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "0.8rem 1rem",
  background: "#1a2332",
  borderRadius: 16,
  border: "1px solid #253545",
  flexWrap: "wrap",
  boxShadow: "0 -4px 16px rgba(0,0,0,0.3)",
};

const btnBase: CSSProperties = {
  border: "none",
  borderRadius: 20,
  padding: "0.6rem 1rem",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#fff",
  whiteSpace: "nowrap",
};

const foldBtnStyle: CSSProperties = {
  ...btnBase,
  background: "#dc2626",
};

const checkBtnStyle: CSSProperties = {
  ...btnBase,
  background: "#22c55e",
};

const callBtnStyle: CSSProperties = {
  ...btnBase,
  background: "#22c55e",
};

const raiseBtnStyle: CSSProperties = {
  ...btnBase,
  background: "#2dd4bf",
  color: "#0f1923",
};

const allInBtnStyle: CSSProperties = {
  ...btnBase,
  background: "linear-gradient(135deg, #dc2626, #ef4444)",
  border: "1px solid #ef4444",
};

const raiseSectionStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flex: 1,
  minWidth: 200,
};

const presetRowStyle: CSSProperties = {
  display: "flex",
  gap: 4,
};

const presetBtnStyle: CSSProperties = {
  border: "1px solid #253545",
  borderRadius: 12,
  padding: "0.3rem 0.5rem",
  cursor: "pointer",
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "#e2e8f0",
};
