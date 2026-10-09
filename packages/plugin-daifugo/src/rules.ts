import type { PlayerId } from "@edv4h/croupier-core";
import type { Card, DaifugoRank, DaifugoRules, PlayedCards, Suit } from "./types.js";
import { isJoker } from "./cards.js";

/** Check if the play triggers 8-cut. */
export function isEightCut(cards: Card[], rules: DaifugoRules): boolean {
  if (!rules.eightCut) return false;
  return cards.some((c) => c.rank === 8);
}

/** Check if the play is a pure quad (revolution trigger). Joker-containing quads don't count. */
export function isRevolutionPlay(cards: Card[], rules: DaifugoRules): boolean {
  if (!rules.revolution) return false;
  if (cards.length !== 4) return false;
  // Must be pure (no jokers)
  if (cards.some(isJoker)) return false;
  // All same rank
  const ranks = new Set(cards.map((c) => c.rank));
  return ranks.size === 1;
}

/** Check suit lock condition. Returns the locked suit if lock should activate, null otherwise. */
export function checkSuitLock(
  play: PlayedCards,
  pile: PlayedCards | null,
  rules: DaifugoRules,
): Suit | null {
  if (!rules.suitLock) return null;
  if (!pile) return null;
  if (play.type !== "single" || pile.type !== "single") return null;

  // Both must be non-joker singles
  const playCard = play.cards[0];
  const pileCard = pile.cards[0];
  if (isJoker(playCard) || isJoker(pileCard)) return null;

  if (playCard.suit === pileCard.suit) {
    return playCard.suit as Suit;
  }
  return null;
}

/** Check if play triggers 11-back. */
export function checkElevenBack(cards: Card[], rules: DaifugoRules): boolean {
  if (!rules.elevenBack) return false;
  return cards.some((c) => c.rank === 11);
}

/** Check spade-3 return: single ♠3 against single joker. */
export function checkSpadeThreeReturn(
  play: PlayedCards,
  pile: PlayedCards | null,
  rules: DaifugoRules,
): boolean {
  if (!rules.spadeThreeReturn) return false;
  if (!pile) return false;
  if (pile.type !== "single" || pile.rank !== 0) return false; // pile must be single joker
  if (play.type !== "single") return false;
  return play.cards[0].id === "S3";
}

/** Count 7s in the play (for 7-pass). Returns 0 if rule is off. */
export function checkSevenPass(cards: Card[], rules: DaifugoRules): number {
  if (!rules.sevenPass) return 0;
  return cards.filter((c) => c.rank === 7).length;
}

/** Count 10s in the play (for 10-discard). Returns 0 if rule is off. */
export function checkTenDiscard(cards: Card[], rules: DaifugoRules): number {
  if (!rules.tenDiscard) return 0;
  return cards.filter((c) => c.rank === 10).length;
}

/** Count 5s in the play (for 5-skip). Returns 0 if rule is off. */
export function checkFiveSkip(cards: Card[], rules: DaifugoRules): number {
  if (!rules.fiveSkip) return 0;
  return cards.filter((c) => c.rank === 5).length;
}

/** Check if play triggers 9-reverse. */
export function checkNineReverse(cards: Card[], rules: DaifugoRules): boolean {
  if (!rules.nineReverse) return false;
  return cards.some((c) => c.rank === 9);
}

/** Check if finishing with these cards violates restricted finish rule. */
export function checkRestrictedFinish(cards: Card[], rules: DaifugoRules): boolean {
  if (!rules.restrictedFinish) return false;
  return cards.some((c) => c.rank === 15 || c.rank === 8 || isJoker(c));
}

/** Assign ranks based on finish order. */
export function assignRanks(
  finishedPlayers: PlayerId[],
  playerOrder: PlayerId[],
): Record<PlayerId, DaifugoRank> {
  const total = playerOrder.length;
  const result: Record<PlayerId, DaifugoRank> = {};

  // Finished players get ranks in finish order
  // Any unfinished players get remaining ranks
  const allRanked = [...finishedPlayers];
  for (const pid of playerOrder) {
    if (!allRanked.includes(pid)) {
      allRanked.push(pid);
    }
  }

  for (let i = 0; i < total; i++) {
    const pid = allRanked[i];
    if (i === 0) result[pid] = "daifugo";
    else if (i === total - 1) result[pid] = "daihinmin";
    else if (i === 1 && total >= 4) result[pid] = "fugo";
    else if (i === total - 2 && total >= 4) result[pid] = "hinmin";
    else result[pid] = "heimin";
  }

  return result;
}

/** Get exchange pairs: {high, low, count} */
export function getExchangePairs(
  ranks: Record<PlayerId, DaifugoRank>,
): { high: PlayerId; low: PlayerId; count: number }[] {
  const pairs: { high: PlayerId; low: PlayerId; count: number }[] = [];

  let daifugo: PlayerId | null = null;
  let daihinmin: PlayerId | null = null;
  let fugo: PlayerId | null = null;
  let hinmin: PlayerId | null = null;

  for (const [pid, rank] of Object.entries(ranks)) {
    if (rank === "daifugo") daifugo = pid;
    if (rank === "daihinmin") daihinmin = pid;
    if (rank === "fugo") fugo = pid;
    if (rank === "hinmin") hinmin = pid;
  }

  if (daifugo && daihinmin) {
    pairs.push({ high: daifugo, low: daihinmin, count: 2 });
  }
  if (fugo && hinmin) {
    pairs.push({ high: fugo, low: hinmin, count: 1 });
  }

  return pairs;
}

/** Check capital fall: previous daifugo didn't finish in top 2. */
export function checkCapitalFall(
  playerId: PlayerId,
  previousRanks: Record<PlayerId, DaifugoRank> | null,
  finishOrder: number,
  totalPlayers: number,
  rules: DaifugoRules,
): boolean {
  if (!rules.capitalFall) return false;
  if (!previousRanks) return false;
  if (previousRanks[playerId] !== "daifugo") return false;
  // If daifugo finishes 3rd or worse (0-indexed: finishOrder >= 2)
  return finishOrder >= 2;
}

/** Score for a given rank position. */
export function scoreForPosition(position: number, totalPlayers: number): number {
  // Simple scoring: 1st gets (N-1) points, 2nd gets (N-2), ..., last gets 0
  return Math.max(0, totalPlayers - 1 - position);
}
