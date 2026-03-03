import type { Card, HandEvaluation, HandRank, Rank } from "./types.js";

/** Convert card rank to evaluation rank (Ace=1 → 14 for comparison) */
function toEvalRank(rank: Rank): number {
  return rank === 1 ? 14 : rank;
}

const HAND_RANK_VALUES: Record<HandRank, number> = {
  "royal-flush": 10,
  "straight-flush": 9,
  "four-of-a-kind": 8,
  "full-house": 7,
  flush: 6,
  straight: 5,
  "three-of-a-kind": 4,
  "two-pair": 3,
  "one-pair": 2,
  "high-card": 1,
};

/** Generate all 5-card combinations from n cards */
function combinations(cards: Card[], k: number): Card[][] {
  if (k === 0) return [[]];
  if (cards.length < k) return [];
  const [first, ...rest] = cards;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

/** Sort cards by rank descending (using evaluation rank) */
function sortByRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => toEvalRank(b.rank) - toEvalRank(a.rank));
}

/** Count occurrences of each rank (keyed by evaluation rank) */
function rankCounts(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const card of cards) {
    const evalRank = toEvalRank(card.rank);
    counts.set(evalRank, (counts.get(evalRank) ?? 0) + 1);
  }
  return counts;
}

/** Check if all cards are the same suit */
function isFlush(cards: Card[]): boolean {
  return cards.every((c) => c.suit === cards[0].suit);
}

/** Check if cards form a straight, return highest eval rank or null */
function straightHighCard(cards: Card[]): number | null {
  const evalRanks = sortByRank(cards).map((c) => toEvalRank(c.rank));
  const unique = [...new Set(evalRanks)];
  if (unique.length !== 5) return null;

  // Normal straight check
  if (unique[0] - unique[4] === 4) return unique[0];

  // Ace-low straight (A,2,3,4,5)
  if (
    unique[0] === 14 &&
    unique[1] === 5 &&
    unique[2] === 4 &&
    unique[3] === 3 &&
    unique[4] === 2
  ) {
    return 5; // 5-high straight
  }

  return null;
}

/** Evaluate a 5-card hand */
function evaluate5(cards: Card[]): HandEvaluation {
  const sorted = sortByRank(cards);
  const counts = rankCounts(cards);
  const flush = isFlush(cards);
  const straightHigh = straightHighCard(cards);

  // Sort count entries: by count desc, then rank desc
  const countEntries = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || b[0] - a[0],
  );

  // Royal Flush
  if (flush && straightHigh === 14) {
    return {
      rank: "royal-flush",
      rankValue: HAND_RANK_VALUES["royal-flush"],
      cards: sorted,
      kickers: [14],
    };
  }

  // Straight Flush
  if (flush && straightHigh !== null) {
    return {
      rank: "straight-flush",
      rankValue: HAND_RANK_VALUES["straight-flush"],
      cards: sorted,
      kickers: [straightHigh],
    };
  }

  // Four of a Kind
  if (countEntries[0][1] === 4) {
    const quadRank = countEntries[0][0];
    const kicker = countEntries[1][0];
    return {
      rank: "four-of-a-kind",
      rankValue: HAND_RANK_VALUES["four-of-a-kind"],
      cards: sorted,
      kickers: [quadRank, kicker],
    };
  }

  // Full House
  if (countEntries[0][1] === 3 && countEntries[1][1] === 2) {
    return {
      rank: "full-house",
      rankValue: HAND_RANK_VALUES["full-house"],
      cards: sorted,
      kickers: [countEntries[0][0], countEntries[1][0]],
    };
  }

  // Flush
  if (flush) {
    return {
      rank: "flush",
      rankValue: HAND_RANK_VALUES.flush,
      cards: sorted,
      kickers: sorted.map((c) => toEvalRank(c.rank)),
    };
  }

  // Straight
  if (straightHigh !== null) {
    return {
      rank: "straight",
      rankValue: HAND_RANK_VALUES.straight,
      cards: sorted,
      kickers: [straightHigh],
    };
  }

  // Three of a Kind
  if (countEntries[0][1] === 3) {
    const tripRank = countEntries[0][0];
    const kickers = countEntries
      .slice(1)
      .map((e) => e[0])
      .sort((a, b) => b - a);
    return {
      rank: "three-of-a-kind",
      rankValue: HAND_RANK_VALUES["three-of-a-kind"],
      cards: sorted,
      kickers: [tripRank, ...kickers],
    };
  }

  // Two Pair
  if (countEntries[0][1] === 2 && countEntries[1][1] === 2) {
    const highPair = Math.max(countEntries[0][0], countEntries[1][0]);
    const lowPair = Math.min(countEntries[0][0], countEntries[1][0]);
    const kicker = countEntries[2][0];
    return {
      rank: "two-pair",
      rankValue: HAND_RANK_VALUES["two-pair"],
      cards: sorted,
      kickers: [highPair, lowPair, kicker],
    };
  }

  // One Pair
  if (countEntries[0][1] === 2) {
    const pairRank = countEntries[0][0];
    const kickers = countEntries
      .slice(1)
      .map((e) => e[0])
      .sort((a, b) => b - a);
    return {
      rank: "one-pair",
      rankValue: HAND_RANK_VALUES["one-pair"],
      cards: sorted,
      kickers: [pairRank, ...kickers],
    };
  }

  // High Card
  return {
    rank: "high-card",
    rankValue: HAND_RANK_VALUES["high-card"],
    cards: sorted,
    kickers: sorted.map((c) => toEvalRank(c.rank)),
  };
}

/**
 * Find the best 5-card hand from 7 cards (2 hole + 5 community).
 */
export function evaluateBestHand(cards: Card[]): HandEvaluation {
  const combos = combinations(cards, 5);
  let best: HandEvaluation | null = null;

  for (const combo of combos) {
    const evaluation = evaluate5(combo);
    if (!best || compareHands(evaluation, best) > 0) {
      best = evaluation;
    }
  }

  return best!;
}

/**
 * Compare two hand evaluations. Returns:
 * - positive if a > b
 * - negative if a < b
 * - 0 if equal
 */
export function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;

  // Same rank, compare kickers
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const ak = a.kickers[i] ?? 0;
    const bk = b.kickers[i] ?? 0;
    if (ak !== bk) return ak - bk;
  }

  return 0; // Exact tie
}

/** Create a standard 52-card deck */
export function createDeck(): Card[] {
  const suits: Card["suit"][] = ["hearts", "diamonds", "clubs", "spades"];
  const ranks: Card["rank"][] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}
