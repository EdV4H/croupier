# @edv4h/croupier-box

ゲームの「箱の中身」をデータで持つためのパッケージです。カード・トークン・コマ・盤・サイコロを **型(レイヤーの重なり)+ 値** で表し、束(山札・在庫・1 人ぶん・初期配置)と説明書(Markdown)と一緒に 1 つの箱にまとめます。

遊び方(ルール)は持ちません。ルールは `@edv4h/croupier-core` のプラグインが持ち、箱は「何が何個あり、どう見えるか」だけを持ちます。

```
型(template)  ─ 形・大きさ・面(表 / 裏 / サイコロの 6 面)・面ごとのレイヤー・項目
   ↑ 指す
部品(part)    ─ 項目の値(文字以外)+ 言語ごとの文字
   ↑ 指す
束(set)       ─ 部品 × 枚数(+ この束だけの属性)。deck / stock / player_set / board_setup
説明書(page)  ─ Markdown。::part[key] ::card[key] ::set[key] で埋め込む
箱(box)       ─ 上の全部 + manifest(題名・人数・遊ぶゲーム・既定の束)
```

## Install

```bash
npm install @edv4h/croupier-box
```

## Usage

```typescript
import { expandSet, indexBox, resolveFaces, validateBox } from "@edv4h/croupier-box";

const result = validateBox(json); // 形(zod)と、部品 → 型・束 → 部品・説明書 → 部品 の参照を見る
if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join("\n"));

const box = indexBox(result.box);
const deck = expandSet(box.set("basic")); // 山札を作る: 部品の key を枚数ぶん

// 描くだけの面(参照・言語・表示条件・面の繰り返しを解決済み)
const faces = resolveFaces(box.templateOf("challenge"), box.part("challenge"), {
  language: "ja",
  fallbackLanguages: ["en"],
});
```

描画は `@edv4h/croupier-box-render`(SVG)を使います。

見本は `@edv4h/croupier-box/examples` にあります(`valuesCardBox` と、全部の部品を使う架空のゲーム `missionRoadBox`)。

## License

MIT
