import type { PlayerId } from "@croupier/core";
import type {
  MissionDefinition,
  MissionDifficulty,
  MissionProgress,
  TrustBankState,
  TurnEvent,
} from "./types.js";

export const BONUS_BY_DIFFICULTY: Record<MissionDifficulty, number> = {
  easy: 3,
  normal: 5,
  hard: 7,
};

export const MISSION_DEFINITIONS: MissionDefinition[] = [
  // ===== 行動系 (4種) =====
  {
    id: "M01",
    name: "攻撃の達人",
    description: "攻撃カードを3回使う",
    difficulty: "normal",
    bonus: BONUS_BY_DIFFICULTY.normal,
  },
  {
    id: "M02",
    name: "連続する危機",
    description: "危機カードを連続2回引く（ドロー時）",
    difficulty: "hard",
    bonus: BONUS_BY_DIFFICULTY.hard,
  },
  {
    id: "M03",
    name: "執着",
    description: "同じプレイヤーを3回攻撃する",
    difficulty: "normal",
    bonus: BONUS_BY_DIFFICULTY.normal,
  },
  {
    id: "M04",
    name: "修繕屋",
    description: "修復カードを4回使う",
    difficulty: "hard",
    bonus: BONUS_BY_DIFFICULTY.hard,
  },
  // ===== 状態系 (4種) =====
  {
    id: "M05",
    name: "平和主義",
    description: "全員のpt差を3以内にする（チェック時点）",
    difficulty: "hard",
    bonus: BONUS_BY_DIFFICULTY.hard,
  },
  {
    id: "M06",
    name: "どん底からの復活",
    description: "自分のptが5以下になった後、12以上に戻す",
    difficulty: "normal",
    bonus: BONUS_BY_DIFFICULTY.normal,
  },
  {
    id: "M07",
    name: "頂点",
    description: "自分が単独最高ptになる",
    difficulty: "easy",
    bonus: BONUS_BY_DIFFICULTY.easy,
  },
  {
    id: "M08",
    name: "均衡",
    description: "他プレイヤー1人と同じptになる",
    difficulty: "easy",
    bonus: BONUS_BY_DIFFICULTY.easy,
  },
  // ===== サバイバル系 (4種) =====
  {
    id: "M09",
    name: "無傷",
    description: "3ターン連続で攻撃を受けない",
    difficulty: "normal",
    bonus: BONUS_BY_DIFFICULTY.normal,
  },
  {
    id: "M10",
    name: "不屈",
    description: "攻撃を4回受けて生き残る",
    difficulty: "hard",
    bonus: BONUS_BY_DIFFICULTY.hard,
  },
  {
    id: "M11",
    name: "復活の狼煙",
    description: "ptが3以下になった後、次ターンで8以上に戻す",
    difficulty: "hard",
    bonus: BONUS_BY_DIFFICULTY.hard,
  },
  {
    id: "M12",
    name: "最後の生存者",
    description: "他プレイヤーが1人以上脱落した状態で生き残る",
    difficulty: "easy",
    bonus: BONUS_BY_DIFFICULTY.easy,
  },
];

/** Get a mission definition by ID */
export function getMissionDefinition(id: string): MissionDefinition {
  const def = MISSION_DEFINITIONS.find((m) => m.id === id);
  if (!def) throw new Error(`Unknown mission: ${id}`);
  return def;
}

/** Create a shuffled list of mission IDs */
export function createMissionDeck(): string[] {
  return MISSION_DEFINITIONS.map((m) => m.id);
}

/** Initialize empty mission progress */
export function initMissionProgress(missionId: string): MissionProgress {
  return {
    missionId,
    completed: false,
    attackCount: 0,
    consecutiveWithdrawals: 0,
    targetAttackCount: {},
    repairCount: 0,
    wasBelow5: false,
    wasBelow3: false,
    turnsWithoutAttack: 0,
    attacksReceived: 0,
  };
}

/**
 * Update mission progress after a card is played.
 * Called for the acting player with the event details.
 */
export function updateMissionProgress(
  progress: MissionProgress,
  event: TurnEvent,
  game: TrustBankState,
  playerId: PlayerId,
): void {
  if (progress.completed) return;

  // Track attacks made by this player
  if (event.playerId === playerId && event.category === "attack") {
    progress.attackCount++;
    if (event.targetPlayerId) {
      progress.targetAttackCount[event.targetPlayerId] =
        (progress.targetAttackCount[event.targetPlayerId] || 0) + 1;
    }
  }

  // Track consecutive withdrawals drawn
  if (event.playerId === playerId && event.category === "crisis") {
    progress.consecutiveWithdrawals++;
  } else if (event.playerId === playerId) {
    progress.consecutiveWithdrawals = 0;
  }

  // Track repair usage
  if (event.playerId === playerId && event.category === "repair") {
    progress.repairCount++;
  }

  // Track point thresholds
  const myPoints = game.players[playerId]?.trustPoints ?? 0;
  if (myPoints <= 5) progress.wasBelow5 = true;
  if (myPoints <= 3) progress.wasBelow3 = true;
}

/**
 * Update survival-related progress for a player who was attacked.
 * Called for each target of an attack.
 */
export function updateMissionProgressForAttackReceived(
  progress: MissionProgress,
): void {
  if (progress.completed) return;
  progress.attacksReceived++;
  progress.turnsWithoutAttack = 0;
}

/**
 * Increment turns-without-attack counter at end of each turn
 * for players who were NOT attacked this turn.
 */
export function incrementTurnsWithoutAttack(
  progress: MissionProgress,
): void {
  if (progress.completed) return;
  progress.turnsWithoutAttack++;
}

/**
 * Check if a mission is completed.
 * Returns true if the mission condition is met.
 */
export function checkMissionCompletion(
  missionId: string,
  progress: MissionProgress,
  game: TrustBankState,
  playerId: PlayerId,
): boolean {
  if (progress.completed) return false;

  const alive = game.playerOrder.filter((p) => !game.players[p].eliminated);
  const myPoints = game.players[playerId]?.trustPoints ?? 0;

  switch (missionId) {
    // 行動系
    case "M01": // 攻撃の達人: 攻撃カードを3回使う
      return progress.attackCount >= 3;

    case "M02": // 連続する危機: 危機カードを連続2回引く
      return progress.consecutiveWithdrawals >= 2;

    case "M03": // 執着: 同じプレイヤーを3回攻撃する
      return Object.values(progress.targetAttackCount).some((c) => c >= 3);

    case "M04": // 修繕屋: 修復カードを4回使う
      return progress.repairCount >= 4;

    // 状態系
    case "M05": { // 平和主義: 全員のpt差を3以内
      const points = alive.map((p) => game.players[p].trustPoints);
      if (points.length < 2) return false;
      const maxPt = Math.max(...points);
      const minPt = Math.min(...points);
      return maxPt - minPt <= 3;
    }

    case "M06": // どん底からの復活: 5以下→12以上
      return progress.wasBelow5 && myPoints >= 12;

    case "M07": { // 頂点: 単独最高pt
      const others = alive.filter((p) => p !== playerId);
      return others.length > 0 && others.every((p) => game.players[p].trustPoints < myPoints);
    }

    case "M08": { // 均衡: 他プレイヤー1人と同じpt
      const others = alive.filter((p) => p !== playerId);
      return others.some((p) => game.players[p].trustPoints === myPoints);
    }

    // サバイバル系
    case "M09": // 無傷: 3ターン連続で攻撃を受けない
      return progress.turnsWithoutAttack >= 3;

    case "M10": // 不屈: 攻撃を4回受けて生き残る
      return progress.attacksReceived >= 4 && !game.players[playerId].eliminated;

    case "M11": // 復活の狼煙: 3以下→次ターン8以上
      return progress.wasBelow3 && myPoints >= 8;

    case "M12": { // 最後の生存者: 他プレイヤーが1人以上脱落
      const eliminated = game.playerOrder.filter(
        (p) => p !== playerId && game.players[p].eliminated,
      );
      return eliminated.length >= 1 && !game.players[playerId].eliminated;
    }

    default:
      return false;
  }
}

/**
 * Check all players' missions and handle completions.
 * Returns list of players who just completed their missions.
 */
export function checkAllMissions(game: TrustBankState): PlayerId[] {
  const completed: PlayerId[] = [];

  for (const pid of game.playerOrder) {
    const player = game.players[pid];
    if (player.eliminated || player.missionProgress.completed) continue;

    if (checkMissionCompletion(player.mission, player.missionProgress, game, pid)) {
      player.missionProgress.completed = true;
      const missionDef = getMissionDefinition(player.mission);

      // Award bonus points
      player.trustPoints += missionDef.bonus;

      // Open (reveal) the mission to all players
      game.openedMissions[pid] = {
        missionId: missionDef.id,
        name: missionDef.name,
        description: missionDef.description,
        bonus: missionDef.bonus,
      };

      completed.push(pid);
    }
  }

  return completed;
}
