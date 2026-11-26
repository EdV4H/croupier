// atrae-ui の @repo/base から、TradingCard が使う 2 つだけを写したもの。

import {
  createContext as createReactContext,
  useContext as useReactContext,
} from "react";

interface CreateContextOptions<T> {
  strict?: boolean;
  hookName?: string;
  providerName?: string;
  errorMessage?: string;
  name?: string;
  defaultValue?: T;
}

type CreateContextReturn<T> = [React.Provider<T>, () => T, React.Context<T>];

function getErrorMessage(hook: string, provider: string) {
  return `${hook} returned \`undefined\`. Seems you forgot to wrap component within ${provider}`;
}

export function createContext<T>(options: CreateContextOptions<T> = {}) {
  const {
    name,
    strict = true,
    hookName = "useContext",
    providerName = "Provider",
    errorMessage,
  } = options;

  const Context = createReactContext<T | undefined>(undefined);

  Context.displayName = name;

  function useContext() {
    const context = useReactContext(Context);

    if (!context && strict) {
      const error = new Error(
        errorMessage ?? getErrorMessage(hookName, providerName),
      );
      error.name = "ContextError";
      if (
        "captureStackTrace" in Error &&
        Error.captureStackTrace !== undefined &&
        typeof Error.captureStackTrace === "function"
      ) {
        Error.captureStackTrace?.(error, useContext);
      }
      throw error;
    }

    return context;
  }

  return [Context.Provider, useContext, Context] as CreateContextReturn<T>;
}

type EnsureKeys<
  ExpectedKeys extends (keyof Target)[],
  Target,
> = ExpectedKeys extends (keyof Target)[]
  ? [keyof Target] extends [ExpectedKeys[number]]
    ? unknown
    : `Missing required keys: ${Exclude<keyof Target, ExpectedKeys[number]>}`
  : never;

export const createSplitProps =
  <Target>() =>
  <Keys extends (keyof Target)[], Props extends Target = Target>(
    props: Props,
    keys: Keys & EnsureKeys<Keys, Target>,
  ) =>
    (keys as string[]).reduce<
      [Target, Omit<Props, Extract<(typeof keys)[number], string>>]
    >(
      (previousValue, currentValue) => {
        const [target, source] = previousValue;
        const key = currentValue as keyof Target & keyof typeof source;
        if (source[key] !== undefined) {
          target[key] = source[key];
        }
        delete source[key];
        return [target, source];
      },
      [{} as Target, { ...props }],
    );

/** `K` を省略可能にした `T`。 */
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
