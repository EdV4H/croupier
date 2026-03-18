import { describe, expect, it } from "vitest";
import {
  beatsCurrentPile,
  classifyCards,
  createDeck,
  findAllValidPlays,
  findDiamondThree,
  getBestCards,
  getCardStrength,
  isValidPlay,
} from "../src/cards.js";
import {
  assignRanks,
  checkElevenBack,
  checkFiveSkip,
  checkNineReverse,
  checkRestrictedFinish,
  checkSevenPass,
  checkSpadeThreeReturn,
  checkSuitLock,
  checkTenDiscard,
  getExchangePairs,
  isEightCut,
  isRevolutionPlay,
} from "../src/rules.js";
import type { Card, CardRank, PlayedCards, Suit } from "../src/types.js";
import { DEFAULT_RULES } from "../src/types.js";

function card(id: string): Card {
  if (id.startsWith("JK")) return { suit: "joker", rank: 0, id };
  const suitMap: Record<string, Suit> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
  const suit = suitMap[id[0]];
  const rank = parseInt(id.slice(1)) as CardRank;
  return { suit, rank, id };
}

describe("createDeck", () => {
  it("creates 54 cards (52 + 2 jokers)", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(54);
    expect(deck.filter((c) => c.suit === "joker")).toHaveLength(2);
  });

  it("has all ranks for each suit", () => {
    const deck = createDeck();
    const spades = deck.filter((c) => c.suit === "spades");
    expect(spades).toHaveLength(13);
  });
});

describe("getCardStrength", () => {
  it("normal order: 3 < 4 < ... < 2 < JK", () => {
    expect(getCardStrength(3, false)).toBe(3);
    expect(getCardStrength(14, false)).toBe(14); // A
    expect(getCardStrength(15, false)).toBe(15); // 2
    expect(getCardStrength(0, false)).toBe(16);  // JK
  });

  it("revolution: 2 is weakest, 3 is strongest (non-joker)", () => {
    expect(getCardStrength(15, true)).toBe(3);  // 2 becomes weakest
    expect(getCardStrength(3, true)).toBe(15);   // 3 becomes strongest non-JK
    expect(getCardStrength(0, true)).toBe(16);   // JK still strongest
  });
});

describe("classifyCards", () => {
  it("classifies single card", () => {
    const play = classifyCards([card("S5")], false, true);
    expect(play).not.toBeNull();
    expect(play!.type).toBe("single");
    expect(play!.rank).toBe(5);
  });

  it("classifies single joker", () => {
    const play = classifyCards([card("JK1")], false, true);
    expect(play).not.toBeNull();
    expect(play!.type).toBe("single");
    expect(play!.rank).toBe(0);
  });

  it("classifies pair of same rank", () => {
    const play = classifyCards([card("S7"), card("H7")], false, true);
    expect(play).not.toBeNull();
    expect(play!.type).toBe("pair");
    expect(play!.rank).toBe(7);
  });

  it("classifies joker + card as pair", () => {
    const play = classifyCards([card("JK1"), card("H7")], false, true);
    expect(play).not.toBeNull();
    expect(play!.type).toBe("pair");
    expect(play!.rank).toBe(7);
  });

  it("classifies two jokers as pair", () => {
    const play = classifyCards([card("JK1"), card("JK2")], false, true);
    expect(play).not.toBeNull();
    expect(play!.type).toBe("pair");
  });

  it("classifies triple", () => {
    const play = classifyCards([card("S10"), card("H10"), card("D10")], false, true);
    expect(play).not.toBeNull();
    expect(play!.type).toBe("triple");
  });

  it("classifies quad", () => {
    const play = classifyCards([card("S8"), card("H8"), card("D8"), card("C8")], false, true);
    expect(play).not.toBeNull();
    expect(play!.type).toBe("quad");
  });

  it("classifies sequence (same suit, 3 consecutive)", () => {
    const play = classifyCards([card("S5"), card("S6"), card("S7")], false, true);
    expect(play).not.toBeNull();
    expect(play!.type).toBe("sequence");
    expect(play!.rank).toBe(5);
    expect(play!.sequenceLength).toBe(3);
    expect(play!.sequenceSuit).toBe("spades");
  });

  it("rejects sequence with different suits", () => {
    const play = classifyCards([card("S5"), card("H6"), card("S7")], false, true);
    // This should not be a valid sequence (mixed suits) and not a valid set
    expect(play).toBeNull();
  });

  it("rejects 2-card sequence", () => {
    const play = classifyCards([card("S5"), card("S6")], false, true);
    // 2 cards different rank: not a pair, not a sequence (min 3)
    expect(play).toBeNull();
  });

  it("sequence with joker filling gap", () => {
    const play = classifyCards([card("S5"), card("JK1"), card("S7")], false, true);
    expect(play).not.toBeNull();
    expect(play!.type).toBe("sequence");
    expect(play!.sequenceLength).toBe(3);
  });

  it("returns null when sequence disabled", () => {
    const play = classifyCards([card("S5"), card("S6"), card("S7")], false, false);
    expect(play).toBeNull();
  });

  it("returns null for invalid combination", () => {
    const play = classifyCards([card("S5"), card("H8")], false, true);
    expect(play).toBeNull();
  });
});

describe("beatsCurrentPile", () => {
  it("higher single beats lower", () => {
    const play: PlayedCards = { cards: [card("S8")], type: "single", rank: 8 };
    const pile: PlayedCards = { cards: [card("H5")], type: "single", rank: 5 };
    expect(beatsCurrentPile(play, pile, false)).toBe(true);
  });

  it("lower single doesn't beat higher", () => {
    const play: PlayedCards = { cards: [card("S3")], type: "single", rank: 3 };
    const pile: PlayedCards = { cards: [card("H5")], type: "single", rank: 5 };
    expect(beatsCurrentPile(play, pile, false)).toBe(false);
  });

  it("joker single beats everything", () => {
    const play: PlayedCards = { cards: [card("JK1")], type: "single", rank: 0 as CardRank };
    const pile: PlayedCards = { cards: [card("H15")], type: "single", rank: 15 };
    expect(beatsCurrentPile(play, pile, false)).toBe(true);
  });

  it("higher pair beats lower pair", () => {
    const play: PlayedCards = { cards: [card("S10"), card("H10")], type: "pair", rank: 10 };
    const pile: PlayedCards = { cards: [card("S5"), card("H5")], type: "pair", rank: 5 };
    expect(beatsCurrentPile(play, pile, false)).toBe(true);
  });

  it("pair doesn't beat single", () => {
    const play: PlayedCards = { cards: [card("S10"), card("H10")], type: "pair", rank: 10 };
    const pile: PlayedCards = { cards: [card("H5")], type: "single", rank: 5 };
    expect(beatsCurrentPile(play, pile, false)).toBe(false);
  });

  it("sequence must match length", () => {
    const play: PlayedCards = { cards: [card("S8"), card("S9"), card("S10"), card("S11")], type: "sequence", rank: 8, sequenceLength: 4 };
    const pile: PlayedCards = { cards: [card("H5"), card("H6"), card("H7")], type: "sequence", rank: 5, sequenceLength: 3 };
    expect(beatsCurrentPile(play, pile, false)).toBe(false);
  });

  it("stronger sequence of same length wins", () => {
    const play: PlayedCards = { cards: [card("S8"), card("S9"), card("S10")], type: "sequence", rank: 8, sequenceLength: 3 };
    const pile: PlayedCards = { cards: [card("H5"), card("H6"), card("H7")], type: "sequence", rank: 5, sequenceLength: 3 };
    expect(beatsCurrentPile(play, pile, false)).toBe(true);
  });

  it("revolution reverses non-joker strength", () => {
    // In revolution, 3 is strongest non-joker, 2(15) is weakest
    const play: PlayedCards = { cards: [card("S3")], type: "single", rank: 3 };
    const pile: PlayedCards = { cards: [card("H15")], type: "single", rank: 15 };
    expect(beatsCurrentPile(play, pile, true)).toBe(true);
  });
});

describe("isValidPlay", () => {
  it("any card valid on empty field", () => {
    const play = isValidPlay([card("S3")], null, false, true);
    expect(play).not.toBeNull();
  });

  it("stronger card valid on pile", () => {
    const pile: PlayedCards = { cards: [card("H5")], type: "single", rank: 5 };
    const play = isValidPlay([card("S8")], pile, false, true);
    expect(play).not.toBeNull();
  });

  it("weaker card invalid on pile", () => {
    const pile: PlayedCards = { cards: [card("H10")], type: "single", rank: 10 };
    const play = isValidPlay([card("S3")], pile, false, true);
    expect(play).toBeNull();
  });
});

describe("findDiamondThree", () => {
  it("finds player with diamond 3", () => {
    const players = {
      P1: { hand: [card("S5"), card("H8")] },
      P2: { hand: [card("D3"), card("C10")] },
    };
    expect(findDiamondThree(players)).toBe("P2");
  });

  it("returns null if no one has it", () => {
    const players = {
      P1: { hand: [card("S5")] },
    };
    expect(findDiamondThree(players)).toBeNull();
  });
});

describe("getBestCards", () => {
  it("returns strongest cards", () => {
    const hand = [card("S3"), card("H8"), card("D15"), card("JK1")];
    const best = getBestCards(hand, 2, false);
    expect(best.map((c) => c.id)).toEqual(["JK1", "D15"]);
  });

  it("returns weakest-strong in revolution", () => {
    const hand = [card("S3"), card("H8"), card("D15")];
    const best = getBestCards(hand, 1, true);
    expect(best[0].id).toBe("S3"); // 3 is strongest in revolution
  });
});

describe("findAllValidPlays", () => {
  it("finds all singles on empty field", () => {
    const hand = [card("S3"), card("H5")];
    const plays = findAllValidPlays(hand, null, false, true);
    expect(plays.length).toBeGreaterThanOrEqual(2);
  });

  it("finds pairs when available", () => {
    const hand = [card("S7"), card("H7"), card("D10")];
    const plays = findAllValidPlays(hand, null, false, true);
    const pairs = plays.filter((p) => p.length === 2);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
  });
});

describe("special rules detection", () => {
  it("isEightCut: detects 8 in play", () => {
    expect(isEightCut([card("S8")], DEFAULT_RULES)).toBe(true);
    expect(isEightCut([card("S5")], DEFAULT_RULES)).toBe(false);
  });

  it("isEightCut: returns false when rule off", () => {
    expect(isEightCut([card("S8")], { ...DEFAULT_RULES, eightCut: false })).toBe(false);
  });

  it("isRevolutionPlay: pure quad triggers", () => {
    const cards = [card("S7"), card("H7"), card("D7"), card("C7")];
    expect(isRevolutionPlay(cards, DEFAULT_RULES)).toBe(true);
  });

  it("isRevolutionPlay: joker quad does not trigger", () => {
    const cards = [card("S7"), card("H7"), card("D7"), card("JK1")];
    expect(isRevolutionPlay(cards, DEFAULT_RULES)).toBe(false);
  });

  it("isRevolutionPlay: returns false when rule off", () => {
    const cards = [card("S7"), card("H7"), card("D7"), card("C7")];
    expect(isRevolutionPlay(cards, { ...DEFAULT_RULES, revolution: false })).toBe(false);
  });

  it("checkSuitLock: detects same suit", () => {
    const play: PlayedCards = { cards: [card("S8")], type: "single", rank: 8 };
    const pile: PlayedCards = { cards: [card("S5")], type: "single", rank: 5 };
    expect(checkSuitLock(play, pile, DEFAULT_RULES)).toBe("spades");
  });

  it("checkSuitLock: null for different suits", () => {
    const play: PlayedCards = { cards: [card("H8")], type: "single", rank: 8 };
    const pile: PlayedCards = { cards: [card("S5")], type: "single", rank: 5 };
    expect(checkSuitLock(play, pile, DEFAULT_RULES)).toBeNull();
  });

  it("checkSuitLock: returns null when rule off", () => {
    const play: PlayedCards = { cards: [card("S8")], type: "single", rank: 8 };
    const pile: PlayedCards = { cards: [card("S5")], type: "single", rank: 5 };
    expect(checkSuitLock(play, pile, { ...DEFAULT_RULES, suitLock: false })).toBeNull();
  });

  it("checkElevenBack: detects J", () => {
    expect(checkElevenBack([card("S11")], { ...DEFAULT_RULES, elevenBack: true })).toBe(true);
    expect(checkElevenBack([card("S11")], DEFAULT_RULES)).toBe(false); // off by default
  });

  it("checkSpadeThreeReturn: S3 vs joker", () => {
    const play: PlayedCards = { cards: [card("S3")], type: "single", rank: 3 };
    const pile: PlayedCards = { cards: [card("JK1")], type: "single", rank: 0 as CardRank };
    expect(checkSpadeThreeReturn(play, pile, { ...DEFAULT_RULES, spadeThreeReturn: true })).toBe(true);
    expect(checkSpadeThreeReturn(play, pile, DEFAULT_RULES)).toBe(false); // off by default
  });

  it("checkSevenPass: counts 7s", () => {
    expect(checkSevenPass([card("S7"), card("H7")], { ...DEFAULT_RULES, sevenPass: true })).toBe(2);
    expect(checkSevenPass([card("S7")], DEFAULT_RULES)).toBe(0); // off by default
  });

  it("checkTenDiscard: counts 10s", () => {
    expect(checkTenDiscard([card("S10")], { ...DEFAULT_RULES, tenDiscard: true })).toBe(1);
    expect(checkTenDiscard([card("S10")], DEFAULT_RULES)).toBe(0);
  });

  it("checkFiveSkip: counts 5s", () => {
    expect(checkFiveSkip([card("S5"), card("H5")], { ...DEFAULT_RULES, fiveSkip: true })).toBe(2);
    expect(checkFiveSkip([card("S5")], DEFAULT_RULES)).toBe(0);
  });

  it("checkNineReverse: detects 9", () => {
    expect(checkNineReverse([card("S9")], { ...DEFAULT_RULES, nineReverse: true })).toBe(true);
    expect(checkNineReverse([card("S9")], DEFAULT_RULES)).toBe(false);
  });

  it("checkRestrictedFinish: detects 2/8/JK", () => {
    const rulesOn = { ...DEFAULT_RULES, restrictedFinish: true };
    expect(checkRestrictedFinish([card("S15")], rulesOn)).toBe(true);  // 2
    expect(checkRestrictedFinish([card("S8")], rulesOn)).toBe(true);   // 8
    expect(checkRestrictedFinish([card("JK1")], rulesOn)).toBe(true);  // JK
    expect(checkRestrictedFinish([card("S5")], rulesOn)).toBe(false);
    expect(checkRestrictedFinish([card("S15")], DEFAULT_RULES)).toBe(false); // off
  });
});

describe("assignRanks", () => {
  it("assigns ranks correctly for 4 players", () => {
    const ranks = assignRanks(["P1", "P2", "P3", "P4"], ["P1", "P2", "P3", "P4"]);
    expect(ranks.P1).toBe("daifugo");
    expect(ranks.P2).toBe("fugo");
    expect(ranks.P3).toBe("hinmin");
    expect(ranks.P4).toBe("daihinmin");
  });

  it("assigns ranks correctly for 3 players", () => {
    const ranks = assignRanks(["P1", "P2", "P3"], ["P1", "P2", "P3"]);
    expect(ranks.P1).toBe("daifugo");
    expect(ranks.P2).toBe("heimin");
    expect(ranks.P3).toBe("daihinmin");
  });

  it("assigns ranks correctly for 5 players", () => {
    const ranks = assignRanks(["P1", "P2", "P3", "P4", "P5"], ["P1", "P2", "P3", "P4", "P5"]);
    expect(ranks.P1).toBe("daifugo");
    expect(ranks.P2).toBe("fugo");
    expect(ranks.P3).toBe("heimin");
    expect(ranks.P4).toBe("hinmin");
    expect(ranks.P5).toBe("daihinmin");
  });
});

describe("getExchangePairs", () => {
  it("returns correct pairs for 4 players", () => {
    const ranks = { P1: "daifugo" as const, P2: "fugo" as const, P3: "hinmin" as const, P4: "daihinmin" as const };
    const pairs = getExchangePairs(ranks);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toEqual({ high: "P1", low: "P4", count: 2 });
    expect(pairs[1]).toEqual({ high: "P2", low: "P3", count: 1 });
  });

  it("returns only daifugo pair for 3 players", () => {
    const ranks = { P1: "daifugo" as const, P2: "heimin" as const, P3: "daihinmin" as const };
    const pairs = getExchangePairs(ranks);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({ high: "P1", low: "P3", count: 2 });
  });
});
