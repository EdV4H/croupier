import { useState, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import type { GameStateData } from "../../hooks/use-game-state.js";
import { EventLog } from "../../components/game-board.js";
import { PlayerCard } from "./player-card.js";
import { DeckSelector } from "./deck-selector.js";
import { FacilitatorControls } from "./facilitator-controls.js";
import { CountdownOverlay } from "./countdown-overlay.js";

interface PlanningPokerRichUIProps {
  gameState: GameStateData;
  dispatch: (action: string, payload?: unknown) => void;
  lastError: string | null;
  onLeave?: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  idle: "Waiting for Task",
  discussion: "Discussion",
  voting: "Voting",
  evaluation: "Evaluation",
  consensus: "Consensus",
};

/**
 * Seat positions for 2-10 players, expressed as CSS % offsets.
 * Player at index 0 (self) is always at bottom center.
 */
const SEAT_POSITIONS: Record<number, { top: string; left: string }[]> = {
  2: [
    { top: "75%", left: "50%" },
    { top: "20%", left: "50%" },
  ],
  3: [
    { top: "75%", left: "50%" },
    { top: "22%", left: "25%" },
    { top: "22%", left: "75%" },
  ],
  4: [
    { top: "75%", left: "50%" },
    { top: "48%", left: "14%" },
    { top: "20%", left: "50%" },
    { top: "48%", left: "86%" },
  ],
  5: [
    { top: "75%", left: "50%" },
    { top: "55%", left: "14%" },
    { top: "22%", left: "25%" },
    { top: "22%", left: "75%" },
    { top: "55%", left: "86%" },
  ],
  6: [
    { top: "75%", left: "50%" },
    { top: "50%", left: "14%" },
    { top: "22%", left: "25%" },
    { top: "22%", left: "50%" },
    { top: "22%", left: "75%" },
    { top: "50%", left: "86%" },
  ],
  7: [
    { top: "75%", left: "50%" },
    { top: "55%", left: "14%" },
    { top: "28%", left: "15%" },
    { top: "20%", left: "38%" },
    { top: "20%", left: "62%" },
    { top: "28%", left: "85%" },
    { top: "55%", left: "86%" },
  ],
  8: [
    { top: "75%", left: "50%" },
    { top: "60%", left: "14%" },
    { top: "36%", left: "14%" },
    { top: "20%", left: "30%" },
    { top: "20%", left: "50%" },
    { top: "20%", left: "70%" },
    { top: "36%", left: "86%" },
    { top: "60%", left: "86%" },
  ],
  9: [
    { top: "75%", left: "50%" },
    { top: "64%", left: "14%" },
    { top: "40%", left: "13%" },
    { top: "22%", left: "22%" },
    { top: "20%", left: "42%" },
    { top: "20%", left: "58%" },
    { top: "22%", left: "78%" },
    { top: "40%", left: "87%" },
    { top: "64%", left: "86%" },
  ],
  10: [
    { top: "75%", left: "50%" },
    { top: "66%", left: "14%" },
    { top: "44%", left: "13%" },
    { top: "24%", left: "18%" },
    { top: "20%", left: "38%" },
    { top: "20%", left: "62%" },
    { top: "24%", left: "82%" },
    { top: "44%", left: "87%" },
    { top: "66%", left: "86%" },
    { top: "75%", left: "30%" },
  ],
};

function rotateToSelf(order: string[], selfId: string): string[] {
  const idx = order.indexOf(selfId);
  if (idx <= 0) return order;
  return [...order.slice(idx), ...order.slice(0, idx)];
}

export function PlanningPokerRichUI({ gameState, dispatch, lastError, onLeave }: PlanningPokerRichUIProps) {
  const { engineState, playerView, playerId } = gameState;
  const pv = playerView;
  const phase = engineState.phase;

  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0) {
      dispatch("reveal");
      setCountdown(null);
    }
  }, [countdown, dispatch]);

  const startCountdown = useCallback(() => {
    setCountdown(3);
  }, []);

  const me = pv.players?.[playerId];
  const isFacilitator = me?.role === "facilitator";
  const canVote =
    me?.role === "voter" || (isFacilitator && pv.facilitatorCanVote);

  const playerOrder: string[] = pv.playerOrder ?? [];
  const rotated = rotateToSelf(playerOrder, playerId);
  const count = Math.min(Math.max(rotated.length, 2), 10);
  const seats = SEAT_POSITIONS[count] ?? SEAT_POSITIONS[2];

  const revealedCards: Record<string, string> | null = pv.revealedCards;

  // Compute vote stats for evaluation/consensus
  let voteStats: { value: string; count: number }[] = [];
  let numericStats: { avg: number; min: number; max: number } | null = null;
  if (revealedCards) {
    const counts: Record<string, number> = {};
    const nums: number[] = [];
    for (const v of Object.values(revealedCards)) {
      counts[v] = (counts[v] ?? 0) + 1;
      const n = Number(v);
      if (!isNaN(n)) nums.push(n);
    }
    voteStats = Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
    if (nums.length > 0) {
      numericStats = {
        avg: Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10,
        min: Math.min(...nums),
        max: Math.max(...nums),
      };
    }
  }

  return (
    <div style={layoutStyle}>
      {/* Main area */}
      <div style={mainStyle}>
        {/* Status bar */}
        <div style={statusBarStyle}>
          <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
            <span style={phaseBadgeStyle}>
              {PHASE_LABELS[phase] ?? phase}
            </span>
            <span style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              padding: "0.15rem 0.5rem",
              borderRadius: 8,
              color: "#fff",
              background: isFacilitator ? "#d4a843" : "#7a8fa3",
            }}>
              {isFacilitator ? "Facilitator" : "Voter"}
            </span>
            {pv.roundNumber > 0 && (
              <span style={{ color: "#4a5f73", fontSize: "0.8rem" }}>
                Round {pv.roundNumber}
              </span>
            )}
          </div>
          <span style={{
            fontSize: "0.8rem",
            color: "#fff",
            padding: "0.3rem 0.7rem",
            borderRadius: 20,
            fontWeight: 600,
            background: engineState.finished ? "#6366f1" : "#2dd4bf",
          }}>
            {engineState.finished ? "Session Over" : PHASE_LABELS[phase] ?? phase}
          </span>
        </div>

        {/* Error */}
        {lastError && (
          <div style={errorStyle}>{lastError}</div>
        )}

        {/* Game Over */}
        {engineState.finished && onLeave && (
          <div style={resultStyle}>
            <span style={{ color: "#e2e8f0", fontSize: "0.9rem", fontWeight: 600 }}>
              Session Complete
            </span>
            <button style={lobbyBtnStyle} onClick={onLeave}>
              Back to Lobby
            </button>
          </div>
        )}

        {/* Table */}
        <div style={tableOuterStyle}>
          <div style={tableStyle}>
            {/* Center area: task + results */}
            <div style={centerAreaStyle}>
              {pv.currentTask ? (
                <div style={centerTaskStyle}>
                  <span style={{ color: "#7a8fa3", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                    Task
                  </span>
                  <span style={{ color: "#e2e8f0", fontSize: "0.95rem", fontWeight: 700, textAlign: "center" }}>
                    {pv.currentTask.title}
                  </span>
                </div>
              ) : (
                <span style={{ color: "#4a5f73", fontSize: "0.8rem" }}>
                  No task selected
                </span>
              )}

              {/* Vote results in center */}
              {revealedCards && (phase === "evaluation" || phase === "consensus") && (
                <>
                  <div style={centerResultsStyle}>
                    {voteStats.map((s) => (
                      <div key={s.value} style={centerStatStyle}>
                        <span style={{ color: "#2dd4bf", fontSize: "1.2rem", fontWeight: 700, lineHeight: 1 }}>
                          {s.value}
                        </span>
                        <span style={{ color: "#7a8fa3", fontSize: "0.6rem" }}>
                          x{s.count}
                        </span>
                      </div>
                    ))}
                  </div>
                  {numericStats && (
                    <div style={numericStatsStyle}>
                      <div style={numericStatItemStyle}>
                        <span style={{ color: "#7a8fa3", fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: 0.5 }}>Min</span>
                        <span style={{ color: "#60a5fa", fontSize: "0.95rem", fontWeight: 700 }}>{numericStats.min}</span>
                      </div>
                      <div style={numericStatItemStyle}>
                        <span style={{ color: "#7a8fa3", fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: 0.5 }}>Avg</span>
                        <span style={{ color: "#e2e8f0", fontSize: "0.95rem", fontWeight: 700 }}>{numericStats.avg}</span>
                      </div>
                      <div style={numericStatItemStyle}>
                        <span style={{ color: "#7a8fa3", fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: 0.5 }}>Max</span>
                        <span style={{ color: "#f59e0b", fontSize: "0.95rem", fontWeight: 700 }}>{numericStats.max}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Final estimate */}
              {pv.finalEstimate && (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "#d4a843", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Estimate:
                  </span>
                  <span style={{ color: "#2dd4bf", fontSize: "1.3rem", fontWeight: 700 }}>
                    {pv.finalEstimate}
                  </span>
                </div>
              )}
            </div>

            {/* Countdown overlay */}
            {countdown !== null && countdown > 0 && (
              <CountdownOverlay value={countdown} />
            )}

            {/* Player seats around the table */}
            {rotated.map((pid, i) => {
              if (i >= seats.length) return null;
              const pos = seats[i];
              const p = pv.players?.[pid];
              if (!p) return null;

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
                  <PlayerCard
                    name={pid}
                    role={p.role}
                    selectedCard={p.selectedCard}
                    isMe={pid === playerId}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Deck selector (voting phase, for voters / facilitators who can vote) */}
        {phase === "voting" && canVote && (
          <DeckSelector
            deck={pv.deck ?? []}
            selectedCard={me?.selectedCard ?? null}
            onSelect={(card) => dispatch("vote", { card })}
          />
        )}

        {/* Facilitator controls */}
        {isFacilitator && (
          <FacilitatorControls
            phase={phase}
            dispatch={dispatch}
            onReveal={startCountdown}
            countdownActive={countdown !== null}
          />
        )}
      </div>

      {/* Sidebar: Event Log */}
      <div style={sidebarStyle}>
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

const phaseBadgeStyle: CSSProperties = {
  color: "#e2e8f0",
  fontSize: "0.85rem",
  fontWeight: 600,
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
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
  background: "#1a2332",
  borderRadius: 12,
  padding: "0.8rem 1rem",
  border: "1px solid #253545",
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
  maxWidth: 800,
  aspectRatio: "16 / 12",
  background: "#1a2332",
  borderRadius: 24,
  border: "3px solid #2a3f52",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)",
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
  maxWidth: "60%",
};

const centerTaskStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  background: "rgba(15,23,42,0.7)",
  borderRadius: 10,
  padding: "6px 16px",
  border: "1px solid #253545",
};

const centerResultsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "center",
};

const centerStatStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 1,
  background: "rgba(15,23,42,0.7)",
  borderRadius: 8,
  padding: "4px 10px",
  border: "1px solid #253545",
};

const numericStatsStyle: CSSProperties = {
  display: "flex",
  gap: 6,
};

const numericStatItemStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 1,
  background: "rgba(15,23,42,0.5)",
  borderRadius: 6,
  padding: "3px 8px",
};
