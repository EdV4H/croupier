import type { CSSProperties } from "react";
import { TCGCard, TCGCardBack } from "./tcg-card.js";
import { BoardEntity } from "./board-entity.js";
import { HeroPortrait } from "./hero-portrait.js";
import { ManaBar } from "./mana-bar.js";
import { TimerBar } from "../texas-holdem/timer-bar.js";

interface PlayerData {
  life: number;
  maxMana: number;
  currentMana: number;
  deckCount: number;
  hand: any[];
  board: any[];
  graveyard: any[];
}

interface TCGBoardProps {
  myPlayer: PlayerData;
  opponent: PlayerData;
  isMyTurn: boolean;
  selectedAttacker: string | null;
  onSelectAttacker: (id: string | null) => void;
  onSelectTarget: (id: string) => void;
  onPlayCard: (cardId: string) => void;
  onAttackFace: () => void;
  turnDeadline?: number | null;
}

export function TCGBoard({
  myPlayer,
  opponent,
  isMyTurn,
  selectedAttacker,
  onSelectAttacker,
  onSelectTarget,
  onPlayCard,
  onAttackFace,
  turnDeadline,
}: TCGBoardProps) {
  const attackMode = selectedAttacker != null;

  return (
    <div style={boardContainer}>
      {/* === Opponent zone (top) === */}
      {/* Opponent hand */}
      <div style={handRow}>
        {opponent.hand.map((_: any, i: number) => (
          <TCGCardBack key={i} />
        ))}
      </div>

      {/* Opponent info row: grave + hero + mana */}
      <div style={infoRow}>
        <div style={graveStyle}>Grave: {opponent.graveyard.length}</div>
        <HeroPortrait
          life={opponent.life}
          isTarget={attackMode}
          onClick={attackMode ? onAttackFace : undefined}
        />
        <ManaBar current={opponent.currentMana} max={opponent.maxMana} />
      </div>

      {/* Opponent board */}
      <div style={boardRow}>
        {opponent.board.map((entity: any) => (
          <BoardEntity
            key={entity.card.id}
            name={entity.card.name}
            attack={entity.card.attack}
            currentHealth={entity.currentHealth}
            maxHealth={entity.card.health}
            targetCandidate={attackMode}
            onClick={attackMode ? () => onSelectTarget(entity.card.id) : undefined}
          />
        ))}
        {opponent.board.length === 0 && (
          <div style={emptyBoard}>No creatures</div>
        )}
      </div>

      {/* Center divider with timer */}
      <div style={dividerStyle}>
        <div style={dividerLine} />
        <TimerBar turnDeadline={turnDeadline} />
      </div>

      {/* === Player zone (bottom) === */}
      {/* Player board */}
      <div style={boardRow}>
        {myPlayer.board.map((entity: any) => {
          const canAttack = isMyTurn && !entity.hasAttacked && !entity.summoningSickness;
          const isSelected = selectedAttacker === entity.card.id;
          return (
            <BoardEntity
              key={entity.card.id}
              name={entity.card.name}
              attack={entity.card.attack}
              currentHealth={entity.currentHealth}
              maxHealth={entity.card.health}
              selected={isSelected}
              summoningSickness={entity.summoningSickness}
              hasAttacked={entity.hasAttacked}
              onClick={
                canAttack
                  ? () => onSelectAttacker(isSelected ? null : entity.card.id)
                  : undefined
              }
            />
          );
        })}
        {myPlayer.board.length === 0 && (
          <div style={emptyBoard}>No creatures</div>
        )}
      </div>

      {/* Player info row: grave + hero + mana */}
      <div style={infoRow}>
        <div style={graveStyle}>Grave: {myPlayer.graveyard.length}</div>
        <HeroPortrait life={myPlayer.life} />
        <ManaBar current={myPlayer.currentMana} max={myPlayer.maxMana} />
      </div>

      {/* Player hand */}
      <div style={handRow}>
        {myPlayer.hand.map((card: any) => {
          if (card.hidden) return <TCGCardBack key={Math.random()} />;
          const playable = isMyTurn && !attackMode && card.cost <= myPlayer.currentMana && myPlayer.board.length < 5;
          return (
            <TCGCard
              key={card.id}
              name={card.name}
              cost={card.cost}
              attack={card.attack}
              health={card.health}
              playable={playable}
              dimmed={isMyTurn && !attackMode && card.cost > myPlayer.currentMana}
              onClick={playable ? () => onPlayCard(card.id) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

const boardContainer: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  background: "#1a2332",
  borderRadius: 12,
  border: "1px solid #253545",
  padding: "12px 16px",
};

const handRow: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 6,
  minHeight: 110,
  alignItems: "center",
  flexWrap: "wrap",
};

const infoRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
};

const boardRow: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 8,
  minHeight: 90,
  alignItems: "center",
};

const dividerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: "4px 0",
};

const dividerLine: CSSProperties = {
  width: "90%",
  height: 1,
  background: "#253545",
};

const emptyBoard: CSSProperties = {
  color: "#475569",
  fontSize: "0.75rem",
  fontStyle: "italic",
};

const graveStyle: CSSProperties = {
  fontSize: "0.7rem",
  color: "#94a3b8",
  fontWeight: 600,
  background: "#0f172a",
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid #253545",
};
