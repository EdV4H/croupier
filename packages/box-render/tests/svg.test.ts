import { indexBox, resolveFace, resolveFaces } from "@edv4h/croupier-box";
import { missionRoadBox, valuesCardBox } from "@edv4h/croupier-box/examples";
import { describe, expect, it } from "vitest";
import { estimateTextWidth, layoutText, renderFaceSvg, renderPartSvg } from "../src/index.js";

const vc = indexBox(valuesCardBox);
const mr = indexBox(missionRoadBox);
const assets = (src: string) => src.replace(/^asset:/, "https://assets.example.com/");

describe("renderFaceSvg", () => {
  it("Values Card の表は絵 1 枚を角丸で切って敷く", () => {
    const svg = renderPartSvg(vc.templateOf("challenge"), vc.part("challenge"), "front", { language: "ja" }, {
      resolveAsset: assets,
      idPrefix: "t",
    })!;
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).toContain('viewBox="0 0 168 244"');
    expect(svg).toContain('aria-label="挑戦"');
    expect(svg).toMatch(/<clipPath id="t-[0-9a-z]+"><rect width="168" height="244" rx="8"\/><\/clipPath>/);
    expect(svg).toContain('href="https://assets.example.com/vc-challenge"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
  });

  it("出力の幅を変えても縦横比を保つ", () => {
    const face = resolveFace(vc.templateOf("challenge"), vc.part("challenge"), "back", { language: "ja" })!;
    expect(renderFaceSvg(face, { width: 84 })).toContain('width="84" height="122"');
  });

  it("丸・六角のトークンは外形で切る", () => {
    const trust = resolveFace(mr.templateOf("trust"), mr.part("trust"), "front", { language: "ja" })!;
    expect(renderFaceSvg(trust)).toContain('<ellipse cx="50" cy="50" rx="50" ry="50"/>');
    const star = resolveFace(mr.templateOf("achievement"), mr.part("achievement"), "front", { language: "ja" })!;
    expect(renderFaceSvg(star)).toContain('<polygon points="0,50 27.5,0 82.5,0 110,50 82.5,100 27.5,100"/>');
  });

  it("サイコロは 6 面ぶん描ける", () => {
    const faces = resolveFaces(mr.templateOf("action-die"), mr.part("action-die"), { language: "ja" });
    const svgs = faces.map((f) => renderFaceSvg(f));
    expect(svgs).toHaveLength(6);
    expect(svgs[3]).toContain(">話す</tspan>");
    expect(svgs[3]).toContain('text-anchor="middle"');
  });

  it("文字は書体の役割名を font-family にし、特殊文字を逃がす", () => {
    const card = structuredClone(mr.part("event-storm"));
    card.i18n!.ja!.name = "<嵐> & \"夜\"";
    const svg = renderPartSvg(mr.templateOf("event-storm"), card, "front", { language: "ja" }, {
      fonts: { heading: "Zen Kaku Gothic New" },
    })!;
    expect(svg).toContain("&lt;嵐&gt; &amp; \"夜\"");
    expect(svg).not.toContain("<嵐>");
  });

  it("持ち主の色で塗ったコマ", () => {
    const svg = renderPartSvg(mr.templateOf("explorer"), mr.part("explorer"), "front", {
      language: "ja",
      overrides: { color: "#2D6CC4" },
    })!;
    expect(svg.match(/fill="#2D6CC4"/g)).toHaveLength(3);
    expect(svg).toContain('opacity="0.6"');
  });
});

describe("layoutText", () => {
  it("全角は 1em・半角は 0.55em で見積もる", () => {
    expect(estimateTextWidth("挑戦", 10)).toBe(20);
    expect(estimateTextWidth("ab", 10)).toBe(11);
  });

  it("箱の幅で折り返す(英単語は切らない)", () => {
    const { lines } = layoutText({ text: "Before drawing an event, look", box: [0, 0, 100, 200], size: 20, shrink: false });
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => !/\w-$/.test(l))).toBe(true);
    expect(lines.join(" ")).toBe("Before drawing an event, look");
  });

  it("shrink なら収まるまで小さくする(下限は半分)", () => {
    const fit = layoutText({ text: "とても長いカードの名前", box: [0, 0, 200, 30], size: 30, shrink: true });
    expect(fit.size).toBeLessThan(30);
    expect(fit.lines).toHaveLength(1);
    const floor = layoutText({ text: "あ".repeat(200), box: [0, 0, 100, 20], size: 20, shrink: true });
    expect(floor.size).toBe(10);
  });
});
