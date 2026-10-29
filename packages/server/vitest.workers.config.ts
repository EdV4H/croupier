import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["tests/workers/*.test.ts"],
    poolOptions: {
      workers: {
        // Durable Object WebSockets do not work with isolated storage
        isolatedStorage: false,
        singleWorker: true,
        wrangler: { configPath: "./tests/workers/wrangler.toml" },
      },
    },
  },
});
