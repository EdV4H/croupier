import { describe, expect, it } from "vitest";
import { compareHands, evaluateBestHand } from "../src/hands.js";
import type { Card } from "../src/types.js";

function card(rank: Card["rank"], suit: Card["suit"] = "hearts"): Card {
  return { rank, suit };
}

describe("Hand Evaluation", () => {
  describe("evaluateBestHand", () => {
    it("detects royal flush", () => {
      const cards: Card[] = [
        card(14, "hearts"),
        card(13, "hearts"),
        card(12, "hearts"),
        card(11, "hearts"),
        card(10, "hearts"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ];
      const result = evaluateBestHand(cards);
      expect(result.rank).toBe("royal-flush");
    });

    it("detects straight flush", () => {
      const cards: Card[] = [
        card(9, "spades"),
        card(8, "spades"),
        card(7, "spades"),
        card(6, "spades"),
        card(5, "spades"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ];
      const result = evaluateBestHand(cards);
      expect(result.rank).toBe("straight-flush");
    });

    it("detects four of a kind", () => {
      const cards: Card[] = [
        card(10, "hearts"),
        card(10, "diamonds"),
        card(10, "clubs"),
        card(10, "spades"),
        card(5, "hearts"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ];
      const result = evaluateBestHand(cards);
      expect(result.rank).toBe("four-of-a-kind");
    });

    it("detects full house", () => {
      const cards: Card[] = [
        card(10, "hearts"),
        card(10, "diamonds"),
        card(10, "clubs"),
        card(5, "spades"),
        card(5, "hearts"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ];
      const result = evaluateBestHand(cards);
      expect(result.rank).toBe("full-house");
    });

    it("detects flush", () => {
      const cards: Card[] = [
        card(14, "hearts"),
        card(10, "hearts"),
        card(8, "hearts"),
        card(6, "hearts"),
        card(4, "hearts"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ];
      const result = evaluateBestHand(cards);
      expect(result.rank).toBe("flush");
    });

    it("detects straight", () => {
      const cards: Card[] = [
        card(10, "hearts"),
        card(9, "diamonds"),
        card(8, "clubs"),
        card(7, "spades"),
        card(6, "hearts"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ];
      const result = evaluateBestHand(cards);
      expect(result.rank).toBe("straight");
    });

    it("detects ace-low straight", () => {
      const cards: Card[] = [
        card(14, "hearts"),
        card(2, "diamonds"),
        card(3, "clubs"),
        card(4, "spades"),
        card(5, "hearts"),
        card(10, "clubs"),
        card(9, "diamonds"),
      ];
      const result = evaluateBestHand(cards);
      expect(result.rank).toBe("straight");
      expect(result.kickers[0]).toBe(5); // 5-high straight
    });

    it("detects three of a kind", () => {
      const cards: Card[] = [
        card(10, "hearts"),
        card(10, "diamonds"),
        card(10, "clubs"),
        card(7, "spades"),
        card(5, "hearts"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ];
      const result = evaluateBestHand(cards);
      expect(result.rank).toBe("three-of-a-kind");
    });

    it("detects two pair", () => {
      const cards: Card[] = [
        card(10, "hearts"),
        card(10, "diamonds"),
        card(5, "clubs"),
        card(5, "spades"),
        card(8, "hearts"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ];
      const result = evaluateBestHand(cards);
      expect(result.rank).toBe("two-pair");
    });

    it("detects one pair", () => {
      const cards: Card[] = [
        card(10, "hearts"),
        card(10, "diamonds"),
        card(8, "clubs"),
        card(6, "spades"),
        card(4, "hearts"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ];
      const result = evaluateBestHand(cards);
      expect(result.rank).toBe("one-pair");
    });

    it("detects high card", () => {
      const cards: Card[] = [
        card(14, "hearts"),
        card(10, "diamonds"),
        card(8, "clubs"),
        card(6, "spades"),
        card(4, "hearts"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ];
      const result = evaluateBestHand(cards);
      expect(result.rank).toBe("high-card");
    });
  });

  describe("compareHands", () => {
    it("higher rank wins", () => {
      const flush = evaluateBestHand([
        card(14, "hearts"),
        card(10, "hearts"),
        card(8, "hearts"),
        card(6, "hearts"),
        card(4, "hearts"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ]);
      const pair = evaluateBestHand([
        card(14, "hearts"),
        card(14, "diamonds"),
        card(8, "clubs"),
        card(6, "spades"),
        card(4, "hearts"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ]);
      expect(compareHands(flush, pair)).toBeGreaterThan(0);
    });

    it("same rank uses kickers", () => {
      const pairK = evaluateBestHand([
        card(13, "hearts"),
        card(13, "diamonds"),
        card(14, "clubs"),
        card(10, "spades"),
        card(8, "hearts"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ]);
      const pairQ = evaluateBestHand([
        card(12, "hearts"),
        card(12, "diamonds"),
        card(14, "clubs"),
        card(10, "spades"),
        card(8, "hearts"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ]);
      expect(compareHands(pairK, pairQ)).toBeGreaterThan(0);
    });

    it("identical hands are equal", () => {
      const hand1 = evaluateBestHand([
        card(14, "hearts"),
        card(13, "diamonds"),
        card(10, "clubs"),
        card(8, "spades"),
        card(6, "hearts"),
        card(4, "clubs"),
        card(2, "diamonds"),
      ]);
      const hand2 = evaluateBestHand([
        card(14, "spades"),
        card(13, "clubs"),
        card(10, "hearts"),
        card(8, "diamonds"),
        card(6, "spades"),
        card(4, "hearts"),
        card(2, "clubs"),
      ]);
      expect(compareHands(hand1, hand2)).toBe(0);
    });
  });
});
