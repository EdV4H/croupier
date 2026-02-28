/**
 * Deep clone a value using structuredClone.
 */
export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Replace an array with hidden placeholders (for masking hand contents).
 * Returns an array of the same length where each element is replaced with the placeholder.
 */
export function maskArray<T>(arr: T[], placeholder: unknown = { hidden: true }): unknown[] {
  return arr.map(() => structuredClone(placeholder));
}

/**
 * Replace an array with just its count (for masking deck contents).
 * Returns the length of the array.
 */
export function countOnly(arr: unknown[]): number {
  return arr.length;
}
