import type { CSSProperties } from "react";
import { PokerCard } from "./poker-card.js";
import { PlayerSeat } from "./player-seat.js";
import { TimerBar } from "./timer-bar.js";

interface PokerTableProps {
  playerView: any;
  playerId: string;
  turnDeadline?: number | null;
}

/**
 * Seat positions for 2-8 players, expressed as CSS % offsets.
 * Player at index 0 (self) is always at bottom center.
 */
const SEAT_POSITIONS: Record<number, { top: string; left: string }[]> = {
  2: [
    { top: "82%", left: "50%" },  // self bottom center
    { top: "10%", left: "50%" },  // opponent top
  ],
  3: [
    { top: "82%", left: "50%" },
    { top: "18%", left: "22%" },
    { top: "18%", left: "78%" },
  ],
  4: [
    { top: "82%", left: "50%" },
    { top: "48%", left: "12%" },
    { top: "10%", left: "50%" },
    { top: "48%", left: "88%" },
  ],
  5: [
    { top: "82%", left: "50%" },
    { top: "58%", left: "12%" },
    { top: "14%", left: "22%" },
    { top: "14%", left: "78%" },
    { top: "58%", left: "88%" },
  ],
  6: [
    { top: "82%", left: "50%" },
    { top: "52%", left: "12%" },
    { top: "14%", left: "22%" },
    { top: "14%", left: "50%" },
    { top: "14%", left: "78%" },
    { top: "52%", left: "88%" },
  ],
  7: [
    { top: "82%", left: "50%" },
    { top: "58%", left: "12%" },
    { top: "22%", left: "14%" },
    { top: "10%", left: "36%" },
    { top: "10%", left: "64%" },
    { top: "22%", left: "86%" },
    { top: "58%", left: "88%" },
  ],
  8: [
    { top: "82%", left: "50%" },
    { top: "62%", left: "12%" },
    { top: "32%", left: "12%" },
    { top: "10%", left: "28%" },
    { top: "10%", left: "50%" },
    { top: "10%", left: "72%" },
    { top: "32%", left: "88%" },
    { top: "62%", left: "88%" },
  ],
};

function rotateToSelf(order: string[], selfId: string): string[] {
  const idx = order.indexOf(selfId);
  if (idx <= 0) return order;
  return [...order.slice(idx), ...order.slice(0, idx)];
}

export function PokerTable({ playerView, playerId, turnDeadline }: PokerTableProps) {
  const pv = playerView;
  const order: string[] = pv.playerOrder ?? [];
  const rotated = rotateToSelf(order, playerId);
  const count = Math.min(Math.max(rotated.length, 2), 8);
  const seats = SEAT_POSITIONS[count] ?? SEAT_POSITIONS[2];

  // Who's the current player?
  const currentPlayerId = order[pv.currentPlayerIndex] ?? null;

  const communityCards: { suit: string; rank: number }[] = pv.communityCards ?? [];

  return (
    <div style={tableOuterStyle}>
      <div style={tableStyle}>
        {/* Community cards + pot */}
        <div style={centerAreaStyle}>
          <div style={communityRowStyle}>
            {communityCards.map((c, i) => (
              <PokerCard key={i} suit={c.suit} rank={c.rank} size="medium" />
            ))}
            {communityCards.length === 0 && (
              <span style={{ color: "#4a5f73", fontSize: "0.8rem" }}>
                No community cards yet
              </span>
            )}
          </div>
          <div style={{ color: "#d4a843", fontSize: "0.95rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
            POT: ${pv.pot ?? 0}
          </div>
          <TimerBar turnDeadline={turnDeadline} />
        </div>

        {/* Player seats */}
        {rotated.map((pid, i) => {
          if (i >= seats.length) return null;
          const pos = seats[i];
          const p = pv.players?.[pid];
          if (!p) return null;

          const isBot = pid.startsWith("bot:");
          const dealerIdx = pv.dealerPosition ?? 0;
          const isDealer = order[dealerIdx] === pid;

          return (
            <div
              key={pid}
              data-player-id={pid}
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
                isBot={isBot}
                stack={p.stack ?? 0}
                currentBet={p.currentBet ?? 0}
                status={p.status ?? "active"}
                holeCards={p.holeCards ?? []}
                isDealer={isDealer}
                isCurrentTurn={pid === currentPlayerId}
                isMe={pid === playerId}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const tableOuterStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "0.5rem",
};

const tableStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 800,
  aspectRatio: "16 / 10",
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
};

const communityRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
};
