import { useState } from "react";
import type { CSSProperties } from "react";
import type { GameStateData } from "../../hooks/use-game-state.js";
import { EventLog } from "../../components/game-board.js";
import { PlayerSeat } from "./player-seat.js";
import { HandDock } from "./hand-dock.js";
import { PlayingCard, type CardData } from "./playing-card.js";

interface DaifugoRichUIProps {
  gameState: GameStateData;
  dispatch: (action: string, payload?: unknown) => void;
  lastError: string | null;
  onLeave?: () => void;
}

/** Seat positions for 3–6 players around a table. Self is always index 0 (bottom). */
const SEAT_POSITIONS: Record<number, { top: string; left: string }[]> = {
  3: [
    { top: "75%", left: "50%" },
    { top: "25%", left: "20%" },
    { top: "25%", left: "80%" },
  ],
  4: [
    { top: "75%", left: "50%" },
    { top: "50%", left: "8%" },
    { top: "15%", left: "50%" },
    { top: "50%", left: "92%" },
  ],
  5: [
    { top: "75%", left: "50%" },
    { top: "55%", left: "8%" },
    { top: "18%", left: "25%" },
    { top: "18%", left: "75%" },
    { top: "55%", left: "92%" },
  ],
  6: [
    { top: "75%", left: "50%" },
    { top: "55%", left: "6%" },
    { top: "18%", left: "20%" },
    { top: "18%", left: "50%" },
    { top: "18%", left: "80%" },
    { top: "55%", left: "94%" },
  ],
};

function rotateToSelf(order: string[], selfId: string): string[] {
  const idx = order.indexOf(selfId);
  if (idx <= 0) return order;
  return [...order.slice(idx), ...order.slice(0, idx)];
}

export function DaifugoRichUI({ gameState, dispatch, lastError, onLeave }: DaifugoRichUIProps) {
  const { engineState, playerView: pv, playerId } = gameState;
  const phase = engineState.phase;
  const isMyTurn = Array.isArray(engineState.currentPlayers)
    ? engineState.currentPlayers.includes(playerId)
    : engineState.currentPlayers === playerId;

  const playerOrder: string[] = pv.playerOrder ?? [];
  const rotated = rotateToSelf(playerOrder, playerId);
  const positions = SEAT_POSITIONS[playerOrder.length] ?? SEAT_POSITIONS[4];
  const me = pv.players?.[playerId];
  const hand: CardData[] = me?.hand ?? [];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleCard = (cardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  // Current pile cards
  const pile = pv.currentPile;
  const pileCards: CardData[] = pile?.cards ?? [];

  // Determine action state
  const isPlayPhase = phase === "playRound";
  const isExchange = phase === "cardExchange" && pv.exchangePending;
  const isPendingSeven = pv.pendingAction?.type === "sevenPass" && pv.pendingAction?.playerId === playerId;
  const isPendingTen = pv.pendingAction?.type === "tenDiscard" && pv.pendingAction?.playerId === playerId;
  const canSelectCards = isMyTurn && (isPlayPhase || isExchange || isPendingSeven || isPendingTen);
  const isEmptyField = !pile;

  return (
    <div style={layoutStyle}>
      {/* Main area */}
      <div style={mainStyle}>
        {/* Status bar */}
        <div style={statusBarStyle}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 600 }}>
              大富豪
            </span>
            <span style={turnBadgeStyle}>
              Round {pv.roundNumber ?? 1} / {pv.maxRounds ?? 5}
            </span>
            {pv.isRevolution && (
              <span style={revolutionBadgeStyle}>革命</span>
            )}
            {pv.trickSuitLock && (
              <span style={suitLockBadgeStyle}>
                {SUIT_SYMBOLS[pv.trickSuitLock] ?? ""} 縛り
              </span>
            )}
            {pv.trickElevenBack && (
              <span style={elevenBackBadgeStyle}>11バック</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isMyTurn && !engineState.finished && (
              <span style={myTurnBadgeStyle}>Your Turn</span>
            )}
            <span style={{
              fontSize: "0.75rem",
              color: "#fff",
              padding: "0.2rem 0.6rem",
              borderRadius: 8,
              fontWeight: 600,
              background: engineState.finished ? "#6366f1" : "#2dd4bf",
            }}>
              {engineState.finished ? "Game Over" : PHASE_LABELS[phase] ?? phase}
            </span>
          </div>
        </div>

        {/* Error */}
        {lastError && <div style={errorStyle}>{lastError}</div>}

        {/* Game Over */}
        {engineState.finished && (
          <div style={resultStyle}>
            <span style={{ color: "#e2e8f0", fontSize: "1rem", fontWeight: 700 }}>Game Over</span>
            {engineState.result?.winner && (
              <span style={{ color: "#2dd4bf", fontSize: "0.9rem", fontWeight: 600 }}>
                Winner: {engineState.result.winner}
              </span>
            )}
            {engineState.result?.reason && (
              <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{engineState.result.reason}</span>
            )}
            {/* Final standings */}
            <div style={standingsStyle}>
              {playerOrder
                .map((pid) => ({ pid, score: pv.players?.[pid]?.score ?? 0, rank: pv.players?.[pid]?.rank }))
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <div key={p.pid} style={standingRowStyle}>
                    <span style={{ color: i === 0 ? "#f59e0b" : "#94a3b8", fontWeight: 600, fontSize: "0.8rem" }}>
                      #{i + 1}
                    </span>
                    <span style={{ color: "#e2e8f0", fontSize: "0.8rem", flex: 1 }}>
                      {p.pid}{p.pid === playerId ? " (You)" : ""}
                    </span>
                    <span style={{ color: "#2dd4bf", fontSize: "0.8rem", fontWeight: 700 }}>
                      {p.score} pt
                    </span>
                  </div>
                ))}
            </div>
            {onLeave && (
              <button style={lobbyBtnStyle} onClick={onLeave}>Back to Lobby</button>
            )}
          </div>
        )}

        {/* Revolution animation */}
        <style>{`
          @keyframes revolution-glow {
            0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.2), inset 0 0 20px rgba(245,158,11,0.03); }
            50% { box-shadow: 0 0 40px rgba(245,158,11,0.4), inset 0 0 40px rgba(245,158,11,0.06); }
          }
        `}</style>

        {/* Table */}
        <div style={tableOuterStyle}>
          <div style={{
            ...tableStyle,
            ...(pv.isRevolution ? {
              border: "3px solid rgba(245,158,11,0.5)",
              animation: "revolution-glow 2s ease-in-out infinite",
            } : {}),
          }}>
            {/* Center: current pile */}
            <div style={centerAreaStyle}>
              {pileCards.length > 0 ? (
                <div style={{ display: "flex", gap: 4 }}>
                  {pileCards.map((c: CardData) => (
                    <PlayingCard key={c.id} card={c} size="large" />
                  ))}
                </div>
              ) : (
                <div style={emptyPileStyle}>
                  <span style={{ color: "#4a5f73", fontSize: "0.8rem" }}>場は空</span>
                </div>
              )}
              {pile && (
                <span style={{ color: "#64748b", fontSize: "0.6rem", marginTop: 2 }}>
                  {pile.type === "single" ? "単体" : pile.type === "pair" ? "ペア" : pile.type === "triple" ? "トリプル" : pile.type === "quad" ? "クアッド" : pile.type === "sequence" ? `階段(${pile.sequenceLength})` : pile.type}
                </span>
              )}
              {!pile && pv.lastPlayedBy && (
                <span style={{ color: "#64748b", fontSize: "0.6rem" }}>
                  {pv.lastPlayedBy === playerId ? "あなた" : pv.lastPlayedBy} の新トリック
                </span>
              )}
            </div>

            {/* Player seats */}
            {rotated.map((pid, i) => {
              if (i >= positions.length) return null;
              const pos = positions[i];
              const p = pv.players?.[pid];
              if (!p) return null;

              const currentPid = playerOrder[pv.currentPlayerIndex ?? 0];

              return (
                <div
                  key={pid}
                  style={{
                    position: "absolute",
                    top: pos.top,
                    left: pos.left,
                    transform: "translate(-50%, -50%)",
                    zIndex: 2,
                  }}
                >
                  <PlayerSeat
                    name={pid}
                    isMe={pid === playerId}
                    isCurrentTurn={pid === currentPid && !engineState.finished}
                    handCount={p.handCount ?? p.hand?.length ?? 0}
                    rank={p.rank}
                    finishOrder={p.finishOrder}
                    score={p.score ?? 0}
                    passed={(pv.passedPlayers ?? []).includes(pid)}
                  />
                </div>
              );
            })}

            {/* Hand dock at bottom */}
            <HandDock
              hand={hand}
              selectedIds={selectedIds}
              canPlay={canSelectCards}
              onToggle={toggleCard}
            />
          </div>
        </div>

        {/* Action bar */}
        {!engineState.finished && isMyTurn && (
          <div style={actionBarStyle}>
            {isExchange && (
              <>
                <span style={actionLabelStyle}>カード交換 — 渡すカードを選択</span>
                <button
                  style={{ ...actionBtnStyle, background: "#3b82f6" }}
                  onClick={() => { dispatch("giveCards", { cardIds: [...selectedIds] }); clearSelection(); }}
                  disabled={selectedIds.size === 0}
                >
                  渡す ({selectedIds.size}枚)
                </button>
              </>
            )}
            {isPendingSeven && (
              <>
                <span style={actionLabelStyle}>7渡し — {pv.pendingAction.count}枚選んで渡す</span>
                <button
                  style={{ ...actionBtnStyle, background: "#f59e0b" }}
                  onClick={() => { dispatch("selectCardsToPass", { cardIds: [...selectedIds] }); clearSelection(); }}
                  disabled={selectedIds.size !== pv.pendingAction.count}
                >
                  渡す ({selectedIds.size}/{pv.pendingAction.count})
                </button>
              </>
            )}
            {isPendingTen && (
              <>
                <span style={actionLabelStyle}>10捨て — {pv.pendingAction.count}枚選んで捨てる</span>
                <button
                  style={{ ...actionBtnStyle, background: "#ef4444" }}
                  onClick={() => { dispatch("selectCardsToDiscard", { cardIds: [...selectedIds] }); clearSelection(); }}
                  disabled={selectedIds.size !== pv.pendingAction.count}
                >
                  捨てる ({selectedIds.size}/{pv.pendingAction.count})
                </button>
              </>
            )}
            {isPlayPhase && !isPendingSeven && !isPendingTen && (
              <>
                <span style={actionLabelStyle}>
                  {isEmptyField ? "場は空 — カードを出してください" : "場より強いカードを出すかパス"}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={{ ...actionBtnStyle, background: "#22c55e" }}
                    onClick={() => { dispatch("playCards", { cardIds: [...selectedIds] }); clearSelection(); }}
                    disabled={selectedIds.size === 0}
                  >
                    出す ({selectedIds.size}枚)
                  </button>
                  {!isEmptyField && (
                    <button
                      style={{ ...actionBtnStyle, background: "#64748b" }}
                      onClick={() => { dispatch("pass"); clearSelection(); }}
                    >
                      パス
                    </button>
                  )}
                </div>
              </>
            )}
            {selectedIds.size > 0 && (
              <button
                style={{ ...actionBtnStyle, background: "#334155", fontSize: "0.7rem" }}
                onClick={clearSelection}
              >
                選択解除
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div style={sidebarStyle}>
        {/* Rules summary */}
        <div style={rulesSummaryStyle}>
          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>
            Active Rules
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
            {pv.rules && Object.entries(pv.rules)
              .filter(([, v]) => v)
              .map(([k]) => (
                <span key={k} style={ruleChipStyle}>
                  {RULE_LABELS[k] ?? k}
                </span>
              ))
            }
          </div>
        </div>
        <EventLog entries={gameState.actionLog ?? []} currentPlayerId={playerId} />
      </div>
    </div>
  );
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: "\u2660", hearts: "\u2665", diamonds: "\u2666", clubs: "\u2663",
};

const PHASE_LABELS: Record<string, string> = {
  playRound: "プレイ",
  cardExchange: "カード交換",
  roundEnd: "ラウンド終了",
};

const RULE_LABELS: Record<string, string> = {
  revolution: "革命",
  eightCut: "8切り",
  capitalFall: "都落ち",
  sequence: "階段",
  suitLock: "縛り",
  elevenBack: "11バック",
  spadeThreeReturn: "スペ3",
  sevenPass: "7渡し",
  tenDiscard: "10捨て",
  fiveSkip: "5スキップ",
  nineReverse: "9リバース",
  restrictedFinish: "禁止上がり",
};

// ============================================================
// Styles
// ============================================================

const layoutStyle: CSSProperties = {
  display: "flex", gap: "0.8rem", padding: "0.8rem",
  flex: 1, minHeight: 0, overflow: "hidden",
};

const mainStyle: CSSProperties = {
  display: "flex", flexDirection: "column", gap: "0.6rem",
  flex: 1, minWidth: 0, overflowY: "auto",
};

const sidebarStyle: CSSProperties = {
  width: 300, flexShrink: 0,
  display: "flex", flexDirection: "column", overflow: "hidden", gap: "0.5rem",
};

const statusBarStyle: CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "#1a2332", borderRadius: 12, padding: "0.8rem 1rem",
  border: "1px solid #253545",
};

const turnBadgeStyle: CSSProperties = {
  fontSize: "0.7rem", fontWeight: 600, padding: "0.15rem 0.5rem",
  borderRadius: 8, color: "#94a3b8", background: "rgba(148,163,184,0.1)",
};

const revolutionBadgeStyle: CSSProperties = {
  fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem",
  borderRadius: 8, color: "#f59e0b",
  background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)",
};

const suitLockBadgeStyle: CSSProperties = {
  fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem",
  borderRadius: 8, color: "#a855f7",
  background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)",
};

const elevenBackBadgeStyle: CSSProperties = {
  fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem",
  borderRadius: 8, color: "#ef4444",
  background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
};

const myTurnBadgeStyle: CSSProperties = {
  fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem",
  borderRadius: 8, color: "#22c55e",
  background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
};

const errorStyle: CSSProperties = {
  background: "#2d0a0a", color: "#fca5a5",
  padding: "0.6rem 1rem", borderRadius: 8, fontSize: "0.85rem",
};

const resultStyle: CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8rem",
  background: "#1a2332", borderRadius: 12, padding: "1.2rem 1.5rem",
  border: "1px solid #253545",
};

const standingsStyle: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 4,
  width: "100%", maxWidth: 300, marginTop: 8,
};

const standingRowStyle: CSSProperties = {
  display: "flex", gap: 10, alignItems: "center",
  padding: "4px 10px", borderRadius: 6, background: "rgba(37,53,69,0.5)",
};

const lobbyBtnStyle: CSSProperties = {
  background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8,
  padding: "0.5rem 1rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600,
};

const tableOuterStyle: CSSProperties = {
  display: "flex", justifyContent: "center", padding: "0.5rem",
};

const tableStyle: CSSProperties = {
  position: "relative", width: "100%", maxWidth: 800,
  aspectRatio: "16 / 11",
  background: "linear-gradient(135deg, #1a2332, #1e293b)",
  borderRadius: 24,
  border: "3px solid #2a3f52",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.3)",
};

const centerAreaStyle: CSSProperties = {
  position: "absolute", top: "45%", left: "50%",
  transform: "translate(-50%, -50%)",
  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
  zIndex: 1,
};

const emptyPileStyle: CSSProperties = {
  width: 70, height: 90,
  border: "2px dashed #2a3f52", borderRadius: 10,
  display: "flex", alignItems: "center", justifyContent: "center",
};

const actionBarStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  background: "#1a2332", borderRadius: 12, padding: "0.8rem 1rem",
  border: "1px solid #253545", flexWrap: "wrap",
};

const actionLabelStyle: CSSProperties = {
  color: "#94a3b8", fontSize: "0.8rem", flex: 1, minWidth: 150,
};

const actionBtnStyle: CSSProperties = {
  color: "#fff", border: "none", borderRadius: 8,
  padding: "0.5rem 1rem", cursor: "pointer",
  fontSize: "0.8rem", fontWeight: 600,
};

const rulesSummaryStyle: CSSProperties = {
  background: "#1a2332", borderRadius: 8, padding: "0.6rem 0.8rem",
  border: "1px solid #253545", flexShrink: 0,
};

const ruleChipStyle: CSSProperties = {
  fontSize: "0.6rem", fontWeight: 600, color: "#94a3b8",
  padding: "1px 5px", borderRadius: 4,
  background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.15)",
};
