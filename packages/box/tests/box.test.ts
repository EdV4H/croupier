import { describe, expect, it } from "vitest";
import {
  type BoxDocument,
  countSet,
  expandSet,
  indexBox,
  parseEmbeds,
  replaceEmbeds,
  resolveFace,
  resolveFaces,
  validateBox,
} from "../src/index.js";
import { missionRoadBox, valuesCardBox } from "../src/examples/index.js";

const clone = <T>(v: T): T => structuredClone(v);

describe("validateBox", () => {
  it.each([
    ["Values Card", valuesCardBox],
    ["ミッション・ロード", missionRoadBox],
  ])("見本 %s は問題なし", (_, box) => {
    const result = validateBox(box);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("形の誤りは zod の issue で返す", () => {
    const box = clone(valuesCardBox) as unknown as Record<string, unknown>;
    box.key = "Values Card";
    const result = validateBox(box);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.path).toBe("key");
  });

  it("部品が無い型を指すと怒る", () => {
    const box = clone(valuesCardBox);
    box.parts[0]!.template = "missing";
    expect(validateBox(box).issues).toContainEqual({ path: "parts[challenge].template", message: "型 missing がない" });
  });

  it("言語ごとの文字が manifest の言語にそろっていないと怒る", () => {
    const box = clone(valuesCardBox);
    delete box.parts[1]!.i18n!.en;
    expect(validateBox(box).issues).toContainEqual({ path: "parts[honesty].i18n.en.name", message: "必須の文字がない" });
  });

  it("enum・色・画像の値を検査する", () => {
    const box = clone(valuesCardBox);
    box.parts[0]!.fields.animation_type = "spin";
    box.parts[0]!.fields.background_color = "orange";
    box.parts[0]!.fields.art = "vc-challenge.png";
    const paths = validateBox(box).issues.map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "parts[challenge].fields.animation_type",
        "parts[challenge].fields.background_color",
        "parts[challenge].fields.art",
      ]),
    );
  });

  it("型に無い項目・i18n に入れるべき文字を怒る", () => {
    const box = clone(valuesCardBox);
    box.parts[0]!.fields.rarity = "SR";
    box.parts[0]!.fields.name = "挑戦";
    const issues = validateBox(box).issues.map((i) => i.message);
    expect(issues).toContain("型 values-card-face に項目 rarity がない");
    expect(issues).toContain("name は言語ごとの文字なので i18n に入れる");
  });

  it("束の参照・重複・既定の束を調べる", () => {
    const box = clone(valuesCardBox);
    box.sets[0]!.entries.push({ part: "ghost", quantity: 1 }, { part: "challenge", quantity: 2 });
    box.manifest.play!.defaultSet = "advanced";
    const messages = validateBox(box).issues.map((i) => i.message);
    expect(messages).toContain("部品 ghost がない");
    expect(messages).toContain("部品 challenge が束の中で重複している");
    expect(messages).toContain("束 advanced がない");
  });

  it("説明書の埋め込みの参照先を調べる", () => {
    const box = clone(missionRoadBox);
    box.pages[0]!.body += "\n::set[nothing] ::card[trust]";
    const messages = validateBox(box).issues.map((i) => i.message);
    expect(messages).toContain("::set[nothing] の参照先がない");
    expect(messages).toContain("::card[trust] はカードではない(token)");
  });

  it("レイヤーの参照を調べる($item は repeat の中だけ)", () => {
    const box = clone(missionRoadBox) as BoxDocument;
    const board = box.templates.find((t) => t.key === "mr-board")!;
    const face = board.faces[0] as { layers: unknown[] };
    face.layers.push({ kind: "text", text: { $item: "label" }, box: [0, 0, 10, 10], size: 10 });
    face.layers.push({ kind: "image", src: { $field: "nope" } });
    const messages = validateBox(box).issues.map((i) => i.message);
    expect(messages).toContain("$item は repeat の面の中でだけ使える");
    expect(messages).toContain("項目 nope がない");
  });

  it("サイコロの面の数を list の長さで縛る", () => {
    const box = clone(missionRoadBox);
    const dice = box.parts.find((p) => p.key === "action-dice")!;
    (dice.fields.faces as unknown[]).pop();
    expect(validateBox(box).issues).toContainEqual({ path: "parts[action-dice].fields.faces", message: "6 件以上" });
  });
});

describe("resolveFaces", () => {
  const vc = indexBox(valuesCardBox);
  const mr = indexBox(missionRoadBox);

  it("Values Card は表(絵 1 枚)と裏の 2 面", () => {
    const faces = resolveFaces(vc.templateOf("challenge"), vc.part("challenge"), { language: "en" });
    expect(faces.map((f) => f.name)).toEqual(["front", "back"]);
    expect(faces[0]).toMatchObject({
      width: 168,
      height: 244,
      outline: { shape: "rect", radius: 8 },
      layers: [{ kind: "image", src: "asset:vc-challenge", box: [0, 0, 168, 244], fit: "cover", alt: "Challenge" }],
    });
  });

  it("言語が無ければ fallback を使う", () => {
    const front = resolveFace(vc.templateOf("challenge"), vc.part("challenge"), "front", {
      language: "fr",
      fallbackLanguages: ["en", "ja"],
    });
    expect((front!.layers[0] as { alt: string }).alt).toBe("Challenge");
  });

  it("サイコロは list の 1 件ごとに 1 面", () => {
    const faces = resolveFaces(mr.templateOf("action-dice"), mr.part("action-dice"), { language: "ja" });
    expect(faces.map((f) => f.name)).toEqual(["face-1", "face-2", "face-3", "face-4", "face-5", "face-6"]);
    expect(faces[4]!.layers.find((l) => l.kind === "text")).toMatchObject({ text: "助ける", align: "center", shrink: true });
  });

  it("表示条件 when で描くレイヤーを選ぶ", () => {
    const storm = resolveFace(mr.templateOf("event-storm"), mr.part("event-storm"), "front", { language: "ja" })!;
    const bars = storm.layers.filter((l) => l.kind === "shape");
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ fill: "#B8383D" });

    const issue = resolveFace(mr.templateOf("issue"), mr.part("issue"), "front", { language: "ja" })!;
    expect(issue.layers.some((l) => l.kind === "text")).toBe(false); // value が無いので数字を出さない
    const trust = resolveFace(mr.templateOf("trust"), mr.part("trust"), "front", { language: "ja" })!;
    expect(trust.layers.find((l) => l.kind === "text")).toMatchObject({ text: "1" });
  });

  it("持ち主の色で上書きできる(player_set の tintWithOwnerColor)", () => {
    const piece = resolveFace(mr.templateOf("explorer"), mr.part("explorer"), "front", {
      language: "ja",
      overrides: { color: "#E8743B" },
    })!;
    const fills = piece.layers.filter((l) => l.kind === "shape").map((l) => (l as { fill: string }).fill);
    expect(new Set(fills)).toEqual(new Set(["#E8743B"]));
  });
});

describe("sets", () => {
  it("束を枚数ぶん開く", () => {
    const events = indexBox(missionRoadBox).set("events");
    expect(expandSet(events)).toEqual(["event-storm", "event-storm", "event-storm", "event-bridge", "event-bridge"]);
    expect(countSet(indexBox(missionRoadBox).set("tokens"))).toBe(72);
  });

  it("無い key は投げる", () => {
    expect(() => indexBox(valuesCardBox).part("ghost")).toThrow("部品 ghost が箱 values-card にない");
  });
});

describe("embeds", () => {
  it("記法を拾って置き換える", () => {
    const body = "配る ::set[starter] と ::part[issue]、カード ::card[challenge]";
    expect(parseEmbeds(body).map((e) => `${e.kind}:${e.key}`)).toEqual(["set:starter", "part:issue", "card:challenge"]);
    expect(replaceEmbeds(body, (e) => `<${e.kind} ${e.key}>`)).toBe(
      "配る <set starter> と <part issue>、カード <card challenge>",
    );
  });
});
