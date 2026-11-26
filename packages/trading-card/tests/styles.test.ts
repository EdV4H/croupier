// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tradingCardAnatomy } from "../src";

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const attrs = Object.values(tradingCardAnatomy.build()).map((p) => p.attrs["data-part"]);

describe("styles.css", () => {
  it("当てている data-part はすべて anatomy にある", () => {
    const used = new Set([...css.matchAll(/data-part="([^"]+)"/g)].map((m) => m[1]));
    for (const part of used) expect(attrs).toContain(part);
  });

  it("骨格が要る部品にはすべて当たっている", () => {
    for (const part of ["root", "shadow", "inner", "front", "back", "content", "media", "layer", "beam", "reveal-stage", "flip-trigger"]) {
      expect(css).toContain(`[data-part="${part}"]`);
    }
  });

  it("どのセレクタも :where() で詳細度 0(利用者の class が必ず勝つ)", () => {
    const lines = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.includes("data-part") && /[{,]$/.test(l));
    expect(lines.length).toBeGreaterThan(10);
    for (const line of lines) expect(line).toMatch(/^:where\(/);
  });
});
