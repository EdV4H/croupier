# @edv4h/croupier-box-render

`@edv4h/croupier-box` の部品の面を SVG の文字列にします。ブラウザでもサーバーでも同じ結果になります(DOM を使いません)。

```typescript
import { indexBox } from "@edv4h/croupier-box";
import { renderPartSvg } from "@edv4h/croupier-box-render";

const box = indexBox(json);
const svg = renderPartSvg(box.templateOf("challenge"), box.part("challenge"), "front", { language: "ja" }, {
  resolveAsset: (src) => src.replace(/^asset:/, "https://assets.example.com/"),
  fonts: { heading: "Zen Kaku Gothic New" },
  width: 240,
});
```

- 外形(角丸の長方形・円・六角形)で全体を切り、レイヤーを順に重ねます
- 画像は `fit: cover` ならはみ出しを切り、`contain` なら全体を収めます
- 文字は箱の幅で折り返し、`shrink: true` なら箱に収まるまで小さくします(下限は元の半分)。文字幅はフォントを読まずに見積もります(全角 1em・半角 0.55em)

PNG への書き出しはまだありません。

## License

MIT
