import type { CSSProperties } from "react";
import type { GameStateData } from "../../hooks/use-game-state.js";
import { EventLog } from "../../components/game-board.js";
import { PlayerHand } from "./player-hand.js";
import { DiscardPool } from "./discard-pool.js";

interface ValuesCardRichUIProps {
  gameState: GameStateData;
  dispatch: (action: string, payload?: unknown) => void;
  lastError: string | null;
  onLeave?: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  waitingForDraw: "Draw Phase",
  waitingForDiscard: "Discard Phase",
};

export function ValuesCardRichUI({ gameState, dispatch, lastError, onLeave }: ValuesCardRichUIProps) {
  const { engineState, playerView, playerId } = gameState;
  const pv = playerView;
  const stage = engineState.stage ?? null;

  const playerOrder: string[] = pv.playerOrder ?? [];
  const isMyTurn = Array.isArray(engineState.currentPlayers)
    ? engineState.currentPlayers.includes(playerId)
    : engineState.currentPlayers === playerId;

  const currentTurnPlayer = playerOrder[pv.currentPlayerIndex ?? 0] ?? null;
  const deckCount: number = pv.deckCount ?? 0;
  const discardPool = pv.discardPool ?? [];
  const turnCount: number = pv.turnCount ?? 0;

  const canPickFromDiscard = isMyTurn && stage === "waitingForDraw" && discardPool.length > 0;

  return (
    <div style={layoutStyle}>
      {/* Main area */}
      <div style={mainStyle}>
        {/* Status bar */}
        <div style={statusBarStyle}>
          <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
            <span style={{ color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 600 }}>
              {pv.theme ?? "Values Card"}
            </span>
            {stage && (
              <span style={stageBadgeStyle}>
                {STAGE_LABELS[stage] ?? stage}
              </span>
            )}
            <span style={{ color: "#4a5f73", fontSize: "0.8rem" }}>
              Turn {turnCount}
            </span>
            <span style={{ color: "#4a5f73", fontSize: "0.8rem" }}>
              Deck: {deckCount}
            </span>
            {pv.lastRound && !engineState.finished && (
              <span style={lastRoundBadgeStyle}>Last Round</span>
            )}
          </div>
          <span
            style={{
              fontSize: "0.8rem",
              color: "#fff",
              padding: "0.3rem 0.7rem",
              borderRadius: 20,
              fontWeight: 600,
              background: engineState.finished ? "#6366f1" : isMyTurn ? "#2dd4bf" : "#4a5f73",
            }}
          >
            {engineState.finished
              ? "Game Over"
              : isMyTurn
                ? "Your Turn"
                : `${currentTurnPlayer ?? "..."}'s Turn`}
          </span>
        </div>

        {/* Error */}
        {lastError && <div style={errorStyle}>{lastError}</div>}

        {/* Game Result */}
        {engineState.finished && (
          <div style={resultStyle}>
            <h3 style={{ color: "#2dd4bf", margin: "0 0 8px", fontSize: "1rem" }}>
              Game Over - Final Hands
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {playerOrder.map((pid) => {
                const hand = pv.players?.[pid]?.hand ?? [];
                return (
                  <div key={pid} style={resultPlayerStyle}>
                    <span style={{ color: "#7a8fa3", fontSize: "0.75rem", fontWeight: 600 }}>
                      {pid.startsWith("bot:") ? pid.slice(4) : pid}
                    </span>
                    <span style={{ color: "#e2e8f0", fontSize: "0.7rem" }}>
                      {hand.map((c: any) => c.name).join(", ")}
                    </span>
                  </div>
                );
              })}
            </div>
            {onLeave && (
              <button style={lobbyBtnStyle} onClick={onLeave}>
                Back to Lobby
              </button>
            )}
          </div>
        )}

        {/* My hand */}
        <div data-player-id={playerId}>
        <PlayerHand
          playerId={playerId}
          hand={pv.players?.[playerId]?.hand ?? []}
          isMe={true}
          isCurrentTurn={isMyTurn}
          stage={stage}
          onDiscard={(cardId) => dispatch("discardCard", { cardId })}
        />
        </div>

        {/* Action bar */}
        {!engineState.finished && isMyTurn && (
          <div style={actionBarStyle}>
            {stage === "waitingForDraw" && (
              <>
                <button
                  style={actionBtnStyle}
                  onClick={() => dispatch("drawFromDeck")}
                  disabled={deckCount === 0}
                >
                  Draw from Deck ({deckCount} left)
                </button>
                {discardPool.length > 0 && (
                  <span style={{ color: "#7a8fa3", fontSize: "0.75rem" }}>
                    * You can also pick from the discard pool below
                  </span>
                )}
              </>
            )}
            {stage === "waitingForDiscard" && (
              <span style={{ color: "#7a8fa3", fontSize: "0.8rem" }}>
                Select a card from your hand to discard
              </span>
            )}
          </div>
        )}

        {/* Discard Pool */}
        <DiscardPool
          discardPool={discardPool}
          canPick={canPickFromDiscard}
          onPickCard={(cardId) => dispatch("drawFromDiscard", { cardId })}
        />

        {/* Other players */}
        <div style={othersContainerStyle}>
          {playerOrder
            .filter((pid) => pid !== playerId)
            .map((pid) => {
              const p = pv.players?.[pid];
              return (
                <div key={pid} data-player-id={pid}>
                <PlayerHand
                  playerId={pid}
                  hand={p?.hand ?? []}
                  handCount={p?.handCount ?? 0}
                  isMe={false}
                  isCurrentTurn={currentTurnPlayer === pid}
                  stage={stage}
                />
                </div>
              );
            })}
        </div>
      </div>

      {/* Sidebar */}
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

const lastRoundBadgeStyle: CSSProperties = {
  color: "#f59e0b",
  fontSize: "0.7rem",
  fontWeight: 600,
  background: "rgba(245,158,11,0.12)",
  padding: "2px 8px",
  borderRadius: 8,
};

const stageBadgeStyle: CSSProperties = {
  color: "#2dd4bf",
  fontSize: "0.7rem",
  fontWeight: 600,
  background: "rgba(45,212,191,0.12)",
  padding: "2px 8px",
  borderRadius: 8,
};

const errorStyle: CSSProperties = {
  background: "#2d0a0a",
  color: "#fca5a5",
  padding: "0.6rem 1rem",
  borderRadius: 8,
  fontSize: "0.85rem",
};

const resultStyle: CSSProperties = {
  background: "#1a2332",
  borderRadius: 12,
  padding: 16,
  border: "1px solid #253545",
};

const lobbyBtnStyle: CSSProperties = {
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "0.6rem 1.2rem",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: 600,
  marginTop: "0.8rem",
};

const resultPlayerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  background: "#0f172a",
  borderRadius: 8,
  padding: "6px 10px",
};

const actionBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  background: "#1a2332",
  borderRadius: 12,
  padding: "0.7rem 1rem",
  border: "1px solid #253545",
};

const actionBtnStyle: CSSProperties = {
  background: "#2dd4bf",
  color: "#0f172a",
  border: "none",
  borderRadius: 8,
  padding: "0.5rem 1rem",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 700,
};

const othersContainerStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};
