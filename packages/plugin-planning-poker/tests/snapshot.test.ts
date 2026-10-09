import { describe, expect, it } from "vitest";
import { runSnapshotRoundTrip } from "@croupier/core/testing";
import { createPlanningPokerConfig } from "../src/index.js";

describe("snapshot round-trip", () => {
  for (const seed of [1, 2, 3]) {
    it(`restores identically at every step of a bot game (seed ${seed})`, async () => {
      const result = await runSnapshotRoundTrip(
        createPlanningPokerConfig({ facilitators: ["Facilitator"] }),
        ["Facilitator", "Dev1", "Dev2", "Dev3"],
        { seed, maxSteps: 100 },
      );
      // Planning poker has no end condition; play several tasks
      expect(result.stopReason).toBe("maxSteps");
      expect(result.steps).toBe(100);
    });
  }
});
