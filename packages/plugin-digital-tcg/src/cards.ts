import type { Card } from "./types.js";

/** Basic starter deck */
export const STARTER_DECK: Card[] = [
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

/** Assign unique instance IDs to deck cards */
export function createDeck(
  cards: Card[],
  playerPrefix: string,
): Card[] {
  return cards.map((card, i) => ({
    ...card,
    id: `${playerPrefix}_${card.id}_${i}`,
  }));
}
