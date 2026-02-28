import type { GameStateData } from "../hooks/use-game-state.js";

interface GameBoardProps {
  gameId: string;
  gameState: GameStateData;
  dispatch: (action: string, payload?: unknown) => void;
  lastError: string | null;
}

export function GameBoard({
  gameId,
  gameState,
  dispatch,
  lastError,
}: GameBoardProps) {
  const { engineState, playerView, playerId } = gameState;
  const isMyTurn = Array.isArray(engineState.currentPlayers)
    ? engineState.currentPlayers.includes(playerId)
    : engineState.currentPlayers === playerId;

  return (
    <div style={styles.container}>
      {/* Status Bar */}
      <div style={styles.statusBar}>
        <div style={styles.statusLeft}>
          <span style={styles.phase}>Phase: {engineState.phase}</span>
          {engineState.stage && (
            <span style={styles.stage}>Stage: {engineState.stage}</span>
          )}
        </div>
        <div style={styles.statusRight}>
          <span style={{ ...styles.turnBadge, background: isMyTurn ? "#22c55e" : "#64748b" }}>
            {engineState.finished
              ? "Game Over"
              : isMyTurn
                ? "Your Turn"
                : "Waiting..."}
          </span>
        </div>
      </div>

      {/* Error */}
      {lastError && (
        <div style={styles.error}>{lastError}</div>
      )}

      {/* Game Result */}
      {engineState.finished && engineState.result && (
        <div style={styles.result}>
          <h3>Game Over</h3>
          {engineState.result.winner && (
            <p>
              Winner:{" "}
              {Array.isArray(engineState.result.winner)
                ? engineState.result.winner.join(", ")
                : engineState.result.winner}
            </p>
          )}
          {engineState.result.reason && <p>{engineState.result.reason}</p>}
        </div>
      )}

      {/* Player View Debug */}
      <div style={styles.stateView}>
        <details>
          <summary style={styles.detailsSummary}>
            Raw Game State (Debug)
          </summary>
          <pre style={styles.pre}>
            {JSON.stringify(playerView, null, 2)}
          </pre>
        </details>
      </div>

      {/* Action Buttons */}
      {!engineState.finished && isMyTurn && (
        <div style={styles.actions}>
          <ActionPanel
            gameId={gameId}
            playerView={playerView}
            engineState={engineState}
            dispatch={dispatch}
            playerId={playerId}
          />
        </div>
      )}
    </div>
  );
}

/** Dynamic action panel based on game type */
function ActionPanel({
  gameId,
  playerView,
  engineState,
  dispatch,
  playerId,
}: {
  gameId: string;
  playerView: any;
  engineState: GameStateData["engineState"];
  dispatch: (action: string, payload?: unknown) => void;
  playerId: string;
}) {
  switch (gameId) {
    case "texas-holdem":
      return <HoldemActions pv={playerView} dispatch={dispatch} pid={playerId} />;
    case "planning-poker":
      return <PlanningPokerActions pv={playerView} dispatch={dispatch} pid={playerId} es={engineState} />;
    case "values-card":
      return <ValuesCardActions pv={playerView} dispatch={dispatch} pid={playerId} es={engineState} />;
    case "digital-tcg":
      return <TCGActions pv={playerView} dispatch={dispatch} pid={playerId} />;
    default:
      return <p>No UI for this game</p>;
  }
}

function HoldemActions({
  pv,
  dispatch,
  pid,
}: {
  pv: any;
  dispatch: (a: string, p?: unknown) => void;
  pid: string;
}) {
  const player = pv.players?.[pid];
  return (
    <div style={styles.actionRow}>
      <button style={styles.actionBtn} onClick={() => dispatch("fold")}>
        Fold
      </button>
      <button style={styles.actionBtn} onClick={() => dispatch("check")}>
        Check
      </button>
      <button style={styles.actionBtn} onClick={() => dispatch("call")}>
        Call
      </button>
      <button
        style={styles.actionBtn}
        onClick={() => {
          const amount = prompt("Raise to amount:", String((pv.currentHighestBet || 0) * 2 || 4));
          if (amount) dispatch("raise", { amount: Number(amount) });
        }}
      >
        Raise
      </button>
      <button style={{ ...styles.actionBtn, background: "#dc2626" }} onClick={() => dispatch("allIn")}>
        All-In ({player?.stack ?? 0})
      </button>
    </div>
  );
}

function PlanningPokerActions({
  pv,
  dispatch,
  pid,
  es,
}: {
  pv: any;
  dispatch: (a: string, p?: unknown) => void;
  pid: string;
  es: GameStateData["engineState"];
}) {
  const role = pv.players?.[pid]?.role;
  const isFacilitator = role === "facilitator";

  if (isFacilitator) {
    return (
      <div style={styles.actionRow}>
        {es.phase === "idle" && (
          <button
            style={styles.actionBtn}
            onClick={() => {
              const title = prompt("Task title:");
              if (title) dispatch("selectTask", { id: `T${Date.now()}`, title });
            }}
          >
            Select Task
          </button>
        )}
        {es.phase === "discussion" && (
          <button style={styles.actionBtn} onClick={() => dispatch("startVoting")}>
            Start Voting
          </button>
        )}
        {es.phase === "voting" && (
          <button style={styles.actionBtn} onClick={() => dispatch("reveal")}>
            Reveal Cards
          </button>
        )}
        {es.phase === "evaluation" && (
          <>
            <button
              style={styles.actionBtn}
              onClick={() => {
                const est = prompt("Final estimate:");
                if (est) dispatch("recordEstimate", { estimate: est });
              }}
            >
              Record Estimate
            </button>
            <button style={styles.actionBtn} onClick={() => dispatch("startVoting")}>
              Re-Vote
            </button>
          </>
        )}
        {es.phase === "consensus" && (
          <button style={styles.actionBtn} onClick={() => dispatch("resetForNextTask")}>
            Next Task
          </button>
        )}
      </div>
    );
  }

  // Voter
  if (es.phase === "voting") {
    const deck = pv.deck || [];
    return (
      <div style={styles.actionRow}>
        {deck.map((card: string) => (
          <button
            key={card}
            style={{
              ...styles.actionBtn,
              background:
                pv.players?.[pid]?.selectedCard === card ? "#22c55e" : "#3b82f6",
            }}
            onClick={() => dispatch("vote", { card })}
          >
            {card}
          </button>
        ))}
      </div>
    );
  }

  return <p style={{ color: "#94a3b8" }}>Waiting for facilitator...</p>;
}

function ValuesCardActions({
  pv,
  dispatch,
  pid,
  es,
}: {
  pv: any;
  dispatch: (a: string, p?: unknown) => void;
  pid: string;
  es: GameStateData["engineState"];
}) {
  const hand = pv.players?.[pid]?.hand ?? [];

  if (es.stage === "waitingForDraw") {
    return (
      <div style={styles.actionCol}>
        <p style={{ color: "#94a3b8", marginBottom: "0.5rem" }}>Draw a card:</p>
        <div style={styles.actionRow}>
          <button
            style={styles.actionBtn}
            onClick={() => dispatch("drawFromDeck")}
            disabled={pv.deckCount === 0}
          >
            Draw from Deck ({pv.deckCount} left)
          </button>
          {(pv.discardPool ?? []).map((entry: any, i: number) => (
            <button
              key={i}
              style={{ ...styles.actionBtn, background: "#8b5cf6" }}
              onClick={() => dispatch("drawFromDiscard", { cardId: entry.card.id })}
            >
              Pick: {entry.card.name} (from {entry.discardedBy})
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (es.stage === "waitingForDiscard") {
    return (
      <div style={styles.actionCol}>
        <p style={{ color: "#94a3b8", marginBottom: "0.5rem" }}>
          Discard a card (you have {hand.length}):
        </p>
        <div style={styles.actionRow}>
          {hand.map((card: any) => (
            <button
              key={card.id}
              style={{ ...styles.actionBtn, background: "#ef4444" }}
              onClick={() => dispatch("discardCard", { cardId: card.id })}
            >
              Discard: {card.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return <p style={{ color: "#94a3b8" }}>Waiting...</p>;
}

function TCGActions({
  pv,
  dispatch,
  pid,
}: {
  pv: any;
  dispatch: (a: string, p?: unknown) => void;
  pid: string;
}) {
  const player = pv.players?.[pid];
  const hand = player?.hand ?? [];
  const board = player?.board ?? [];
  const opponentId = pv.playerOrder?.find((p: string) => p !== pid);
  const opponentBoard = opponentId ? pv.players?.[opponentId]?.board ?? [] : [];

  return (
    <div style={styles.actionCol}>
      <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
        Mana: {player?.currentMana}/{player?.maxMana}
      </p>

      {hand.length > 0 && (
        <div>
          <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: "0.5rem 0" }}>Play a card:</p>
          <div style={styles.actionRow}>
            {hand.map((card: any) => (
              <button
                key={card.id}
                style={{
                  ...styles.actionBtn,
                  background: card.cost <= (player?.currentMana ?? 0) ? "#3b82f6" : "#475569",
                  opacity: card.cost <= (player?.currentMana ?? 0) ? 1 : 0.5,
                }}
                onClick={() => dispatch("playCard", { cardId: card.id })}
                disabled={card.cost > (player?.currentMana ?? 0)}
              >
                {card.name} ({card.cost}) [{card.attack}/{card.health}]
              </button>
            ))}
          </div>
        </div>
      )}

      {board.length > 0 && (
        <div>
          <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: "0.5rem 0" }}>Attack with:</p>
          <div style={styles.actionRow}>
            {board
              .filter((e: any) => !e.hasAttacked && !e.summoningSickness)
              .map((entity: any) => (
                <div key={entity.card.id} style={{ display: "flex", gap: 4 }}>
                  <button
                    style={{ ...styles.actionBtn, background: "#dc2626" }}
                    onClick={() =>
                      dispatch("attack", {
                        attackerId: entity.card.id,
                        targetId: "face",
                      })
                    }
                  >
                    {entity.card.name} → Face
                  </button>
                  {opponentBoard.map((target: any) => (
                    <button
                      key={target.card.id}
                      style={{ ...styles.actionBtn, background: "#f59e0b" }}
                      onClick={() =>
                        dispatch("attack", {
                          attackerId: entity.card.id,
                          targetId: target.card.id,
                        })
                      }
                    >
                      {entity.card.name} → {target.card.name}
                    </button>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}

      <button
        style={{ ...styles.actionBtn, background: "#6366f1", marginTop: "0.5rem" }}
        onClick={() => dispatch("endTurn")}
      >
        End Turn
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem" },
  statusBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "#1e293b", borderRadius: 8, padding: "0.8rem 1rem",
    border: "1px solid #334155",
  },
  statusLeft: { display: "flex", gap: "1rem" },
  statusRight: {},
  phase: { fontSize: "0.85rem", color: "#94a3b8" },
  stage: { fontSize: "0.85rem", color: "#64748b" },
  turnBadge: {
    fontSize: "0.8rem", color: "#fff", padding: "0.3rem 0.7rem",
    borderRadius: 20, fontWeight: 600,
  },
  error: {
    background: "#450a0a", color: "#fca5a5", padding: "0.6rem 1rem",
    borderRadius: 8, fontSize: "0.85rem",
  },
  result: {
    background: "#14532d", color: "#86efac", padding: "1rem",
    borderRadius: 8, textAlign: "center",
  },
  stateView: { background: "#1e293b", borderRadius: 8, padding: "0.8rem", border: "1px solid #334155" },
  detailsSummary: { cursor: "pointer", color: "#64748b", fontSize: "0.8rem" },
  pre: { fontSize: "0.75rem", color: "#94a3b8", overflow: "auto", maxHeight: 300, marginTop: "0.5rem" },
  actions: {
    background: "#1e293b", borderRadius: 8, padding: "1rem",
    border: "1px solid #334155",
  },
  actionRow: { display: "flex", flexWrap: "wrap", gap: "0.5rem" },
  actionCol: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  actionBtn: {
    background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6,
    padding: "0.5rem 0.8rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 500,
  },
};
