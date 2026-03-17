import type { PlayerId } from "@croupier/core";
import type { Card, CardDefinition, TrustBankState, TurnEvent } from "./types.js";

/**
 * 28 card definitions for Trust Bank.
 *
 * Categories:
 * - trust (信頼構築): Gain trust points
 * - crisis (信頼危機): Forced immediate play, typically negative
 * - attack (攻撃): Reduce target's trust points
 * - repair (修復): Restore trust points to self or target
 * - relationship (関係): Special effects involving multiple players
 */
export const CARD_DEFINITIONS: CardDefinition[] = [
  // ===== TRUST (信頼構築) x6 =====
  {
    id: 1,
    name: "約束を守る",
    category: "trust",
    effects: [{ target: "self", points: 3 }],
    requiresTarget: false,
    description: "自分の信頼ポイント+3",
  },
  {
    id: 2,
    name: "深い絆",
    category: "trust",
    effects: [{ target: "self", points: 5 }],
    requiresTarget: false,
    description: "自分の信頼ポイント+5",
  },
  {
    id: 3,
    name: "小さな親切",
    category: "trust",
    effects: [{ target: "self", points: 2 }],
    requiresTarget: false,
    description: "自分の信頼ポイント+2",
  },
  {
    id: 4,
    name: "誠実な対応",
    category: "trust",
    effects: [{ target: "self", points: 4 }],
    requiresTarget: false,
    description: "自分の信頼ポイント+4",
  },
  {
    id: 5,
    name: "賭けに出る",
    category: "trust",
    effects: [{ target: "self", points: 4, coinFlip: true }],
    requiresTarget: false,
    special: "coinFlip",
    description: "コイントス: 成功+4, 失敗-2",
  },
  {
    id: 6,
    name: "地道な努力",
    category: "trust",
    effects: [{ target: "self", points: 3 }],
    requiresTarget: false,
    description: "自分の信頼ポイント+3",
  },

  // ===== CRISIS (信頼危機) x4 =====
  {
    id: 7,
    name: "失言",
    category: "crisis",
    effects: [{ target: "self", points: -3 }],
    requiresTarget: false,
    description: "自分の信頼ポイント-3（即時発動）",
  },
  {
    id: 8,
    name: "連鎖する不信",
    category: "crisis",
    effects: [{ target: "self", points: -2 }],
    requiresTarget: false,
    special: "consecutive",
    description: "自分の信頼ポイント-2。連続なら-4",
  },
  {
    id: 9,
    name: "誤解",
    category: "crisis",
    effects: [{ target: "self", points: -2 }],
    requiresTarget: false,
    description: "自分の信頼ポイント-2（即時発動）",
  },
  {
    id: 10,
    name: "大失態",
    category: "crisis",
    effects: [{ target: "self", points: -4 }],
    requiresTarget: false,
    description: "自分の信頼ポイント-4（即時発動）",
  },

  // ===== ATTACK (攻撃) x8 =====
  {
    id: 11,
    name: "信頼攻撃",
    category: "attack",
    effects: [{ target: "target", points: -3 }],
    requiresTarget: true,
    description: "対象の信頼ポイント-3",
  },
  {
    id: 12,
    name: "責任転嫁",
    category: "crisis",
    effects: [{ target: "target", points: -3 }, { target: "self", points: 2 }],
    requiresTarget: true,
    special: "crisisWithTarget",
    description: "対象-3, 自分+2（危機・即時発動）",
  },
  {
    id: 13,
    name: "裏切り",
    category: "attack",
    effects: [{ target: "target", points: -4 }],
    requiresTarget: true,
    description: "対象の信頼ポイント-4",
  },
  {
    id: 14,
    name: "噂話",
    category: "attack",
    effects: [{ target: "target", points: -2 }],
    requiresTarget: true,
    description: "対象の信頼ポイント-2",
  },
  {
    id: 15,
    name: "陰口",
    category: "attack",
    effects: [{ target: "target", points: -2 }],
    requiresTarget: true,
    description: "対象の信頼ポイント-2",
  },
  {
    id: 16,
    name: "妨害",
    category: "attack",
    effects: [{ target: "target", points: -3 }],
    requiresTarget: true,
    description: "対象の信頼ポイント-3",
  },
  {
    id: 17,
    name: "全体攻撃",
    category: "attack",
    effects: [{ target: "all", points: -2 }],
    requiresTarget: false,
    description: "自分以外全員の信頼ポイント-2",
  },
  {
    id: 18,
    name: "批判",
    category: "attack",
    effects: [{ target: "target", points: -3 }],
    requiresTarget: true,
    description: "対象の信頼ポイント-3",
  },

  // ===== REPAIR (修復) x6 =====
  {
    id: 19,
    name: "信頼修復",
    category: "repair",
    effects: [{ target: "self", points: 3 }],
    requiresTarget: false,
    description: "自分の信頼ポイント+3",
  },
  {
    id: 20,
    name: "和解",
    category: "repair",
    effects: [{ target: "target", points: 2 }, { target: "self", points: 2 }],
    requiresTarget: true,
    description: "自分+2, 対象+2",
  },
  {
    id: 21,
    name: "反省",
    category: "repair",
    effects: [{ target: "self", points: 4 }],
    requiresTarget: false,
    special: "conditionalBonus",
    description: "直近2ターン内に危機/攻撃を受けていたら+4, それ以外+2",
  },
  {
    id: 22,
    name: "謝罪",
    category: "repair",
    effects: [{ target: "target", points: 3 }],
    requiresTarget: true,
    description: "対象の信頼ポイント+3",
  },
  {
    id: 23,
    name: "応援",
    category: "repair",
    effects: [{ target: "target", points: 2 }, { target: "self", points: 1 }],
    requiresTarget: true,
    description: "対象+2, 自分+1",
  },
  {
    id: 24,
    name: "全体修復",
    category: "repair",
    effects: [{ target: "all", points: 1 }],
    requiresTarget: false,
    description: "全員の信頼ポイント+1（自分含む）",
  },

  // ===== RELATIONSHIP (関係) x4 =====
  {
    id: 25,
    name: "信頼交換",
    category: "relationship",
    effects: [{ target: "target", points: -2 }, { target: "self", points: 2 }],
    requiresTarget: true,
    description: "対象から2ポイント奪う",
  },
  {
    id: 26,
    name: "協力関係",
    category: "relationship",
    effects: [{ target: "target", points: 3 }, { target: "self", points: 3 }],
    requiresTarget: true,
    description: "自分と対象に+3ずつ",
  },
  {
    id: 27,
    name: "疑惑",
    category: "relationship",
    effects: [{ target: "target", points: -1 }, { target: "self", points: -1 }],
    requiresTarget: true,
    description: "自分と対象に-1ずつ",
  },
  {
    id: 28,
    name: "公表",
    category: "relationship",
    effects: [],
    requiresTarget: false,
    special: "redistribute",
    description: "最高者-1, 最低者+1（タイは全員適用）",
  },
];

/** Get a card definition by ID */
export function getCardDefinition(id: number): CardDefinition {
  const def = CARD_DEFINITIONS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown card definition: ${id}`);
  return def;
}

/** Create a deck of cards (one per definition). Uses custom definitions if provided. */
export function createDeck(defs?: CardDefinition[]): Card[] {
  const definitions = defs ?? CARD_DEFINITIONS;
  return definitions.map((def) => ({
    id: `card-${def.id}`,
    definitionId: def.id,
  }));
}

/**
 * Check if card21 (反省) gets the full bonus.
 * Condition: player was attacked or hit by withdrawal in the last 2 turns.
 */
export function checkCard21Condition(
  turnHistory: TurnEvent[],
  playerId: PlayerId,
): boolean {
  const recentEvents = turnHistory.slice(-8); // generous window
  let count = 0;
  for (let i = recentEvents.length - 1; i >= 0 && count < 2; i--) {
    const ev = recentEvents[i];
    // Count turns by other players
    if (ev.playerId !== playerId) {
      count++;
      // Check if this player was targeted by attack/withdrawal
      if (
        (ev.category === "attack" || ev.category === "crisis") &&
        ev.targetPlayerId === playerId
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Resolve card effects and apply point changes.
 * Returns a map of playerId -> point change for logging.
 */
export function resolveCardEffects(
  game: TrustBankState,
  playerId: PlayerId,
  def: CardDefinition,
  targetId: PlayerId | null,
  allPlayerIds: PlayerId[],
  coinFlipResult?: boolean,
): Record<PlayerId, number> {
  const changes: Record<PlayerId, number> = {};

  const addChange = (pid: PlayerId, pts: number) => {
    if (game.players[pid].eliminated) return;
    changes[pid] = (changes[pid] || 0) + pts;
  };

  // Special: card28 (公表) — redistribute
  if (def.special === "redistribute") {
    const alive = allPlayerIds.filter((p) => !game.players[p].eliminated);
    const points = alive.map((p) => game.players[p].trustPoints);
    const maxPt = Math.max(...points);
    const minPt = Math.min(...points);

    if (maxPt !== minPt) {
      for (const p of alive) {
        if (game.players[p].trustPoints === maxPt) addChange(p, -1);
        if (game.players[p].trustPoints === minPt) addChange(p, 1);
      }
    }
    return changes;
  }

  // Special: card21 (反省) — conditional bonus
  if (def.special === "conditionalBonus") {
    const hasCondition = checkCard21Condition(game.turnHistory, playerId);
    addChange(playerId, hasCondition ? 4 : 2);
    return changes;
  }

  // Special: card8 (連鎖する不信) — consecutive multiplier
  if (def.special === "consecutive") {
    const lastEvent = game.turnHistory.length > 0
      ? game.turnHistory[game.turnHistory.length - 1]
      : null;
    const isConsecutive =
      lastEvent &&
      lastEvent.playerId === playerId &&
      lastEvent.category === "crisis";
    addChange(playerId, isConsecutive ? -4 : -2);
    return changes;
  }

  // Special: card5 (賭けに出る) — coin flip
  if (def.special === "coinFlip") {
    addChange(playerId, coinFlipResult ? 4 : -2);
    return changes;
  }

  // Normal effect resolution
  for (const effect of def.effects) {
    switch (effect.target) {
      case "self":
        addChange(playerId, effect.points);
        break;
      case "target":
        if (targetId) {
          addChange(targetId, effect.points);
        }
        break;
      case "all":
        // For attack "all" = everyone except self; for repair "all" = everyone including self
        if (def.category === "attack") {
          for (const p of allPlayerIds) {
            if (p !== playerId) addChange(p, effect.points);
          }
        } else {
          for (const p of allPlayerIds) {
            addChange(p, effect.points);
          }
        }
        break;
    }
  }

  return changes;
}

/** Apply point changes to game state. Returns list of newly eliminated players. */
export function applyPointChanges(
  game: TrustBankState,
  changes: Record<PlayerId, number>,
): PlayerId[] {
  const eliminated: PlayerId[] = [];

  for (const [pid, delta] of Object.entries(changes)) {
    game.players[pid].trustPoints += delta;
    if (game.players[pid].trustPoints <= 0 && !game.players[pid].eliminated) {
      game.players[pid].eliminated = true;
      game.players[pid].trustPoints = 0;
      eliminated.push(pid);
    }
  }

  return eliminated;
}
