/**
 * Simple seeded PRNG (mulberry32).
 * Provides reproducible randomness for game setup and testing.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Generate a float in [0, 1) */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Generate an integer in [min, max] (inclusive) */
  integer(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Shuffle an array in-place (Fisher-Yates) */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.integer(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Pick a random element from an array */
  pick<T>(arr: T[]): T {
    return arr[this.integer(0, arr.length - 1)];
  }
}

/**
 * Create a SetupContext-compatible random object.
 */
export function createRandom(seed?: number) {
  const rng = new SeededRandom(seed ?? Date.now());
  return {
    shuffle: <T>(arr: T[]) => rng.shuffle([...arr]),
    integer: (min: number, max: number) => rng.integer(min, max),
    pick: <T>(arr: T[]) => rng.pick(arr),
  };
}
