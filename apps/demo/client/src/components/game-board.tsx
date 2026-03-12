import { useRef, useEffect, useState } from "react";
import type { PhaseGraph } from "@croupier/core";
import type { ActionLogEntry, GameStateData } from "../hooks/use-game-state.js";
import { useInspector } from "../hooks/use-inspector.js";
import { GenericDisplay } from "./generic-display.js";
import { HoldemRichUI } from "../games/texas-holdem/index.js";
import { PlanningPokerRichUI } from "../games/planning-poker/index.js";
import { ValuesCardRichUI } from "../games/values-card/index.js";
import { TCGRichUI } from "../games/digital-tcg/index.js";
import { TrustBankRichUI } from "../games/trust-bank/index.js";

export type UIMode = "generic" | "rich";

interface GameBoardProps {
  gameId: string;
  gameState: GameStateData;
  dispatch: (action: string, payload?: unknown) => void;
  lastError: string | null;
  uiMode?: UIMode;
  onLeave?: () => void;
}

export function GameBoard({
  gameId,
  gameState,
  dispatch,
  lastError,
  uiMode = "generic",
  onLeave,
}: GameBoardProps) {
  // Rich UI for Texas Hold'em
  if (uiMode === "rich" && gameId === "texas-holdem") {
    return (
      <HoldemRichUI
        gameState={gameState}
        dispatch={dispatch}
        lastError={lastError}
        onLeave={onLeave}
      />
    );
  }
  // Rich UI for Planning Poker
  if (uiMode === "rich" && gameId === "planning-poker") {
    return (
      <PlanningPokerRichUI
        gameState={gameState}
        dispatch={dispatch}
        lastError={lastError}
        onLeave={onLeave}
      />
    );
  }
  // Rich UI for Values Card
  if (uiMode === "rich" && gameId === "values-card") {
    return (
      <ValuesCardRichUI
        gameState={gameState}
        dispatch={dispatch}
        lastError={lastError}
        onLeave={onLeave}
      />
    );
  }
  // Rich UI for Digital TCG
  if (uiMode === "rich" && gameId === "digital-tcg") {
    return (
      <TCGRichUI
        gameState={gameState}
        dispatch={dispatch}
        lastError={lastError}
        onLeave={onLeave}
      />
    );
  }
  // Rich UI for Trust Bank
  if (uiMode === "rich" && gameId === "trust-bank") {
    return (
      <TrustBankRichUI
        gameState={gameState}
        dispatch={dispatch}
        lastError={lastError}
        onLeave={onLeave}
      />
    );
  }
  const { engineState, playerView, playerId } = gameState;
  const isMyTurn = Array.isArray(engineState.currentPlayers)
    ? engineState.currentPlayers.includes(playerId)
    : engineState.currentPlayers === playerId;

  // State Machine Inspector
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [phaseGraph, setPhaseGraph] = useState<PhaseGraph | null>(null);

  // Fetch phase graph once per gameId
  useEffect(() => {
    fetch(`/api/games/${gameId}/phase-graph`)
      .then((r) => r.json())
      .then((data) => setPhaseGraph(data))
      .catch(() => setPhaseGraph(null));
  }, [gameId]);

  // Connect inspector — opens Stately Inspector in a popup window
  useInspector(phaseGraph, engineState, inspectorOpen);

  return (
    <div style={styles.layout}>
      {/* Main content */}
      <div style={styles.main}>
        {/* Status Bar */}
        <div style={styles.statusBar}>
          <div style={styles.statusLeft}>
            <span style={styles.phase}>Phase: {engineState.phase}</span>
            {engineState.stage && (
              <span style={styles.stage}>Stage: {engineState.stage}</span>
            )}
          </div>
          <div style={styles.statusRight}>
            <button
              style={{
                ...styles.inspectorBtn,
                background: inspectorOpen ? "#6366f1" : "#334155",
              }}
              onClick={() => setInspectorOpen((v) => !v)}
            >
              {inspectorOpen ? "Inspector ON" : "State Machine"}
            </button>
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
            {onLeave && (
              <button style={styles.lobbyBtn} onClick={onLeave}>
                Back to Lobby
              </button>
            )}
          </div>
        )}

        {/* Game state display */}
        <GenericDisplay playerView={playerView} playerId={playerId} engineState={engineState} />

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

      {/* Right sidebar: Event Log + Raw State */}
      <div style={styles.sidebar}>
        <EventLog entries={gameState.actionLog ?? []} currentPlayerId={playerId} />
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
      </div>
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
    case "trust-bank":
      return <TrustBankActions pv={playerView} dispatch={dispatch} pid={playerId} es={engineState} />;
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

function TrustBankActions({
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
  const me = pv.players?.[pid];
  const hand = me?.hand ?? [];

  const categoryColors: Record<string, string> = {
    trust: "#22c55e",
    crisis: "#f59e0b",
    attack: "#ef4444",
    repair: "#3b82f6",
    relationship: "#a855f7",
  };

  // Stage: selectCard — pick a card from hand
  if (es.stage === "selectCard") {
    return (
      <div style={styles.actionCol}>
        <p style={{ color: "#94a3b8", marginBottom: "0.5rem" }}>手札からカードを選んでプレイ:</p>
        <div style={styles.actionRow}>
          {hand.map((card: any) => (
            <button
              key={card.id}
              style={{
                ...styles.actionBtn,
                background: categoryColors[card.category] || "#3b82f6",
              }}
              onClick={() => dispatch("selectCard", { cardId: card.id })}
            >
              {card.name}
              <span style={{ fontSize: "0.65rem", display: "block", opacity: 0.8 }}>
                {card.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Stage: selectTarget — choose target player
  if (es.stage === "selectTarget") {
    const targets = (pv.playerOrder ?? []).filter(
      (p: string) => p !== pid && !pv.players?.[p]?.eliminated,
    );
    return (
      <div style={styles.actionCol}>
        <p style={{ color: "#94a3b8", marginBottom: "0.5rem" }}>
          対象プレイヤーを選択:
          {pv.selectedCard && (
            <span style={{ color: "#e2e8f0", marginLeft: "0.5rem" }}>
              ({pv.selectedCard.name})
            </span>
          )}
        </p>
        <div style={styles.actionRow}>
          {targets.map((t: string) => (
            <button
              key={t}
              style={{ ...styles.actionBtn, background: "#ef4444" }}
              onClick={() => dispatch("selectTarget", { targetPlayerId: t })}
            >
              {t} (信頼: {pv.players?.[t]?.trustPoints ?? "?"})
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Stage: resolveCard — confirm play (no target needed)
  if (es.stage === "resolveCard") {
    return (
      <div style={styles.actionCol}>
        <p style={{ color: "#94a3b8", marginBottom: "0.5rem" }}>
          カードをプレイ:
          {pv.selectedCard && (
            <span style={{ color: "#e2e8f0", marginLeft: "0.5rem" }}>
              {pv.selectedCard.name} — {pv.selectedCard.description}
            </span>
          )}
        </p>
        <div style={styles.actionRow}>
          <button
            style={{ ...styles.actionBtn, background: "#22c55e" }}
            onClick={() => dispatch("confirmPlay")}
          >
            プレイ確定
          </button>
        </div>
      </div>
    );
  }

  // Stage: drawCard — draw from deck
  if (es.stage === "drawCard") {
    return (
      <div style={styles.actionRow}>
        <button
          style={styles.actionBtn}
          onClick={() => dispatch("drawCard")}
          disabled={pv.deckCount === 0}
        >
          カードを引く (残り {pv.deckCount})
        </button>
      </div>
    );
  }

  // Stage: withdrawalForced — must play the withdrawal card
  if (es.stage === "withdrawalForced") {
    const drawnCard = pv.drawnCard;
    const requiresTarget = drawnCard?.requiresTarget;
    const targets = (pv.playerOrder ?? []).filter(
      (p: string) => p !== pid && !pv.players?.[p]?.eliminated,
    );

    return (
      <div style={styles.actionCol}>
        <p style={{ color: "#f59e0b", marginBottom: "0.5rem", fontWeight: 600 }}>
          信頼危機カード発動！
          {drawnCard && (
            <span style={{ fontWeight: 400, marginLeft: "0.5rem" }}>
              {drawnCard.name} — {drawnCard.description}
            </span>
          )}
        </p>
        {requiresTarget ? (
          <div style={styles.actionRow}>
            {targets.map((t: string) => (
              <button
                key={t}
                style={{ ...styles.actionBtn, background: "#f59e0b" }}
                onClick={() => dispatch("playWithdrawal", { targetPlayerId: t })}
              >
                {t} (信頼: {pv.players?.[t]?.trustPoints ?? "?"})
              </button>
            ))}
          </div>
        ) : (
          <div style={styles.actionRow}>
            <button
              style={{ ...styles.actionBtn, background: "#f59e0b" }}
              onClick={() => dispatch("playWithdrawal")}
            >
              危機を受け入れる
            </button>
          </div>
        )}
      </div>
    );
  }

  return <p style={{ color: "#94a3b8" }}>待機中...</p>;
}

// ============================================================
// Event Log
// ============================================================

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatPayload(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "object") {
    const entries = Object.entries(payload as Record<string, unknown>);
    if (entries.length === 0) return "";
    return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
  }
  return String(payload);
}

export function EventLog({ entries, currentPlayerId }: { entries: ActionLogEntry[]; currentPlayerId: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  // Track phase transitions to insert separator labels
  let lastPhase = "";
  let lastStage = "";

  const rows: React.ReactNode[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const phaseChanged = e.phase !== lastPhase;
    const stageChanged = e.stage !== lastStage;

    if (phaseChanged || stageChanged) {
      rows.push(
        <div key={`sep-${i}`} style={logStyles.phaseSep}>
          {e.phase}{e.stage ? ` / ${e.stage}` : ""}
        </div>,
      );
      lastPhase = e.phase;
      lastStage = e.stage ?? "";
    }

    const isBot = e.playerId.startsWith("bot:");
    const isMe = e.playerId === currentPlayerId;
    const displayName = isBot ? e.playerId.slice(4) : e.playerId;
    const payloadStr = formatPayload(e.payload);

    rows.push(
      <div key={i} style={{ ...logStyles.entry, background: isMe ? "#1e3a5f22" : undefined }}>
        <span style={logStyles.time}>{formatTime(e.timestamp)}</span>
        <span style={{
          ...logStyles.player,
          color: isMe ? "#60a5fa" : isBot ? "#f59e0b" : "#e2e8f0",
        }}>
          {displayName}
          {isBot && <span style={logStyles.botTag}>Bot</span>}
        </span>
        <span style={logStyles.action}>{e.action}</span>
        {payloadStr && <span style={logStyles.payload}>{payloadStr}</span>}
      </div>,
    );
  }

  return (
    <div style={logStyles.container}>
      <div style={logStyles.header}>
        <span style={logStyles.headerTitle}>Event Log</span>
        <span style={logStyles.headerCount}>{entries.length}</span>
      </div>
      <div ref={scrollRef} style={logStyles.scrollArea}>
        {rows.length > 0 ? rows : (
          <div style={logStyles.empty}>No actions yet</div>
        )}
      </div>
    </div>
  );
}

const logStyles: Record<string, React.CSSProperties> = {
  container: {
    background: "#1e293b",
    borderRadius: 8,
    border: "1px solid #334155",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
    flex: 1,
    minHeight: 0,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.5rem 0.8rem",
    borderBottom: "1px solid #334155",
    flexShrink: 0,
  },
  headerTitle: {
    color: "#94a3b8",
    fontSize: "0.8rem",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  headerCount: {
    color: "#64748b",
    fontSize: "0.7rem",
    background: "#0f172a",
    padding: "0.1rem 0.5rem",
    borderRadius: 10,
  },
  scrollArea: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "0.3rem 0",
    minHeight: 0,
  },
  entry: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.25rem 0.8rem",
    fontSize: "0.78rem",
    lineHeight: 1.6,
  },
  time: {
    color: "#475569",
    fontFamily: "monospace",
    fontSize: "0.7rem",
    flexShrink: 0,
  },
  player: {
    fontWeight: 600,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
  },
  botTag: {
    color: "#f59e0b",
    fontSize: "0.6rem",
    fontWeight: 600,
    background: "#422006",
    padding: "0 0.25rem",
    borderRadius: 3,
  },
  action: {
    color: "#22c55e",
    fontFamily: "monospace",
    fontWeight: 500,
  },
  payload: {
    color: "#64748b",
    fontFamily: "monospace",
    fontSize: "0.7rem",
  },
  phaseSep: {
    color: "#8b5cf6",
    fontSize: "0.7rem",
    fontWeight: 600,
    padding: "0.3rem 0.8rem",
    background: "#0f172a",
    borderTop: "1px solid #1e1b4b",
    borderBottom: "1px solid #1e1b4b",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  empty: {
    color: "#475569",
    fontSize: "0.8rem",
    padding: "1rem",
    textAlign: "center" as const,
  },
};


const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: "flex", gap: "1rem", padding: "1rem",
    flex: 1, minHeight: 0, overflow: "hidden",
  },
  main: {
    display: "flex", flexDirection: "column", gap: "1rem",
    flex: 1, minWidth: 0, overflowY: "auto",
  },
  sidebar: {
    width: 300, flexShrink: 0,
    display: "flex", flexDirection: "column",
    gap: "0.5rem", overflow: "hidden",
  },
  statusBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "#1e293b", borderRadius: 8, padding: "0.8rem 1rem",
    border: "1px solid #334155",
  },
  statusLeft: { display: "flex", gap: "1rem" },
  statusRight: { display: "flex", alignItems: "center", gap: "0.5rem" },
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
  lobbyBtn: {
    background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8,
    padding: "0.6rem 1.2rem", cursor: "pointer", fontSize: "0.9rem",
    fontWeight: 600, marginTop: "0.8rem",
  },
  stateView: { background: "#1e293b", borderRadius: 8, padding: "0.8rem", border: "1px solid #334155", flexShrink: 0, overflow: "auto" },
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
  inspectorBtn: {
    color: "#e2e8f0", border: "none", borderRadius: 6,
    padding: "0.3rem 0.7rem", cursor: "pointer", fontSize: "0.75rem",
    fontWeight: 600, marginRight: "0.5rem",
  },
};
