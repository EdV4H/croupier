import type { CSSProperties } from "react";
import { TrustCard } from "./trust-card.js";

interface ActionBarProps {
  stage: string;
  playerId: string;
  playerView: any;
  dispatch: (action: string, payload?: unknown) => void;
}

export function ActionBar({ stage, playerId, playerView, dispatch }: ActionBarProps) {
  const pv = playerView;
  const me = pv.players?.[playerId];
  const hand = me?.hand ?? [];

  // selectCard: handled by HandDock on the table
  if (stage === "selectCard") {
    return (
      <div style={containerStyle}>
        <div style={labelStyle}>テーブルの手札からカードを選んでプレイ</div>
      </div>
    );
  }

  // selectTarget: handled by clicking player seats on the table
  if (stage === "selectTarget") {
    return (
      <div style={containerStyle}>
        <div style={labelStyle}>
          テーブル上の対象プレイヤーをクリック
          {pv.selectedCard && (
            <span style={{ color: "#e2e8f0", marginLeft: 8 }}>
              — {pv.selectedCard.name}
            </span>
          )}
        </div>
      </div>
    );
  }

  // resolveCard: handled on the table
  if (stage === "resolveCard") {
    return (
      <div style={containerStyle}>
        <div style={labelStyle}>テーブル中央でカードを確定</div>
      </div>
    );
  }

  // drawCard: handled by clicking the deck on the table
  if (stage === "drawCard") {
    return (
      <div style={containerStyle}>
        <div style={labelStyle}>テーブル中央のデッキをクリックしてドロー</div>
      </div>
    );
  }

  // withdrawalForced: handled on the table
  if (stage === "withdrawalForced") {
    const requiresTarget = pv.drawnCard?.requiresTarget;
    return (
      <div style={containerStyle}>
        <div style={{ ...labelStyle, color: "#f59e0b" }}>
          {requiresTarget
            ? "テーブル上の対象プレイヤーをクリック"
            : "テーブル中央で危機を受け入れる"}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ ...labelStyle, color: "#64748b" }}>待機中...</div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  background: "#1a2332",
  borderRadius: 14,
  padding: "14px 18px",
  border: "1px solid #253545",
};

const labelStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.8rem",
  fontWeight: 500,
};

const cardsRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const targetsRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const targetBtnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  padding: "10px 18px",
  background: "rgba(239,68,68,0.1)",
  border: "2px solid rgba(239,68,68,0.3)",
  borderRadius: 10,
  color: "#e2e8f0",
  cursor: "pointer",
  fontSize: "0.85rem",
  transition: "all 0.15s ease",
};

const confirmBtnStyle: CSSProperties = {
  padding: "10px 24px",
  background: "#22c55e",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
  alignSelf: "flex-start",
  transition: "all 0.15s ease",
};

const drawBtnStyle: CSSProperties = {
  padding: "10px 24px",
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
  alignSelf: "flex-start",
  transition: "all 0.15s ease",
};

const crisisCardStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
};
