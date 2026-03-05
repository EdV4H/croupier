import type { CSSProperties } from "react";
import type { GameStateData } from "../../hooks/use-game-state.js";
import { PokerTable } from "./poker-table.js";
import { PokerCard } from "./poker-card.js";
import { HoldemActionBar } from "./holdem-action-bar.js";
import { EventLog } from "../../components/game-board.js";

interface HoldemRichUIProps {
  gameState: GameStateData;
  dispatch: (action: string, payload?: unknown) => void;
  lastError: string | null;
}

export function HoldemRichUI({ gameState, dispatch, lastError }: HoldemRichUIProps) {
  const { engineState, playerView, playerId } = gameState;
  const pv = playerView;

  const isMyTurn = Array.isArray(engineState.currentPlayers)
    ? engineState.currentPlayers.includes(playerId)
    : engineState.currentPlayers === playerId;

  const myCards: { suit: string; rank: number; hidden?: boolean }[] =
    pv.players?.[playerId]?.holeCards ?? [];
  const visibleCards = myCards.filter((c) => !c.hidden);

  return (
    <div style={layoutStyle}>
      {/* Main area */}
      <div style={mainStyle}>
        {/* Status bar */}
        <div style={statusBarStyle}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
              Phase: {engineState.phase}
            </span>
            {engineState.stage && (
              <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
                Stage: {engineState.stage}
              </span>
            )}
          </div>
          <span style={{
            fontSize: "0.8rem",
            color: "#fff",
            padding: "0.3rem 0.7rem",
            borderRadius: 20,
            fontWeight: 600,
            background: engineState.finished ? "#6366f1" : isMyTurn ? "#22c55e" : "#64748b",
          }}>
            {engineState.finished ? "Game Over" : isMyTurn ? "Your Turn" : "Waiting..."}
          </span>
        </div>

        {/* Error */}
        {lastError && (
          <div style={errorStyle}>{lastError}</div>
        )}

        {/* Game result */}
        {engineState.finished && engineState.result && (
          <div style={resultStyle}>
            <h3 style={{ margin: "0 0 0.3rem" }}>Game Over</h3>
            {engineState.result.winner && (
              <p style={{ margin: 0 }}>
                Winner:{" "}
                {Array.isArray(engineState.result.winner)
                  ? engineState.result.winner.join(", ")
                  : engineState.result.winner}
              </p>
            )}
            {engineState.result.reason && <p style={{ margin: 0 }}>{engineState.result.reason}</p>}
          </div>
        )}

        {/* Poker table */}
        <PokerTable
          playerView={pv}
          playerId={playerId}
          turnDeadline={gameState.turnDeadline}
        />

        {/* Your hole cards (large) */}
        {visibleCards.length > 0 && (
          <div style={yourCardsStyle}>
            <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: 600 }}>
              Your Cards
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {visibleCards.map((c, i) => (
                <PokerCard key={i} suit={c.suit} rank={c.rank} size="large" />
              ))}
            </div>
          </div>
        )}

        {/* Action bar */}
        {!engineState.finished && isMyTurn && (
          <HoldemActionBar
            playerView={pv}
            playerId={playerId}
            dispatch={dispatch}
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
  gap: "1rem",
  padding: "1rem",
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
};

const mainStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.8rem",
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
  background: "#1e293b",
  borderRadius: 8,
  padding: "0.8rem 1rem",
  border: "1px solid #334155",
};

const errorStyle: CSSProperties = {
  background: "#450a0a",
  color: "#fca5a5",
  padding: "0.6rem 1rem",
  borderRadius: 8,
  fontSize: "0.85rem",
};

const resultStyle: CSSProperties = {
  background: "#14532d",
  color: "#86efac",
  padding: "1rem",
  borderRadius: 8,
  textAlign: "center",
};

const yourCardsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "0.8rem 1rem",
  background: "#1e293b",
  borderRadius: 10,
  border: "1px solid #334155",
};
