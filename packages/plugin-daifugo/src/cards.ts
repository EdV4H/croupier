import type { Card, CardRank, PlayedCards, PlayType, Suit } from "./types.js";

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const RANKS: CardRank[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const SUIT_PREFIX: Record<Suit, string> = {
  spades: "S",
  hearts: "H",
  diamonds: "D",
  clubs: "C",
};

export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ suit, rank, id: `${SUIT_PREFIX[suit]}${rank}` });
    }
  }
  cards.push({ suit: "joker", rank: 0, id: "JK1" });
  cards.push({ suit: "joker", rank: 0, id: "JK2" });
  return cards;
}

/** Get card strength. Normal: 3→3..2→15, JK→16. Revolution inverts non-joker. */
export function getCardStrength(rank: CardRank | 0, isRevolution: boolean): number {
  if (rank === 0) return 16; // joker always strongest
  if (isRevolution) {
    // Invert: 3→15, 4→14, ..., 15(=2)→3
    return 18 - rank;
  }
  return rank;
}

export function isJoker(card: Card): boolean {
  return card.suit === "joker";
}

/**
 * Classify a set of cards into a PlayedCards, or null if invalid.
 * Handles joker as wildcard for pair/triple/sequence.
 */
export function classifyCards(cards: Card[], isRevolution: boolean, sequenceEnabled: boolean): PlayedCards | null {
  if (cards.length === 0) return null;

  const jokers = cards.filter(isJoker);
  const normals = cards.filter((c) => !isJoker(c));
  const jokerCount = jokers.length;

  // Single
  if (cards.length === 1) {
    if (isJoker(cards[0])) {
      return { cards, type: "single", rank: 0 as CardRank };
    }
    return { cards, type: "single", rank: cards[0].rank as CardRank };
  }

  // Check for same-rank set (pair/triple/quad)
  if (normals.length > 0) {
    const ranks = new Set(normals.map((c) => c.rank));
    if (ranks.size === 1) {
      const rank = normals[0].rank as CardRank;
      const total = normals.length + jokerCount;
      if (total === 2) return { cards, type: "pair", rank };
      if (total === 3) return { cards, type: "triple", rank };
      if (total === 4) return { cards, type: "quad", rank };
    }
  }

  // Two jokers can form a pair
  if (jokerCount === 2 && normals.length === 0) {
    return { cards, type: "pair", rank: 0 as CardRank };
  }

  // Sequence check (3+ same-suit consecutive, jokers fill gaps)
  if (sequenceEnabled && cards.length >= 3) {
    const seq = detectSequence(cards);
    if (seq) return seq;
  }

  return null;
}

/** Detect a valid sequence (same suit, 3+ consecutive, jokers fill gaps). */
function detectSequence(cards: Card[]): PlayedCards | null {
  const jokers = cards.filter(isJoker);
  const normals = cards.filter((c) => !isJoker(c)) as (Card & { suit: Suit; rank: CardRank })[];

  if (normals.length === 0) return null;

  // All normals must be same suit
  const suits = new Set(normals.map((c) => c.suit));
  if (suits.size !== 1) return null;
  const suit = normals[0].suit as Suit;

  // Sort by rank
  const sortedRanks = normals.map((c) => c.rank as number).sort((a, b) => a - b);

  // Check for consecutive with joker gaps
  let jokersUsed = 0;
  const totalLength = cards.length;
  const startRank = sortedRanks[0];

  // Build expected sequence
  const expectedRanks: number[] = [];
  for (let i = 0; i < totalLength; i++) {
    expectedRanks.push(startRank + i);
  }

  // Verify all expected ranks are covered (by normals or jokers)
  let normalIdx = 0;
  for (const expected of expectedRanks) {
    if (expected > 15) return null; // exceeds rank 2(15)
    if (normalIdx < sortedRanks.length && sortedRanks[normalIdx] === expected) {
      normalIdx++;
    } else {
      jokersUsed++;
    }
  }

  if (jokersUsed > jokers.length) return null;
  if (normalIdx !== sortedRanks.length) return null;

  return {
    cards,
    type: "sequence",
    rank: startRank as CardRank,
    sequenceLength: totalLength,
    sequenceSuit: suit,
  };
}

/** Check if a play beats the current pile. */
export function beatsCurrentPile(play: PlayedCards, pile: PlayedCards, isRevolution: boolean): boolean {
  // Must match type
  if (play.type !== pile.type) return false;

  // Sequence must match length
  if (play.type === "sequence" && play.sequenceLength !== pile.sequenceLength) return false;

  // Joker single beats everything
  if (play.type === "single" && play.rank === 0) return true;

  // Compare strength
  const playStrength = getCardStrength(play.rank, isRevolution);
  const pileStrength = getCardStrength(pile.rank, isRevolution);

  return playStrength > pileStrength;
}

/** Full validation: classify + beat pile check. */
export function isValidPlay(
  cards: Card[],
  currentPile: PlayedCards | null,
  isRevolution: boolean,
  sequenceEnabled: boolean,
): PlayedCards | null {
  const play = classifyCards(cards, isRevolution, sequenceEnabled);
  if (!play) return null;

  if (currentPile === null) return play; // empty field, anything valid

  if (beatsCurrentPile(play, currentPile, isRevolution)) return play;
  return null;
}

/** Find the player holding diamond 3. */
export function findDiamondThree(players: Record<string, { hand: Card[] }>): string | null {
  for (const [pid, state] of Object.entries(players)) {
    if (state.hand.some((c) => c.id === "D3")) return pid;
  }
  return null;
}

/** Get the N strongest cards from a hand (for card exchange). */
export function getBestCards(hand: Card[], count: number, isRevolution: boolean): Card[] {
  const sorted = [...hand].sort(
    (a, b) => getCardStrength(b.rank, isRevolution) - getCardStrength(a.rank, isRevolution),
  );
  return sorted.slice(0, count);
}

/** Find all valid plays from a hand against the current pile (for bot). */
export function findAllValidPlays(
  hand: Card[],
  currentPile: PlayedCards | null,
  isRevolution: boolean,
  sequenceEnabled: boolean,
): Card[][] {
  const validPlays: Card[][] = [];
  const handSize = hand.length;

  // Singles
  for (let i = 0; i < handSize; i++) {
    if (isValidPlay([hand[i]], currentPile, isRevolution, sequenceEnabled)) {
      validPlays.push([hand[i]]);
    }
  }

  // Pairs
  for (let i = 0; i < handSize; i++) {
    for (let j = i + 1; j < handSize; j++) {
      const combo = [hand[i], hand[j]];
      if (isValidPlay(combo, currentPile, isRevolution, sequenceEnabled)) {
        validPlays.push(combo);
      }
    }
  }

  // Triples
  for (let i = 0; i < handSize; i++) {
    for (let j = i + 1; j < handSize; j++) {
      for (let k = j + 1; k < handSize; k++) {
        const combo = [hand[i], hand[j], hand[k]];
        if (isValidPlay(combo, currentPile, isRevolution, sequenceEnabled)) {
          validPlays.push(combo);
        }
      }
    }
  }

  // Quads
  for (let i = 0; i < handSize; i++) {
    for (let j = i + 1; j < handSize; j++) {
      for (let k = j + 1; k < handSize; k++) {
        for (let l = k + 1; l < handSize; l++) {
          const combo = [hand[i], hand[j], hand[k], hand[l]];
          if (isValidPlay(combo, currentPile, isRevolution, sequenceEnabled)) {
            validPlays.push(combo);
          }
        }
      }
    }
  }

  // Sequences (3+ cards, same suit)
  if (sequenceEnabled) {
    findSequencePlays(hand, currentPile, isRevolution, validPlays);
  }

  return validPlays;
}

function findSequencePlays(
  hand: Card[],
  currentPile: PlayedCards | null,
  isRevolution: boolean,
  results: Card[][],
): void {
  // Group by suit (including jokers)
  const jokers = hand.filter(isJoker);
  const bySuit: Record<string, Card[]> = {};
  for (const card of hand) {
    if (!isJoker(card)) {
      const s = card.suit as string;
      if (!bySuit[s]) bySuit[s] = [];
      bySuit[s].push(card);
    }
  }

  for (const suit of SUITS) {
    const suitCards = bySuit[suit] || [];
    if (suitCards.length + jokers.length < 3) continue;

    // Try all possible sequence starts and lengths
    const allCards = [...suitCards, ...jokers];
    for (let len = 3; len <= allCards.length; len++) {
      // Generate combinations of len cards from allCards
      const combos = combinations(allCards, len);
      for (const combo of combos) {
        const play = isValidPlay(combo, currentPile, isRevolution, true);
        if (play && play.type === "sequence") {
          // Avoid duplicates with same card IDs
          const ids = combo.map((c) => c.id).sort().join(",");
          if (!results.some((r) => r.map((c) => c.id).sort().join(",") === ids)) {
            results.push(combo);
          }
        }
      }
    }
  }
}

function combinations<T>(arr: T[], len: number): T[][] {
  if (len === 0) return [[]];
  if (arr.length < len) return [];
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - len; i++) {
    const rest = combinations(arr.slice(i + 1), len - 1);
    for (const combo of rest) {
      result.push([arr[i], ...combo]);
    }
  }
  return result;
}
