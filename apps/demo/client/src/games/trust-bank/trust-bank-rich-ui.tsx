import type { CSSProperties } from "react";
import type { GameStateData } from "../../hooks/use-game-state.js";
import { EventLog } from "../../components/game-board.js";
import { PlayerSeat } from "./player-seat.js";
import { ActionBar } from "./action-bar.js";
import { MissionPanel } from "./mission-panel.js";
import { CardHistory } from "./card-history.js";
import { CardEffectOverlay } from "./card-effect-overlay.js";
import { HandDock } from "./hand-dock.js";

const CATEGORY_COLORS_MAP: Record<string, string> = {
  trust: "#22c55e",
  crisis: "#f59e0b",
  attack: "#ef4444",
  repair: "#3b82f6",
  relationship: "#a855f7",
};

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

interface TrustBankRichUIProps {
  gameState: GameStateData;
  dispatch: (action: string, payload?: unknown) => void;
  lastError: string | null;
  onLeave?: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  selectCard: "カード選択",
  selectTarget: "対象選択",
  resolveCard: "効果発動",
  drawCard: "ドロー",
  withdrawalForced: "危機発動",
};

/**
 * Seat positions for exactly 4 players around a rectangular table.
 * Self is always at the bottom.
 */
const SEAT_POSITIONS = [
  { top: "72%", left: "50%" },   // self (bottom, raised for hand dock)
  { top: "50%", left: "8%" },    // left
  { top: "15%", left: "50%" },   // top
  { top: "50%", left: "92%" },   // right
];

function rotateToSelf(order: string[], selfId: string): string[] {
  const idx = order.indexOf(selfId);
  if (idx <= 0) return order;
  return [...order.slice(idx), ...order.slice(0, idx)];
}

export function TrustBankRichUI({
  gameState,
  dispatch,
  lastError,
  onLeave,
}: TrustBankRichUIProps) {
  const { engineState, playerView: pv, playerId } = gameState;
  const stage = engineState.stage ?? "";
  const isMyTurn = Array.isArray(engineState.currentPlayers)
    ? engineState.currentPlayers.includes(playerId)
    : engineState.currentPlayers === playerId;

  const playerOrder: string[] = pv.playerOrder ?? [];
  const rotated = rotateToSelf(playerOrder, playerId);
  const currentPlayer = playerOrder[pv.currentPlayerIndex ?? 0];
  const me = pv.players?.[playerId];

  // Deck info
  const deckCount = pv.deckCount ?? 0;
  const turnCount = pv.turnCount ?? 0;

  // My mission
  const myMission = me?.mission && typeof me.mission === "object" ? me.mission : null;
  const missionCompleted = !myMission && pv.openedMissions?.[playerId];

  return (
    <div style={layoutStyle}>
      {/* Main area */}
      <div style={mainStyle}>
        {/* Status bar */}
        <div style={statusBarStyle}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 600 }}>
              Trust Bank
            </span>
            <span style={turnBadgeStyle}>
              Turn {turnCount + 1}
            </span>
            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
              Deck: {deckCount}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isMyTurn && (
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
              {engineState.finished ? "Game Over" : STAGE_LABELS[stage] ?? stage}
            </span>
          </div>
        </div>

        {/* Error */}
        {lastError && (
          <div style={errorStyle}>{lastError}</div>
        )}

        {/* Game Over */}
        {engineState.finished && (
          <div style={resultStyle}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#e2e8f0", fontSize: "1rem", fontWeight: 700 }}>
                Game Over
              </span>
              {engineState.result && (
                <span style={{ color: "#2dd4bf", fontSize: "0.9rem", fontWeight: 600 }}>
                  {engineState.result.winner
                    ? `Winner: ${Array.isArray(engineState.result.winner) ? engineState.result.winner.join(", ") : engineState.result.winner}`
                    : "Draw"}
                </span>
              )}
              {engineState.result?.reason && (
                <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                  {engineState.result.reason}
                </span>
              )}
              {/* Final standings */}
              <div style={standingsStyle}>
                {playerOrder
                  .map((pid) => ({
                    pid,
                    pts: pv.players?.[pid]?.trustPoints ?? 0,
                    eliminated: pv.players?.[pid]?.eliminated ?? false,
                  }))
                  .sort((a, b) => b.pts - a.pts)
                  .map((p, i) => (
                    <div key={p.pid} style={standingRowStyle}>
                      <span style={{ color: i === 0 ? "#f59e0b" : "#94a3b8", fontWeight: 600, fontSize: "0.8rem" }}>
                        #{i + 1}
                      </span>
                      <span style={{ color: "#e2e8f0", fontSize: "0.8rem", flex: 1 }}>
                        {p.pid}{p.pid === playerId ? " (You)" : ""}
                      </span>
                      <span style={{
                        color: p.eliminated ? "#ef4444" : "#2dd4bf",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                      }}>
                        {p.eliminated ? "OUT" : `${p.pts} pt`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            {onLeave && (
              <button style={lobbyBtnStyle} onClick={onLeave}>
                Back to Lobby
              </button>
            )}
          </div>
        )}

        {/* Keyframes for crisis animation */}
        <style>{`
          @keyframes crisis-pulse {
            0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.3), inset 0 0 30px rgba(245,158,11,0.05); }
            50% { box-shadow: 0 0 40px rgba(245,158,11,0.6), inset 0 0 60px rgba(245,158,11,0.1); }
          }
          @keyframes crisis-shake {
            0%, 100% { transform: translateX(0); }
            10% { transform: translateX(-3px); }
            20% { transform: translateX(3px); }
            30% { transform: translateX(-2px); }
            40% { transform: translateX(2px); }
            50% { transform: translateX(0); }
          }
          @keyframes crisis-vignette {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.7; }
          }
        `}</style>

        {/* Table */}
        <div style={tableOuterStyle}>
          <div style={{
            ...tableStyle,
            ...(stage === "withdrawalForced" ? {
              border: "3px solid rgba(245,158,11,0.6)",
              animation: "crisis-pulse 1.5s ease-in-out infinite, crisis-shake 0.4s ease-in-out 1",
            } : {}),
          }}>
            {/* Crisis vignette overlay */}
            {stage === "withdrawalForced" && (
              <div style={{
                position: "absolute",
                inset: 0,
                borderRadius: 24,
                background: "radial-gradient(ellipse at center, transparent 40%, rgba(245,158,11,0.12) 100%)",
                pointerEvents: "none",
                zIndex: 8,
                animation: "crisis-vignette 1.5s ease-in-out infinite",
              }} />
            )}
            {/* Center: deck, confirm, crisis accept */}
            <div style={centerAreaStyle}>
              {(() => {
                const canDraw = isMyTurn && stage === "drawCard" && deckCount > 0;
                const showConfirm = isMyTurn && stage === "resolveCard";
                const showCrisisAccept = isMyTurn && stage === "withdrawalForced" && !pv.drawnCard?.requiresTarget;
                const showCrisisTarget = isMyTurn && stage === "withdrawalForced" && pv.drawnCard?.requiresTarget;

                // resolveCard: confirm play on table
                if (showConfirm) {
                  const sc = pv.selectedCard;
                  const scColor = sc ? (CATEGORY_COLORS_MAP[sc.category as string] || "#3b82f6") : "#3b82f6";
                  return (
                    <>
                      {sc && (
                        <div style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 2,
                          padding: "6px 12px",
                          borderRadius: 8,
                          background: `rgba(${hexToRgb(scColor)}, 0.1)`,
                          border: `1px solid rgba(${hexToRgb(scColor)}, 0.3)`,
                        }}>
                          <span style={{ fontSize: "0.55rem", fontWeight: 600, color: scColor, textTransform: "uppercase" }}>
                            {sc.category}
                          </span>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#e2e8f0" }}>
                            {sc.name}
                          </span>
                          <span style={{ fontSize: "0.6rem", color: "#94a3b8" }}>
                            {sc.description}
                          </span>
                        </div>
                      )}
                      <div
                        style={{
                          ...confirmOnTableStyle,
                          background: "#22c55e",
                        }}
                        onClick={() => dispatch("confirmPlay")}
                      >
                        プレイ確定
                      </div>
                    </>
                  );
                }

                // withdrawalForced (no target): crisis card + accept button
                if (showCrisisAccept) {
                  const dc = pv.drawnCard;
                  return (
                    <>
                      {dc && (
                        <div style={crisisCardCenterStyle}>
                          <span style={crisisLabelStyle}>
                            ⚠ 信頼危機 ⚠
                          </span>
                          <span style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", textShadow: "0 0 10px rgba(245,158,11,0.5)" }}>
                            {dc.name}
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "#fcd34d" }}>
                            {dc.description}
                          </span>
                        </div>
                      )}
                      <div
                        style={{
                          ...confirmOnTableStyle,
                          background: "#f59e0b",
                          fontSize: "0.9rem",
                          padding: "10px 28px",
                        }}
                        onClick={() => dispatch("playWithdrawal")}
                      >
                        危機を受け入れる
                      </div>
                    </>
                  );
                }

                // withdrawalForced (with target): show crisis card info, targets handled by seats
                if (showCrisisTarget) {
                  const dc = pv.drawnCard;
                  return (
                    <>
                      {dc && (
                        <div style={crisisCardCenterStyle}>
                          <span style={crisisLabelStyle}>
                            ⚠ 信頼危機 ⚠
                          </span>
                          <span style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", textShadow: "0 0 10px rgba(245,158,11,0.5)" }}>
                            {dc.name}
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "#fcd34d" }}>
                            {dc.description}
                          </span>
                        </div>
                      )}
                      <span style={{ fontSize: "0.75rem", color: "#ef4444", fontWeight: 700, textShadow: "0 0 8px rgba(239,68,68,0.4)" }}>
                        対象を選択
                      </span>
                    </>
                  );
                }

                // Default: deck
                return (
                  <>
                    <div
                      style={{
                        ...deckVisualStyle,
                        cursor: canDraw ? "pointer" : "default",
                        border: canDraw ? "2px solid #3b82f6" : "1px solid #253545",
                        boxShadow: canDraw ? "0 0 16px rgba(59,130,246,0.4)" : "none",
                        transition: "all 0.2s ease",
                      }}
                      onClick={canDraw ? () => dispatch("drawCard") : undefined}
                    >
                      <span style={{ fontSize: "1.6rem" }}>🃏</span>
                      <span style={{ color: "#94a3b8", fontSize: "0.7rem", fontWeight: 600 }}>
                        {deckCount}
                      </span>
                      {canDraw && (
                        <span style={{ fontSize: "0.55rem", fontWeight: 600, color: "#3b82f6" }}>
                          クリックでドロー
                        </span>
                      )}
                    </div>
                    <span style={{ color: "#64748b", fontSize: "0.65rem" }}>
                      {currentPlayer === playerId ? "あなたのターン" : `${currentPlayer} のターン`}
                    </span>
                  </>
                );
              })()}
            </div>

            {/* Card effect overlay */}
            <CardEffectOverlay
              turnHistory={pv.turnHistory ?? []}
              currentPlayerId={playerId}
            />

            {/* Player seats */}
            {rotated.map((pid, i) => {
              if (i >= SEAT_POSITIONS.length) return null;
              const pos = SEAT_POSITIONS[i];
              const p = pv.players?.[pid];
              if (!p) return null;

              // Targetable when: my turn, selectTarget or withdrawalForced with target, not me, not eliminated
              const needsTarget = isMyTurn && (
                stage === "selectTarget" ||
                (stage === "withdrawalForced" && pv.drawnCard?.requiresTarget)
              );
              const isTargetable = needsTarget && pid !== playerId && !p.eliminated;

              return (
                <div
                  key={pid}
                  style={{
                    position: "absolute",
                    top: pos.top,
                    left: pos.left,
                    transform: "translate(-50%, -50%)",
                    zIndex: isTargetable ? 6 : 2,
                  }}
                >
                  <PlayerSeat
                    name={pid}
                    trustPoints={p.trustPoints}
                    eliminated={p.eliminated}
                    isMe={pid === playerId}
                    isCurrentTurn={pid === currentPlayer}
                    handCount={p.handCount ?? p.hand?.length ?? 0}
                    mission={p.mission}
                    openedMission={pv.openedMissions?.[pid]}
                    targetable={isTargetable}
                    onClick={() => {
                      if (stage === "selectTarget") {
                        dispatch("selectTarget", { targetPlayerId: pid });
                      } else if (stage === "withdrawalForced") {
                        dispatch("playWithdrawal", { targetPlayerId: pid });
                      }
                    }}
                  />
                </div>
              );
            })}

            {/* Hand dock at bottom of table */}
            <HandDock
              hand={me?.hand ?? []}
              canPlay={isMyTurn && stage === "selectCard"}
              onPlay={(cardId) => dispatch("selectCard", { cardId })}
            />
          </div>
        </div>

        {/* Opened missions (below table, not overlapping seats) */}
        {pv.openedMissions && Object.keys(pv.openedMissions).length > 0 && (
          <div style={openedMissionsStyle}>
            {Object.entries(pv.openedMissions).map(([pid, m]: [string, any]) => (
              <div key={pid} style={openedMissionChipStyle}>
                <span style={{ fontSize: "0.6rem", color: "#22c55e", fontWeight: 700 }}>
                  CLEAR
                </span>
                <span style={{ fontSize: "0.7rem", color: "#e2e8f0" }}>
                  {pid}: {m.name} (+{m.bonus})
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Mission panel (own secret mission) */}
        {myMission && (
          <MissionPanel mission={myMission} completed={false} />
        )}
        {missionCompleted && (
          <MissionPanel mission={pv.openedMissions[playerId]} completed />
        )}

        {/* Action bar */}
        {isMyTurn && !engineState.finished && (
          <ActionBar
            stage={stage}
            playerId={playerId}
            playerView={pv}
            dispatch={dispatch}
          />
        )}
      </div>

      {/* Sidebar: Card History + Event Log */}
      <div style={sidebarStyle}>
        <CardHistory turnHistory={pv.turnHistory ?? []} currentPlayerId={playerId} />
        <EventLog entries={gameState.actionLog ?? []} currentPlayerId={playerId} />
      </div>
    </div>
  );
}

const layoutStyle: CSSProperties = {
  display: "flex",
  gap: "0.8rem",
  padding: "0.8rem",
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
};

const mainStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
  flex: 1,
  minWidth: 0,
  overflowY: "auto",
};

const sidebarStyle: CSSProperties = {
  width: 300,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const statusBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#1a2332",
  borderRadius: 12,
  padding: "0.8rem 1rem",
  border: "1px solid #253545",
};

const turnBadgeStyle: CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 600,
  padding: "0.15rem 0.5rem",
  borderRadius: 8,
  color: "#94a3b8",
  background: "rgba(148,163,184,0.1)",
};

const myTurnBadgeStyle: CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  padding: "0.2rem 0.6rem",
  borderRadius: 8,
  color: "#22c55e",
  background: "rgba(34,197,94,0.15)",
  border: "1px solid rgba(34,197,94,0.3)",
  animation: "pulse 2s ease-in-out infinite",
};

const errorStyle: CSSProperties = {
  background: "#2d0a0a",
  color: "#fca5a5",
  padding: "0.6rem 1rem",
  borderRadius: 8,
  fontSize: "0.85rem",
};

const resultStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1rem",
  background: "#1a2332",
  borderRadius: 12,
  padding: "1.2rem 1.5rem",
  border: "1px solid #253545",
};

const standingsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  width: "100%",
  maxWidth: 300,
  marginTop: 8,
};

const standingRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 6,
  background: "rgba(37,53,69,0.5)",
};

const lobbyBtnStyle: CSSProperties = {
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "0.5rem 1rem",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
};

const tableOuterStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "0.5rem",
};

const tableStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 750,
  aspectRatio: "16 / 11",
  background: "linear-gradient(135deg, #1a2332, #1e293b)",
  borderRadius: 24,
  border: "3px solid #2a3f52",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.3)",
};

const centerAreaStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  zIndex: 1,
};

const deckVisualStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  padding: "10px 16px",
  borderRadius: 12,
  background: "rgba(15,23,42,0.7)",
  border: "1px solid #253545",
};

const crisisCardCenterStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: "12px 20px",
  borderRadius: 12,
  background: "rgba(245,158,11,0.2)",
  border: "2px solid rgba(245,158,11,0.6)",
  boxShadow: "0 0 24px rgba(245,158,11,0.3)",
};

const crisisLabelStyle: CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 800,
  color: "#f59e0b",
  textTransform: "uppercase",
  letterSpacing: 2,
  textShadow: "0 0 8px rgba(245,158,11,0.5)",
};

const confirmOnTableStyle: CSSProperties = {
  padding: "8px 20px",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 700,
  textAlign: "center",
};

const openedMissionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "center",
};

const openedMissionChipStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 1,
  padding: "3px 8px",
  borderRadius: 6,
  background: "rgba(34,197,94,0.1)",
  border: "1px solid rgba(34,197,94,0.25)",
};
