import type { HTMLProps } from "@ark-ui/react";
import type { JSX } from "react";

type ElementTag = keyof JSX.IntrinsicElements;

/**
 * Build the props a part contributes to `mergeProps`, widened to the element's
 * prop type.
 *
 * Two type-level facts make this necessary:
 *
 * 1. `mergeProps` infers one type across all of its arguments, so an object
 *    holding only the anatomy's `data-scope` / `data-part` has "no properties
 *    in common" with the part's own props type and is rejected outright.
 * 2. React's prop types do not model arbitrary `data-*` keys. A spread escapes
 *    the excess-property check, but a key written inline — `"data-side"`,
 *    `"data-state"` — does not.
 *
 * Widening once here keeps the cast out of every part file, and keeps the
 * anatomy attrs and the extra data attributes in a single expression.
 */
export function partProps<T extends ElementTag>(
  ...sources: Array<Record<string, unknown> | undefined>
): HTMLProps<T> {
  return Object.assign({}, ...sources) as HTMLProps<T>;
}
