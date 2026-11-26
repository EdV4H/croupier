# @edv4h/croupier-trading-card

ポインタに追従して傾き、光り、めくれるトレーディングカードの React 部品(headless)です。Ark UI と zag の状態機械の上に作っていて、見た目はほとんど持ちません。

もとは atrae-ui の `@atrae/ui-base` にあったもので、atrae-ui はこのパッケージを再公開しています。

```
Root ─┬─ (shadow)            Root が中で描く影
      └─ (inner) ─┬─ Front ─┬─ Content / Media / Label
                  │         └─ Layer × n   光の層(見た目は利用者)
                  ├─ Back
                  ├─ Beam                  走査光
                  └─ RevealStage           出現演出の光・粒子
FlipTrigger                                 めくるボタン
```

## Install

```bash
npm install @edv4h/croupier-trading-card @ark-ui/react @zag-js/anatomy @zag-js/core @zag-js/react @zag-js/types
```

## Usage

```tsx
import { TradingCard } from "@edv4h/croupier-trading-card";
import "@edv4h/croupier-trading-card/styles.css"; // Panda のレシピで当てる場合は不要

<TradingCard.Root finish={{ tilt: { max: 12 } }}>
  <TradingCard.Front>
    <TradingCard.Media ratio={1}>
      <img src="/art.png" alt="" />
    </TradingCard.Media>
    <TradingCard.Layer className="holo" />
  </TradingCard.Front>
  <TradingCard.Back>…</TradingCard.Back>
</TradingCard.Root>
```

## CSS

`styles.css` は骨格だけです(CSS 変数の既定値・3D の傾き・裏面の隠し方・各部品の配置)。セレクタはすべて `:where()` で詳細度 0 なので、利用者の class が必ず勝ちます。光の層の見た目(箔・ホロ・グレア)は出荷しません。

色と角丸は `--tc-radius` `--tc-media-radius` `--tc-surface` `--tc-on-surface` `--tc-media-surface` `--tc-focus` で差し替えます。ポインタ由来の値は JS が root の `--tc-px` `--tc-py`(単位なしの数値)`--tc-rx` `--tc-ry` などに書き込みます。

## License

MIT
