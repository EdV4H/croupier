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
export function classifyCards(cards: Card[], _isRevolution: boolean, sequenceEnabled: boolean): PlayedCards | null {
  if (cards.length === 0) return null;

  const jokers = cards.filter(isJoker);
  const normals = cards.filter((c) => !isJoker(c));
  const jokerCount = jokers.length;

  // Single
  if (cards.length === 1) {
    if (isJoker(cards[0])) {
      return { cards, type: "single", rank: 0 };
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
  suitLock?: string | null,
): Card[][] {
  const validPlays: Card[][] = [];

  // Filter hand by suit lock (only matching suit + jokers allowed)
  const filteredHand = suitLock
    ? hand.filter((c) => c.suit === suitLock || isJoker(c))
    : hand;
  const handSize = filteredHand.length;

  // Singles
  for (let i = 0; i < handSize; i++) {
    if (isValidPlay([filteredHand[i]], currentPile, isRevolution, sequenceEnabled)) {
      validPlays.push([filteredHand[i]]);
    }
  }

  // Pairs
  for (let i = 0; i < handSize; i++) {
    for (let j = i + 1; j < handSize; j++) {
      const combo = [filteredHand[i], filteredHand[j]];
      if (isValidPlay(combo, currentPile, isRevolution, sequenceEnabled)) {
        validPlays.push(combo);
      }
    }
  }

  // Triples
  for (let i = 0; i < handSize; i++) {
    for (let j = i + 1; j < handSize; j++) {
      for (let k = j + 1; k < handSize; k++) {
        const combo = [filteredHand[i], filteredHand[j], filteredHand[k]];
        if (isValidPlay(combo, currentPile, isRevolution, sequenceEnabled)) {
          validPlays.push(combo);
        }
      }
    }
  }

  // Quads — use full hand (quads ignore suit lock since they're all same rank)
  const quadHand = suitLock ? hand : filteredHand;
  const quadSize = quadHand.length;
  for (let i = 0; i < quadSize; i++) {
    for (let j = i + 1; j < quadSize; j++) {
      for (let k = j + 1; k < quadSize; k++) {
        for (let l = k + 1; l < quadSize; l++) {
          const combo = [quadHand[i], quadHand[j], quadHand[k], quadHand[l]];
          if (isValidPlay(combo, currentPile, isRevolution, sequenceEnabled)) {
            validPlays.push(combo);
          }
        }
      }
    }
  }

  // Sequences (3+ cards, same suit) — sequences are inherently single-suit, so suit lock is compatible
  if (sequenceEnabled) {
    findSequencePlays(suitLock ? filteredHand : hand, currentPile, isRevolution, validPlays);
  }

  return validPlays;
}

/**
 * Sliding-window sequence enumeration. For each suit, sort ranks and try
 * consecutive windows of length 3..N, using jokers to fill gaps.
 */
function findSequencePlays(
  hand: Card[],
  currentPile: PlayedCards | null,
  isRevolution: boolean,
  results: Card[][],
): void {
  const jokers = hand.filter(isJoker);
  const bySuit: Record<string, Card[]> = {};
  for (const card of hand) {
    if (!isJoker(card)) {
      const s = card.suit as string;
      if (!bySuit[s]) bySuit[s] = [];
      bySuit[s].push(card);
    }
  }

  const seen = new Set<string>();

  for (const suit of SUITS) {
    const suitCards = bySuit[suit] || [];
    if (suitCards.length + jokers.length < 3) continue;

    // Build rank→card map for this suit
    const rankMap = new Map<number, Card>();
    for (const c of suitCards) {
      rankMap.set(c.rank as number, c);
    }
    const ranks = [...rankMap.keys()].sort((a, b) => a - b);
    if (ranks.length === 0) continue;

    const minRank = 3;
    const maxRank = 15;

    // Try every start rank and length
    for (let start = minRank; start <= maxRank; start++) {
      for (let len = 3; start + len - 1 <= maxRank; len++) {
        let jokersNeeded = 0;
        const cards: Card[] = [];

        for (let r = start; r < start + len; r++) {
          const card = rankMap.get(r);
          if (card) {
            cards.push(card);
          } else {
            jokersNeeded++;
          }
        }

        if (jokersNeeded > jokers.length) break; // longer sequences need even more jokers
        // Add jokers
        for (let j = 0; j < jokersNeeded; j++) {
          cards.push(jokers[j]);
        }

        const play = isValidPlay(cards, currentPile, isRevolution, true);
        if (play && play.type === "sequence") {
          const key = cards.map((c) => c.id).sort().join(",");
          if (!seen.has(key)) {
            seen.add(key);
            results.push(cards);
          }
        }
      }
    }
  }
}
