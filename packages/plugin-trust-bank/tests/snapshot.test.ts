import { describe, expect, it } from "vitest";
import { runSnapshotRoundTrip } from "@croupier/core/testing";
import { createTrustBankConfig } from "../src/index.js";

describe("snapshot round-trip", () => {
  for (const seed of [1, 2, 3]) {
    it(`restores identically at every step of a bot game (seed ${seed})`, async () => {
      const result = await runSnapshotRoundTrip(
        createTrustBankConfig(),
        ["P1", "P2", "P3"],
        { seed },
      );
      expect(result.stopReason).toBe("finished");
      expect(result.steps).toBeGreaterThan(0);
    });
  }
});
