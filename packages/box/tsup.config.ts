import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", "examples/index": "src/examples/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
});
