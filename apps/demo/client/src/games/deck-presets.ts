/**
 * Deck presets for each game type.
 * Each preset has a name, description, and the cards/options to pass as gameOptions.
 */

// ============================================================
// Values Card Presets
// ============================================================

interface ValuesCard {
  id: string;
  name: string;
}

export interface ValuesCardPreset {
  id: string;
  name: string;
  description: string;
  cards: ValuesCard[];
}

const ALL_VALUES_CARDS: ValuesCard[] = [
  { id: "v01", name: "誠実さ" }, { id: "v02", name: "挑戦" }, { id: "v03", name: "創造性" },
  { id: "v04", name: "成長" }, { id: "v05", name: "感謝" }, { id: "v06", name: "信頼" },
  { id: "v07", name: "自由" }, { id: "v08", name: "情熱" }, { id: "v09", name: "協力" },
  { id: "v10", name: "責任" }, { id: "v11", name: "尊重" }, { id: "v12", name: "公平" },
  { id: "v13", name: "思いやり" }, { id: "v14", name: "勇気" }, { id: "v15", name: "忍耐" },
  { id: "v16", name: "楽しさ" }, { id: "v17", name: "好奇心" }, { id: "v18", name: "謙虚" },
  { id: "v19", name: "多様性" }, { id: "v20", name: "バランス" }, { id: "v21", name: "健康" },
  { id: "v22", name: "家族" }, { id: "v23", name: "友情" }, { id: "v24", name: "学び" },
  { id: "v25", name: "貢献" }, { id: "v26", name: "正義" }, { id: "v27", name: "平和" },
  { id: "v28", name: "美しさ" }, { id: "v29", name: "ユーモア" }, { id: "v30", name: "冒険" },
  { id: "v31", name: "安定" }, { id: "v32", name: "独立" }, { id: "v33", name: "知恵" },
  { id: "v34", name: "寛容" }, { id: "v35", name: "リーダーシップ" }, { id: "v36", name: "共感" },
  { id: "v37", name: "効率" }, { id: "v38", name: "品質" }, { id: "v39", name: "柔軟性" },
  { id: "v40", name: "誇り" }, { id: "v41", name: "素直さ" }, { id: "v42", name: "節制" },
  { id: "v43", name: "愛情" }, { id: "v44", name: "自律" }, { id: "v45", name: "環境" },
  { id: "v46", name: "伝統" }, { id: "v47", name: "革新" }, { id: "v48", name: "奉仕" },
  { id: "v49", name: "達成感" }, { id: "v50", name: "集中力" }, { id: "v51", name: "直感" },
  { id: "v52", name: "誠意" }, { id: "v53", name: "礼儀" }, { id: "v54", name: "団結" },
  { id: "v55", name: "希望" }, { id: "v56", name: "幸福" }, { id: "v57", name: "調和" },
  { id: "v58", name: "粘り強さ" }, { id: "v59", name: "感性" }, { id: "v60", name: "合理性" },
  { id: "v61", name: "透明性" }, { id: "v62", name: "主体性" }, { id: "v63", name: "利他" },
  { id: "v64", name: "探求心" }, { id: "v65", name: "遊び心" }, { id: "v66", name: "覚悟" },
  { id: "v67", name: "受容" }, { id: "v68", name: "シンプル" }, { id: "v69", name: "つながり" },
  { id: "v70", name: "自然体" },
];

const BUSINESS_VALUES_IDS = [
  "v01", "v02", "v03", "v04", "v06", "v08", "v09", "v10",
  "v11", "v14", "v17", "v24", "v25", "v33", "v35", "v36",
  "v37", "v38", "v39", "v40", "v44", "v47", "v49", "v50",
  "v52", "v53", "v60", "v61", "v62", "v66",
];

const TEAM_VALUES_IDS = [
  "v01", "v05", "v06", "v09", "v11", "v12", "v13", "v16",
  "v18", "v19", "v20", "v22", "v23", "v25", "v27", "v29",
  "v34", "v36", "v41", "v43", "v48", "v54", "v55", "v56",
  "v57", "v63", "v65", "v67", "v69", "v70",
];

export const VALUES_CARD_PRESETS: ValuesCardPreset[] = [
  {
    id: "default",
    name: "デフォルト（全70枚）",
    description: "全てのバリューカードを使用",
    cards: ALL_VALUES_CARDS,
  },
  {
    id: "business",
    name: "ビジネス向け（30枚）",
    description: "リーダーシップ、イノベーション、効率等を中心に厳選",
    cards: ALL_VALUES_CARDS.filter((c) => BUSINESS_VALUES_IDS.includes(c.id)),
  },
  {
    id: "team",
    name: "チームビルディング向け（30枚）",
    description: "協力、信頼、つながり等を中心に厳選",
    cards: ALL_VALUES_CARDS.filter((c) => TEAM_VALUES_IDS.includes(c.id)),
  },
];

// ============================================================
// Trust Bank Presets
// ============================================================

export interface TrustBankCardDef {
  id: number;
  name: string;
  category: string;
  effects: { target: string; points: number; coinFlip?: boolean }[];
  requiresTarget: boolean;
  special?: string;
  description: string;
}

export interface TrustBankPreset {
  id: string;
  name: string;
  description: string;
  cards: TrustBankCardDef[];
}

const ALL_TRUST_BANK_CARDS: TrustBankCardDef[] = [
  // Trust x6
  { id: 1, name: "約束を守る", category: "trust", effects: [{ target: "self", points: 3 }], requiresTarget: false, description: "自分の信頼ポイント+3" },
  { id: 2, name: "深い絆", category: "trust", effects: [{ target: "self", points: 5 }], requiresTarget: false, description: "自分の信頼ポイント+5" },
  { id: 3, name: "小さな親切", category: "trust", effects: [{ target: "self", points: 2 }], requiresTarget: false, description: "自分の信頼ポイント+2" },
  { id: 4, name: "誠実な対応", category: "trust", effects: [{ target: "self", points: 4 }], requiresTarget: false, description: "自分の信頼ポイント+4" },
  { id: 5, name: "賭けに出る", category: "trust", effects: [{ target: "self", points: 4, coinFlip: true }], requiresTarget: false, special: "coinFlip", description: "コイントス: 成功+4, 失敗-2" },
  { id: 6, name: "地道な努力", category: "trust", effects: [{ target: "self", points: 3 }], requiresTarget: false, description: "自分の信頼ポイント+3" },
  // Crisis x4
  { id: 7, name: "失言", category: "crisis", effects: [{ target: "self", points: -3 }], requiresTarget: false, description: "自分の信頼ポイント-3（即時発動）" },
  { id: 8, name: "連鎖する不信", category: "crisis", effects: [{ target: "self", points: -2 }], requiresTarget: false, special: "consecutive", description: "自分の信頼ポイント-2。連続なら-4" },
  { id: 9, name: "誤解", category: "crisis", effects: [{ target: "self", points: -2 }], requiresTarget: false, description: "自分の信頼ポイント-2（即時発動）" },
  { id: 10, name: "大失態", category: "crisis", effects: [{ target: "self", points: -4 }], requiresTarget: false, description: "自分の信頼ポイント-4（即時発動）" },
  // Attack x8
  { id: 11, name: "信頼攻撃", category: "attack", effects: [{ target: "target", points: -3 }], requiresTarget: true, description: "対象の信頼ポイント-3" },
  { id: 12, name: "責任転嫁", category: "crisis", effects: [{ target: "target", points: -3 }, { target: "self", points: 2 }], requiresTarget: true, special: "crisisWithTarget", description: "対象-3, 自分+2（危機・即時発動）" },
  { id: 13, name: "裏切り", category: "attack", effects: [{ target: "target", points: -4 }], requiresTarget: true, description: "対象の信頼ポイント-4" },
  { id: 14, name: "噂話", category: "attack", effects: [{ target: "target", points: -2 }], requiresTarget: true, description: "対象の信頼ポイント-2" },
  { id: 15, name: "陰口", category: "attack", effects: [{ target: "target", points: -2 }], requiresTarget: true, description: "対象の信頼ポイント-2" },
  { id: 16, name: "妨害", category: "attack", effects: [{ target: "target", points: -3 }], requiresTarget: true, description: "対象の信頼ポイント-3" },
  { id: 17, name: "全体攻撃", category: "attack", effects: [{ target: "all", points: -2 }], requiresTarget: false, description: "自分以外全員の信頼ポイント-2" },
  { id: 18, name: "批判", category: "attack", effects: [{ target: "target", points: -3 }], requiresTarget: true, description: "対象の信頼ポイント-3" },
  // Repair x6
  { id: 19, name: "信頼修復", category: "repair", effects: [{ target: "self", points: 3 }], requiresTarget: false, description: "自分の信頼ポイント+3" },
  { id: 20, name: "和解", category: "repair", effects: [{ target: "target", points: 2 }, { target: "self", points: 2 }], requiresTarget: true, description: "自分+2, 対象+2" },
  { id: 21, name: "反省", category: "repair", effects: [{ target: "self", points: 4 }], requiresTarget: false, special: "conditionalBonus", description: "直近2ターン内に危機/攻撃を受けていたら+4, それ以外+2" },
  { id: 22, name: "謝罪", category: "repair", effects: [{ target: "target", points: 3 }], requiresTarget: true, description: "対象の信頼ポイント+3" },
  { id: 23, name: "応援", category: "repair", effects: [{ target: "target", points: 2 }, { target: "self", points: 1 }], requiresTarget: true, description: "対象+2, 自分+1" },
  { id: 24, name: "全体修復", category: "repair", effects: [{ target: "all", points: 1 }], requiresTarget: false, description: "全員の信頼ポイント+1（自分含む）" },
  // Relationship x4
  { id: 25, name: "信頼交換", category: "relationship", effects: [{ target: "target", points: -2 }, { target: "self", points: 2 }], requiresTarget: true, description: "対象から2ポイント奪う" },
  { id: 26, name: "協力関係", category: "relationship", effects: [{ target: "target", points: 3 }, { target: "self", points: 3 }], requiresTarget: true, description: "自分と対象に+3ずつ" },
  { id: 27, name: "疑惑", category: "relationship", effects: [{ target: "target", points: -1 }, { target: "self", points: -1 }], requiresTarget: true, description: "自分と対象に-1ずつ" },
  { id: 28, name: "公表", category: "relationship", effects: [], requiresTarget: false, special: "redistribute", description: "最高者-1, 最低者+1（タイは全員適用）" },
];

const AGGRESSIVE_IDS = [1, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 25, 27];
const COOPERATIVE_IDS = [1, 2, 3, 4, 5, 6, 7, 9, 19, 20, 21, 22, 23, 24, 26, 28, 11, 14];

export const TRUST_BANK_PRESETS: TrustBankPreset[] = [
  {
    id: "default",
    name: "デフォルト（全28枚）",
    description: "全てのカードを使用",
    cards: ALL_TRUST_BANK_CARDS,
  },
  {
    id: "aggressive",
    name: "攻撃重視（20枚）",
    description: "攻撃カード多め、修復カード少なめ",
    cards: ALL_TRUST_BANK_CARDS.filter((c) => AGGRESSIVE_IDS.includes(c.id)),
  },
  {
    id: "cooperative",
    name: "協力重視（18枚）",
    description: "信頼・修復カード多め、攻撃少なめ",
    cards: ALL_TRUST_BANK_CARDS.filter((c) => COOPERATIVE_IDS.includes(c.id)),
  },
];

// ============================================================
// Digital TCG Presets
// ============================================================

export interface TCGCard {
  id: string;
  name: string;
  cost: number;
  attack: number;
  health: number;
  type: string;
}

export interface TCGPreset {
  id: string;
  name: string;
  description: string;
  cards: TCGCard[];
}

const STARTER_DECK: TCGCard[] = [
  { id: "c01", name: "Goblin", cost: 1, attack: 1, health: 1, type: "creature" },
  { id: "c02", name: "Goblin", cost: 1, attack: 1, health: 1, type: "creature" },
  { id: "c03", name: "Soldier", cost: 2, attack: 2, health: 2, type: "creature" },
  { id: "c04", name: "Soldier", cost: 2, attack: 2, health: 2, type: "creature" },
  { id: "c05", name: "Knight", cost: 3, attack: 3, health: 3, type: "creature" },
  { id: "c06", name: "Knight", cost: 3, attack: 3, health: 3, type: "creature" },
  { id: "c07", name: "Dragon", cost: 5, attack: 5, health: 5, type: "creature" },
  { id: "c08", name: "Archer", cost: 2, attack: 2, health: 1, type: "creature" },
  { id: "c09", name: "Archer", cost: 2, attack: 2, health: 1, type: "creature" },
  { id: "c10", name: "Guardian", cost: 4, attack: 2, health: 6, type: "creature" },
];

const RUSH_DECK: TCGCard[] = [
  { id: "c01", name: "Goblin", cost: 1, attack: 1, health: 1, type: "creature" },
  { id: "c02", name: "Goblin", cost: 1, attack: 1, health: 1, type: "creature" },
  { id: "c03", name: "Goblin", cost: 1, attack: 1, health: 1, type: "creature" },
  { id: "c04", name: "Archer", cost: 2, attack: 2, health: 1, type: "creature" },
  { id: "c05", name: "Archer", cost: 2, attack: 2, health: 1, type: "creature" },
  { id: "c06", name: "Archer", cost: 2, attack: 2, health: 1, type: "creature" },
  { id: "c07", name: "Soldier", cost: 2, attack: 2, health: 2, type: "creature" },
  { id: "c08", name: "Soldier", cost: 2, attack: 2, health: 2, type: "creature" },
  { id: "c09", name: "Knight", cost: 3, attack: 3, health: 3, type: "creature" },
  { id: "c10", name: "Knight", cost: 3, attack: 3, health: 3, type: "creature" },
];

const HEAVY_DECK: TCGCard[] = [
  { id: "c01", name: "Guardian", cost: 4, attack: 2, health: 6, type: "creature" },
  { id: "c02", name: "Guardian", cost: 4, attack: 2, health: 6, type: "creature" },
  { id: "c03", name: "Dragon", cost: 5, attack: 5, health: 5, type: "creature" },
  { id: "c04", name: "Dragon", cost: 5, attack: 5, health: 5, type: "creature" },
  { id: "c05", name: "Knight", cost: 3, attack: 3, health: 3, type: "creature" },
  { id: "c06", name: "Knight", cost: 3, attack: 3, health: 3, type: "creature" },
  { id: "c07", name: "Knight", cost: 3, attack: 3, health: 3, type: "creature" },
  { id: "c08", name: "Soldier", cost: 2, attack: 2, health: 2, type: "creature" },
  { id: "c09", name: "Soldier", cost: 2, attack: 2, health: 2, type: "creature" },
  { id: "c10", name: "Goblin", cost: 1, attack: 1, health: 1, type: "creature" },
];

export const TCG_PRESETS: TCGPreset[] = [
  {
    id: "default",
    name: "Starter Deck (10 cards)",
    description: "Balanced starter deck",
    cards: STARTER_DECK,
  },
  {
    id: "rush",
    name: "Rush Deck (10 cards)",
    description: "Low-cost creatures for aggressive play",
    cards: RUSH_DECK,
  },
  {
    id: "heavy",
    name: "Heavy Deck (10 cards)",
    description: "High-cost, high-stat creatures for late game",
    cards: HEAVY_DECK,
  },
];

// ============================================================
// Helper: get all cards for a game (for the "all cards" pool)
// ============================================================

export { ALL_VALUES_CARDS, ALL_TRUST_BANK_CARDS, STARTER_DECK as ALL_TCG_CARDS };
