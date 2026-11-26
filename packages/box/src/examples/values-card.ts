// 見本 1: Values Card を箱にした形(カード 3 枚だけの抜粋。実物は 70 枚)。
//
// 最初の型は「名前を焼き込み済みの絵 1 枚」をそのまま敷く。レイヤーに分けた絵が
// できたら型の版を上げ、箱の版で差し替える。

import type { BoxDocument } from "../schema.js";

export const valuesCardBox: BoxDocument = {
  key: "values-card",
  manifest: {
    title: { ja: "Values Card", en: "Values Card" },
    description: {
      ja: "価値観カードを引いて捨てながら、自分の大切にしたい 5 枚を選ぶ",
      en: "Draw and discard value cards until you keep the five that matter most to you",
    },
    languages: ["ja", "en"],
    players: { min: 2, max: 8 },
    minutes: 30,
    play: { gameId: "values-card", defaultSet: "basic" },
    cover: "asset:vc-cover",
  },
  templates: [
    {
      key: "values-card-face",
      kind: "card",
      size: { w: 168, h: 244 },
      outline: { shape: "rect", radius: 8 },
      fields: {
        name: { type: "text", i18n: true, maxLength: 32 },
        art: { type: "image" },
        small_art: { type: "image" },
        animation_type: {
          type: "enum",
          values: ["symbol_spread", "mask_spread", "mask_spread_right", "mask_spread_above", "mask_spread_expansion"],
        },
        animation_art: { type: "image" },
        background_color: { type: "color", optional: true },
      },
      faces: [
        {
          name: "front",
          layers: [{ kind: "image", src: { $field: "art" }, fit: "cover", alt: { $field: "name" } }],
        },
        { name: "back", layers: [{ kind: "image", src: "asset:vc-back", fit: "cover" }] },
      ],
    },
  ],
  parts: [
    {
      key: "challenge",
      template: "values-card-face",
      fields: {
        art: "asset:vc-challenge",
        small_art: "asset:vc-challenge-s",
        animation_type: "symbol_spread",
        animation_art: "asset:vc-challenge-anim",
        background_color: "#E8743B",
      },
      i18n: { ja: { name: "挑戦" }, en: { name: "Challenge" } },
    },
    {
      key: "honesty",
      template: "values-card-face",
      fields: {
        art: "asset:vc-honesty",
        small_art: "asset:vc-honesty-s",
        animation_type: "mask_spread",
        animation_art: "asset:vc-honesty-anim",
      },
      i18n: { ja: { name: "誠実" }, en: { name: "Honesty" } },
    },
    {
      key: "growth",
      template: "values-card-face",
      fields: {
        art: "asset:vc-growth",
        small_art: "asset:vc-growth-s",
        animation_type: "mask_spread_above",
        animation_art: "asset:vc-growth-anim",
      },
      i18n: { ja: { name: "成長" }, en: { name: "Growth" } },
    },
  ],
  sets: [
    {
      key: "basic",
      kind: "deck",
      names: { ja: "基本デッキ", en: "Basic deck" },
      settings: { faceDown: true, shuffle: true },
      entries: [
        { part: "challenge", quantity: 1 },
        { part: "honesty", quantity: 1 },
        { part: "growth", quantity: 1 },
      ],
    },
  ],
  pages: [
    {
      slug: "how-to-play",
      language: "ja",
      title: "遊び方",
      body: "# 遊び方\n\n1. 1 人 5 枚ずつ配る\n2. 手番では山札から 1 枚引き、手札から 1 枚捨てる\n3. 山札がなくなったら、残った 5 枚があなたの価値観\n\n::card[challenge]\n",
    },
    {
      slug: "how-to-play",
      language: "en",
      title: "How to play",
      body: "# How to play\n\n1. Deal five cards to each player\n2. On your turn, draw one card and discard one\n3. When the deck runs out, the five you hold are your values\n\n::card[challenge]\n",
    },
    {
      slug: "card-list",
      language: "ja",
      title: "カード一覧",
      body: "::set[basic]\n",
    },
    {
      slug: "card-list",
      language: "en",
      title: "Cards",
      body: "::set[basic]\n",
    },
  ],
};
