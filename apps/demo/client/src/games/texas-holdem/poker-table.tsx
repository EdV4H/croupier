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
    { top: "85%", left: "50%" },  // self bottom center
    { top: "5%",  left: "50%" },  // opponent top
  ],
  3: [
    { top: "85%", left: "50%" },
    { top: "15%", left: "20%" },
    { top: "15%", left: "80%" },
  ],
  4: [
    { top: "85%", left: "50%" },
    { top: "45%", left: "5%" },
    { top: "5%",  left: "50%" },
    { top: "45%", left: "95%" },
  ],
  5: [
    { top: "85%", left: "50%" },
    { top: "60%", left: "5%" },
    { top: "10%", left: "20%" },
    { top: "10%", left: "80%" },
    { top: "60%", left: "95%" },
  ],
  6: [
    { top: "85%", left: "50%" },
    { top: "55%", left: "3%" },
    { top: "10%", left: "18%" },
    { top: "10%", left: "50%" },
    { top: "10%", left: "82%" },
    { top: "55%", left: "97%" },
  ],
  7: [
    { top: "85%", left: "50%" },
    { top: "60%", left: "3%" },
    { top: "20%", left: "8%" },
    { top: "5%",  left: "35%" },
    { top: "5%",  left: "65%" },
    { top: "20%", left: "92%" },
    { top: "60%", left: "97%" },
  ],
  8: [
    { top: "85%", left: "50%" },
    { top: "65%", left: "3%" },
    { top: "30%", left: "3%" },
    { top: "5%",  left: "25%" },
    { top: "5%",  left: "50%" },
    { top: "5%",  left: "75%" },
    { top: "30%", left: "97%" },
    { top: "65%", left: "97%" },
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
              <span style={{ color: "#6ee7b7", fontSize: "0.8rem" }}>
                No community cards yet
              </span>
            )}
          </div>
          <div style={{ color: "#fbbf24", fontSize: "0.95rem", fontWeight: 700 }}>
            Pot: ${pv.pot ?? 0}
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
  background: "radial-gradient(ellipse at center, #065f46, #064e3b 60%, #022c22)",
  borderRadius: "50%",
  border: "6px solid #854d0e",
  boxShadow: "0 0 30px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,0,0,0.3)",
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
