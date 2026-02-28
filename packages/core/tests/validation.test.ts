import { describe, expect, it } from "vitest";
import type { CroupierConfig, GameState } from "../src/types.js";
import { validateConfig } from "../src/validation.js";

function makeConfig(
  overrides: Partial<CroupierConfig> = {},
): CroupierConfig {
  return {
    name: "test",
    setup: () => ({}),
    actions: {
      doSomething: { execute: () => {} },
    },
    phases: {
      main: { allowedActions: ["doSomething"] },
    },
    ...overrides,
  };
}

describe("validateConfig", () => {
  it("accepts a valid config", () => {
    expect(() => validateConfig(makeConfig())).not.toThrow();
  });

  it("throws if name is missing", () => {
    expect(() => validateConfig(makeConfig({ name: "" }))).toThrow(
      "requires a name",
    );
  });

  it("throws if setup is missing", () => {
    expect(() =>
      validateConfig(makeConfig({ setup: undefined as any })),
    ).toThrow("requires a setup function");
  });

  it("throws if phases is empty", () => {
    expect(() => validateConfig(makeConfig({ phases: {} }))).toThrow(
      "at least one phase",
    );
  });

  it("throws if initialPhase references unknown phase", () => {
    expect(() =>
      validateConfig(makeConfig({ initialPhase: "nonexistent" })),
    ).toThrow('initialPhase "nonexistent"');
  });

  it("throws if phase references unknown action", () => {
    expect(() =>
      validateConfig(
        makeConfig({
          phases: { main: { allowedActions: ["unknown"] } },
        }),
      ),
    ).toThrow('unknown action "unknown"');
  });

  it("throws if stage references unknown action", () => {
    expect(() =>
      validateConfig(
        makeConfig({
          phases: {
            main: {
              stages: {
                sub: { allowedActions: ["unknown"] },
              },
            },
          },
        }),
      ),
    ).toThrow('unknown action "unknown"');
  });

  it("throws if initialStage references unknown stage", () => {
    expect(() =>
      validateConfig(
        makeConfig({
          phases: {
            main: {
              initialStage: "nonexistent",
              stages: {
                sub: {},
              },
            },
          },
        }),
      ),
    ).toThrow('initialStage "nonexistent"');
  });
});
