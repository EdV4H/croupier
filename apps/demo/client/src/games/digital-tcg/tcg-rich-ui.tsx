import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import type { GameStateData } from "../../hooks/use-game-state.js";
import { TCGBoard } from "./tcg-board.js";
import { TCGActionBar } from "./tcg-action-bar.js";
import { EventLog } from "../../components/game-board.js";

interface TCGRichUIProps {
  gameState: GameStateData;
  dispatch: (action: string, payload?: unknown) => void;
  lastError: string | null;
  onLeave?: () => void;
}

export function TCGRichUI({ gameState, dispatch, lastError, onLeave }: TCGRichUIProps) {
  const { engineState, playerView: pv, playerId } = gameState;

  const isMyTurn = Array.isArray(engineState.currentPlayers)
    ? engineState.currentPlayers.includes(playerId)
    : engineState.currentPlayers === playerId;

  const [selectedAttacker, setSelectedAttacker] = useState<string | null>(null);

  // Reset selection when active player changes or game finishes
  useEffect(() => {
    setSelectedAttacker(null);
  }, [pv.activePlayer, engineState.finished]);

  const opponentId = pv.playerOrder?.find((p: string) => p !== playerId);
  const myPlayer = pv.players?.[playerId];
  const opponentPlayer = opponentId ? pv.players?.[opponentId] : null;

  const handlePlayCard = (cardId: string) => {
    dispatch("playCard", { cardId });
  };

  const handleSelectTarget = (targetId: string) => {
    if (selectedAttacker) {
      dispatch("attack", { attackerId: selectedAttacker, targetId });
      setSelectedAttacker(null);
    }
  };

  const handleAttackFace = () => {
    if (selectedAttacker) {
      dispatch("attack", { attackerId: selectedAttacker, targetId: "face" });
      setSelectedAttacker(null);
    }
  };

  const handleEndTurn = () => {
    setSelectedAttacker(null);
    dispatch("endTurn");
  };

  return (
    <div style={layoutStyle}>
      {/* Main area */}
      <div style={mainStyle}>
        {/* Status bar */}
        <div style={statusBarStyle}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
              Turn {pv.turnCount ?? 0}
            </span>
            <span style={{ color: "#475569", fontSize: "0.8rem" }}>
              Active: {pv.activePlayer === playerId ? "You" : pv.activePlayer}
            </span>
          </div>
          <span
            style={{
              fontSize: "0.8rem",
              color: "#fff",
              padding: "0.3rem 0.7rem",
              borderRadius: 20,
              fontWeight: 600,
              background: engineState.finished
                ? "#6366f1"
                : isMyTurn
                  ? "#2dd4bf"
                  : "#4a5568",
            }}
          >
            {engineState.finished ? "Game Over" : isMyTurn ? "Your Turn" : "Waiting..."}
          </span>
        </div>

        {/* Error */}
        {lastError && <div style={errorStyle}>{lastError}</div>}

        {/* Game result */}
        {engineState.finished && engineState.result && (
          <div style={resultStyle}>
            <h3 style={{ margin: "0 0 0.3rem" }}>Game Over</h3>
            {engineState.result.winner && (
              <p style={{ margin: 0 }}>
                Winner:{" "}
                {engineState.result.winner === playerId
                  ? "You!"
                  : engineState.result.winner}
              </p>
            )}
            {engineState.result.reason && (
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>
                {engineState.result.reason}
              </p>
            )}
            {onLeave && (
              <button style={lobbyBtnStyle} onClick={onLeave}>
                Back to Lobby
              </button>
            )}
          </div>
        )}

        {/* Board */}
        {myPlayer && opponentPlayer && (
          <TCGBoard
            myPlayer={myPlayer}
            opponent={opponentPlayer}
            myPlayerId={playerId}
            opponentId={opponentId ?? ""}
            isMyTurn={isMyTurn}
            selectedAttacker={selectedAttacker}
            onSelectAttacker={setSelectedAttacker}
            onSelectTarget={handleSelectTarget}
            onPlayCard={handlePlayCard}
            onAttackFace={handleAttackFace}
            turnDeadline={gameState.turnDeadline}
          />
        )}

        {/* Action bar */}
        {!engineState.finished && (
          <TCGActionBar
            isMyTurn={isMyTurn}
            attackMode={selectedAttacker != null}
            onEndTurn={handleEndTurn}
            onCancelAttack={() => setSelectedAttacker(null)}
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

const errorStyle: CSSProperties = {
  background: "#2d0a0a",
  color: "#fca5a5",
  padding: "0.6rem 1rem",
  borderRadius: 8,
  fontSize: "0.85rem",
};

const resultStyle: CSSProperties = {
  background: "#0f2d1e",
  color: "#2dd4bf",
  padding: "1rem",
  borderRadius: 8,
  textAlign: "center",
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
