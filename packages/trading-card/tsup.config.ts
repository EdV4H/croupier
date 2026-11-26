import { copyFileSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  // 骨格 CSS は JS から読まずに、そのまま dist に置く(Panda で当てる側は読まない)
  onSuccess: async () => {
    copyFileSync("src/styles.css", "dist/styles.css");
  },
});
