// 見本 2: 部品を全部使う架空の協力ゲーム「ミッション・ロード」(抜粋)。
//
// 盤・コマ・トークン・サイコロ・カードと、山札・在庫・1 人ぶん・初期配置の 4 種類の束。
// ルール(役割を配る・サイコロの面で何が起きるか・ゴール条件)は箱には入れない。

import type { BoxDocument } from "../schema.js";

export const missionRoadBox: BoxDocument = {
  key: "mission-road",
  manifest: {
    title: { ja: "ミッション・ロード", en: "Mission Road" },
    languages: ["ja", "en"],
    players: { min: 3, max: 6 },
    minutes: 45,
    play: { gameId: "mission-road" },
    attachments: ["asset:mr-rulebook-pdf"],
  },
  templates: [
    {
      key: "mr-board",
      kind: "board",
      size: { w: 1200, h: 800 },
      outline: { shape: "rect", radius: 16 },
      fields: { art: { type: "image" }, title: { type: "text", i18n: true } },
      faces: [
        {
          name: "front",
          layers: [
            { kind: "image", src: { $field: "art" }, fit: "cover" },
            { kind: "text", text: { $field: "title" }, box: [40, 24, 600, 64], size: 44, weight: "bold", color: "#1B2130" },
          ],
        },
      ],
    },
    {
      key: "mr-piece",
      kind: "piece",
      size: { w: 80, h: 120 },
      fields: { color: { type: "color" }, art: { type: "image" } },
      faces: [
        {
          name: "front",
          layers: [
            { kind: "shape", shape: "ellipse", box: [10, 70, 60, 44], fill: { $field: "color" } },
            { kind: "shape", shape: "ellipse", box: [22, 8, 36, 36], fill: { $field: "color" } },
            { kind: "shape", shape: "rect", box: [26, 40, 28, 40], radius: 10, fill: { $field: "color" } },
            { kind: "image", src: { $field: "art" }, box: [20, 70, 40, 40], fit: "contain", opacity: 0.6 },
          ],
        },
      ],
    },
    {
      key: "mr-token-round",
      kind: "token",
      size: { w: 100, h: 100 },
      outline: { shape: "circle" },
      fields: {
        icon: { type: "image" },
        color: { type: "color" },
        value: { type: "number", integer: true, min: 1, optional: true },
      },
      faces: [
        {
          name: "front",
          layers: [
            { kind: "fill", color: { $field: "color" } },
            { kind: "image", src: { $field: "icon" }, box: [25, 18, 50, 50], fit: "contain" },
            {
              kind: "text",
              text: { $field: "value" },
              box: [0, 68, 100, 24],
              size: 20,
              weight: "bold",
              color: "#FFFFFF",
              align: "center",
              when: { field: "value", present: true },
            },
          ],
        },
      ],
    },
    {
      key: "mr-token-hex",
      kind: "token",
      size: { w: 110, h: 100 },
      outline: { shape: "hexagon" },
      fields: { icon: { type: "image" }, color: { type: "color" } },
      faces: [
        {
          name: "front",
          layers: [
            { kind: "fill", color: { $field: "color" } },
            { kind: "image", src: { $field: "icon" }, box: [30, 25, 50, 50], fit: "contain" },
          ],
        },
      ],
    },
    {
      key: "mr-dice-d6",
      kind: "dice",
      size: { w: 120, h: 120 },
      outline: { shape: "rect", radius: 20 },
      fields: {
        faces: {
          type: "list",
          minLength: 6,
          maxLength: 6,
          item: { icon: { type: "image" }, label: { type: "text" } },
        },
      },
      faces: [
        {
          repeat: { field: "faces", namePrefix: "face" },
          layers: [
            { kind: "fill", color: "#FFFFFF" },
            { kind: "image", src: { $item: "icon" }, box: [30, 14, 60, 60], fit: "contain" },
            { kind: "text", text: { $item: "label" }, box: [6, 82, 108, 28], size: 20, align: "center", shrink: true },
          ],
        },
      ],
    },
    {
      key: "mr-event-card",
      kind: "card",
      size: { w: 630, h: 880 },
      outline: { shape: "rect", radius: 24 },
      fields: {
        name: { type: "text", i18n: true, maxLength: 24 },
        text: { type: "text", i18n: true, maxLength: 120 },
        art: { type: "image" },
        tone: { type: "enum", values: ["good", "bad"] },
      },
      faces: [
        {
          name: "front",
          layers: [
            { kind: "fill", color: "#F4F1E8" },
            { kind: "image", src: { $field: "art" }, box: [40, 60, 550, 440], fit: "cover" },
            { kind: "shape", shape: "rect", box: [0, 0, 630, 24], fill: "#2F8F86", when: { field: "tone", equals: "good" } },
            { kind: "shape", shape: "rect", box: [0, 0, 630, 24], fill: "#B8383D", when: { field: "tone", equals: "bad" } },
            { kind: "text", text: { $field: "name" }, box: [40, 530, 550, 70], size: 48, weight: "bold", color: "#1B2130", shrink: true },
            { kind: "text", text: { $field: "text" }, box: [40, 620, 550, 200], size: 30, color: "#333A48" },
          ],
        },
        { name: "back", layers: [{ kind: "image", src: "asset:mr-event-back", fit: "cover" }] },
      ],
    },
    {
      key: "mr-role-card",
      kind: "card",
      size: { w: 630, h: 880 },
      outline: { shape: "rect", radius: 24 },
      fields: {
        name: { type: "text", i18n: true },
        ability: { type: "text", i18n: true },
        art: { type: "image" },
        color: { type: "color" },
      },
      faces: [
        {
          name: "front",
          layers: [
            { kind: "fill", color: { $field: "color" } },
            { kind: "image", src: { $field: "art" }, box: [60, 60, 510, 480], fit: "contain" },
            { kind: "text", text: { $field: "name" }, box: [40, 580, 550, 70], size: 52, weight: "bold", color: "#FFFFFF", align: "center" },
            { kind: "text", text: { $field: "ability" }, box: [40, 670, 550, 160], size: 30, color: "#FFFFFF", align: "center" },
          ],
        },
        { name: "back", layers: [{ kind: "image", src: "asset:mr-role-back", fit: "cover" }] },
      ],
    },
    // Values Card の型と部品を取り込んで使う(DB では box_parts.source_part_id で元をたどる)
    {
      key: "values-card-face",
      kind: "card",
      size: { w: 168, h: 244 },
      outline: { shape: "rect", radius: 8 },
      fields: { name: { type: "text", i18n: true }, art: { type: "image" } },
      faces: [
        { name: "front", layers: [{ kind: "image", src: { $field: "art" }, alt: { $field: "name" } }] },
        { name: "back", layers: [{ kind: "image", src: "asset:vc-back" }] },
      ],
    },
  ],
  parts: [
    { key: "road-board", template: "mr-board", fields: { art: "asset:mr-board" }, i18n: { ja: { title: "ミッション・ロード" }, en: { title: "Mission Road" } } },
    { key: "explorer", template: "mr-piece", fields: { color: "#888888", art: "asset:mr-explorer" } },
    { key: "trust", template: "mr-token-round", fields: { icon: "asset:mr-trust", color: "#2F8F86", value: 1 } },
    { key: "issue", template: "mr-token-round", fields: { icon: "asset:mr-issue", color: "#B8383D" } },
    { key: "achievement", template: "mr-token-hex", fields: { icon: "asset:mr-star", color: "#C9A227" } },
    {
      key: "action-dice",
      template: "mr-dice-d6",
      fields: {
        faces: [
          { icon: "asset:mr-step", label: "進む 1" },
          { icon: "asset:mr-step", label: "進む 2" },
          { icon: "asset:mr-step", label: "進む 3" },
          { icon: "asset:mr-talk", label: "話す" },
          { icon: "asset:mr-help", label: "助ける" },
          { icon: "asset:mr-rest", label: "休む" },
        ],
      },
    },
    {
      key: "event-storm",
      template: "mr-event-card",
      fields: { art: "asset:mr-storm", tone: "bad" },
      i18n: {
        ja: { name: "嵐の夜", text: "全員が信頼トークンを 1 つ手放す。誰かを助けた人は手放さない。" },
        en: { name: "Stormy night", text: "Everyone gives up one trust token. Anyone who helped someone this round keeps theirs." },
      },
    },
    {
      key: "event-bridge",
      template: "mr-event-card",
      fields: { art: "asset:mr-bridge", tone: "good" },
      i18n: {
        ja: { name: "橋がかかる", text: "次の手番、全員が 1 マス多く進める。" },
        en: { name: "A bridge appears", text: "On your next turn, everyone moves one extra space." },
      },
    },
    {
      key: "role-navigator",
      template: "mr-role-card",
      fields: { art: "asset:mr-navigator", color: "#2D6CC4" },
      i18n: {
        ja: { name: "ナビゲーター", ability: "出来事カードを引く前に、山札の上 2 枚を見てよい。" },
        en: { name: "Navigator", ability: "Before drawing an event, you may look at the top two cards." },
      },
    },
    {
      key: "challenge",
      template: "values-card-face",
      fields: { art: "asset:vc-challenge" },
      i18n: { ja: { name: "挑戦" }, en: { name: "Challenge" } },
    },
  ],
  sets: [
    {
      key: "events",
      kind: "deck",
      names: { ja: "出来事", en: "Events" },
      settings: { faceDown: true, shuffle: true },
      entries: [
        { part: "event-storm", quantity: 3 },
        { part: "event-bridge", quantity: 2 },
      ],
    },
    {
      key: "roles",
      kind: "deck",
      names: { ja: "役割", en: "Roles" },
      settings: { faceDown: true, shuffle: true },
      entries: [{ part: "role-navigator", quantity: 1 }],
    },
    {
      key: "values",
      kind: "deck",
      names: { ja: "価値観", en: "Values" },
      settings: { faceDown: true, shuffle: true },
      entries: [{ part: "challenge", quantity: 1, attrs: { rarity: "R" } }],
    },
    {
      key: "tokens",
      kind: "stock",
      names: { ja: "トークン置き場", en: "Token supply" },
      entries: [
        { part: "trust", quantity: 40 },
        { part: "issue", quantity: 20 },
        { part: "achievement", quantity: 10 },
        { part: "action-dice", quantity: 2 },
      ],
    },
    {
      key: "starter",
      kind: "player_set",
      names: { ja: "1 人ぶん", en: "Player starter" },
      settings: { perPlayer: true, tintWithOwnerColor: ["explorer"] },
      entries: [
        { part: "explorer", quantity: 1 },
        { part: "trust", quantity: 3 },
      ],
    },
    {
      key: "setup",
      kind: "board_setup",
      names: { ja: "最初の配置", en: "Initial setup" },
      entries: [
        { part: "road-board", quantity: 1 },
        { part: "issue", quantity: 5 },
      ],
    },
  ],
  pages: [
    {
      slug: "how-to-play",
      language: "ja",
      title: "遊び方",
      body: [
        "# 遊び方",
        "1. 盤を広げ、課題トークンを GOAL の手前に置く ::part[issue]",
        "2. 各自 ::set[starter] を受け取る",
        "3. 役割カードを 1 枚ずつ配る ::set[roles]",
        "4. 手番では ::part[action-dice] を振る",
        "",
      ].join("\n"),
    },
    {
      slug: "how-to-play",
      language: "en",
      title: "How to play",
      body: [
        "# How to play",
        "1. Lay out the board and place issue tokens before the goal ::part[issue]",
        "2. Each player takes ::set[starter]",
        "3. Deal one role card to each player ::set[roles]",
        "4. On your turn, roll ::part[action-dice]",
        "",
      ].join("\n"),
    },
  ],
};
