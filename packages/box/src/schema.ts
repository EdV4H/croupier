// Game Box のデータの形。
//
// 箱(box)は「部品(part)」「束(set)」「説明書(page)」をまとめたもの。
// 部品の見た目は「型(template)」が決め、部品は型の項目に値を入れるだけ。
// 遊び方(ルール)は持たない。それは croupier-core のプラグインが持つ。
//
// どれも JSON にそのまま書ける値だけで表す(DB の JSON 列・API・ファイルのどこにでも置ける)。

import { z } from "zod";

// ---------------------------------------------------------------------------
// 共通

/** 部品・束・型・ページの key。版をまたいで同じものを表す。 */
export const keySchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "key は小文字英数字とハイフン(先頭は英数字、64 文字まで)");

/** 型の項目名・束の属性名。英小文字で始め、英数字とアンダースコア(64 文字まで)。 */
export const fieldNameSchema = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9_]{0,63}$/, "項目名は英小文字で始め、英数字とアンダースコア(64 文字まで)");

/** 言語コード(ja / en / zh-Hans など)。 */
export const languageSchema = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/);

/** 言語ごとの文字列。 */
export const localizedTextSchema = z.record(languageSchema, z.string());

/** #RRGGBB または #RRGGBBAA。 */
export const colorSchema = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

/** 画像の参照。`asset:<id>` は箱の資材、http(s) は外部の URL。 */
export const assetRefSchema = z
  .string()
  .regex(/^(asset:[A-Za-z0-9._-]+|https?:\/\/.+)$/, "asset:<id> か http(s) の URL");

export const partKindSchema = z.enum(["card", "token", "piece", "board", "dice"]);
export type PartKind = z.infer<typeof partKindSchema>;

// ---------------------------------------------------------------------------
// 型(template)の項目

const fieldBase = { optional: z.boolean().optional() };

export const textFieldSchema = z.object({
  type: z.literal("text"),
  /** true なら言語ごとに値を持つ(部品の i18n に入る)。 */
  i18n: z.boolean().optional(),
  maxLength: z.number().int().positive().optional(),
  ...fieldBase,
});
export const imageFieldSchema = z.object({ type: z.literal("image"), ...fieldBase });
export const colorFieldSchema = z.object({ type: z.literal("color"), ...fieldBase });
export const numberFieldSchema = z.object({
  type: z.literal("number"),
  min: z.number().optional(),
  max: z.number().optional(),
  integer: z.boolean().optional(),
  ...fieldBase,
});
export const enumFieldSchema = z.object({
  type: z.literal("enum"),
  values: z.array(z.string().min(1)).min(1),
  ...fieldBase,
});

/** list の 1 件に入れられる項目(入れ子の list は持たない)。 */
export const scalarFieldSchema = z.discriminatedUnion("type", [
  textFieldSchema,
  imageFieldSchema,
  colorFieldSchema,
  numberFieldSchema,
  enumFieldSchema,
]);
export type ScalarField = z.infer<typeof scalarFieldSchema>;

export const listFieldSchema = z.object({
  type: z.literal("list"),
  item: z.record(fieldNameSchema, scalarFieldSchema),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  ...fieldBase,
});

export const fieldSchema = z.discriminatedUnion("type", [
  textFieldSchema,
  imageFieldSchema,
  colorFieldSchema,
  numberFieldSchema,
  enumFieldSchema,
  listFieldSchema,
]);
export type Field = z.infer<typeof fieldSchema>;

// ---------------------------------------------------------------------------
// レイヤー

/**
 * 値の参照。直接の値か、部品の項目(`$field`)か、繰り返し中の 1 件の項目(`$item`)。
 * 例: `{ "$field": "name" }`
 */
export const fieldRefSchema = z.object({ $field: fieldNameSchema }).strict();
export const itemRefSchema = z.object({ $item: fieldNameSchema }).strict();
export type FieldRef = z.infer<typeof fieldRefSchema>;
export type ItemRef = z.infer<typeof itemRefSchema>;

const ref = <T extends z.ZodTypeAny>(literal: T) => z.union([literal, fieldRefSchema, itemRefSchema]);

/** 配置。[x, y, 幅, 高さ](型の座標系)。 */
export const boxSchema = z.tuple([z.number(), z.number(), z.number().nonnegative(), z.number().nonnegative()]);
export type Box = z.infer<typeof boxSchema>;

/** 表示条件。項目の値が equals と同じか、in のどれかのときだけ描く。 */
export const conditionSchema = z
  .object({
    field: fieldNameSchema,
    equals: z.union([z.string(), z.number(), z.boolean()]).optional(),
    in: z.array(z.union([z.string(), z.number()])).optional(),
    /** true なら値が入っているときだけ描く。 */
    present: z.boolean().optional(),
  })
  .refine((c) => [c.equals, c.in, c.present].filter((v) => v !== undefined).length === 1, {
    message: "equals / in / present のどれか 1 つ",
  });
export type Condition = z.infer<typeof conditionSchema>;

const layerBase = {
  id: keySchema.optional(),
  when: conditionSchema.optional(),
  opacity: z.number().min(0).max(1).optional(),
};

export const fillLayerSchema = z.object({
  kind: z.literal("fill"),
  color: ref(colorSchema),
  ...layerBase,
});

export const imageLayerSchema = z.object({
  kind: z.literal("image"),
  src: ref(assetRefSchema),
  /** 省略時は面いっぱい。 */
  box: boxSchema.optional(),
  /** cover = はみ出しを切る / contain = 全体を収める。 */
  fit: z.enum(["cover", "contain"]).optional(),
  /** 読み上げ・代替テキスト。 */
  alt: ref(z.string()).optional(),
  ...layerBase,
});

export const textLayerSchema = z.object({
  kind: z.literal("text"),
  text: ref(z.string()),
  box: boxSchema,
  /** 箱が持つ書体の役割名(heading / body など)。実際の書体は描く側が決める。 */
  font: z.string().optional(),
  size: z.number().positive(),
  weight: z.union([z.literal("normal"), z.literal("bold"), z.number().int().min(100).max(900)]).optional(),
  color: ref(colorSchema).optional(),
  align: z.enum(["start", "center", "end"]).optional(),
  /** 箱に収まらないとき文字を詰める。 */
  shrink: z.boolean().optional(),
  ...layerBase,
});

export const shapeLayerSchema = z.object({
  kind: z.literal("shape"),
  shape: z.enum(["rect", "ellipse"]),
  box: boxSchema,
  radius: z.number().nonnegative().optional(),
  fill: ref(colorSchema).optional(),
  stroke: ref(colorSchema).optional(),
  strokeWidth: z.number().nonnegative().optional(),
  ...layerBase,
});

export const layerSchema = z.discriminatedUnion("kind", [
  fillLayerSchema,
  imageLayerSchema,
  textLayerSchema,
  shapeLayerSchema,
]);
export type Layer = z.infer<typeof layerSchema>;

// ---------------------------------------------------------------------------
// 型(template)

/** 部品の外形。card は角丸の長方形、token は丸か六角形、など。 */
export const outlineSchema = z.object({
  shape: z.enum(["rect", "circle", "hexagon"]),
  /** rect の角丸。 */
  radius: z.number().nonnegative().optional(),
});

/** 面。表・裏など名前付きで並べる。 */
export const faceSchema = z.object({
  name: keySchema,
  layers: z.array(layerSchema),
});
export type Face = z.infer<typeof faceSchema>;

/** list 項目の 1 件ごとに 1 面を作る(サイコロの 6 面など)。面の名前は `<prefix>-<1 始まりの番号>`。 */
export const repeatedFaceSchema = z.object({
  repeat: z.object({ field: fieldNameSchema, namePrefix: keySchema.optional() }),
  layers: z.array(layerSchema),
});
export type RepeatedFace = z.infer<typeof repeatedFaceSchema>;

export const templateSchema = z.object({
  key: keySchema,
  kind: partKindSchema,
  size: z.object({ w: z.number().positive(), h: z.number().positive() }),
  outline: outlineSchema.optional(),
  fields: z.record(fieldNameSchema, fieldSchema),
  faces: z.array(z.union([faceSchema, repeatedFaceSchema])).min(1),
});
export type Template = z.infer<typeof templateSchema>;

// ---------------------------------------------------------------------------
// 部品・束・説明書・箱

/** 部品の値に入れられるもの。 */
export const scalarValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export const fieldValueSchema = z.union([
  scalarValueSchema,
  z.array(z.record(fieldNameSchema, scalarValueSchema)),
]);
export type ScalarValue = z.infer<typeof scalarValueSchema>;
export type FieldValue = z.infer<typeof fieldValueSchema>;

export const partSchema = z.object({
  key: keySchema,
  /** 使う型の key。 */
  template: keySchema,
  /** 文字以外の値と、言語を持たない文字。 */
  fields: z.record(fieldNameSchema, fieldValueSchema),
  /** 言語ごとの文字(型で i18n: true の text 項目)。 */
  i18n: z.record(languageSchema, z.record(fieldNameSchema, z.string())).optional(),
});
export type Part = z.infer<typeof partSchema>;

export const setKindSchema = z.enum(["deck", "stock", "player_set", "board_setup"]);
export type SetKind = z.infer<typeof setKindSchema>;

export const setEntrySchema = z.object({
  part: keySchema,
  quantity: z.number().int().positive(),
  /** この束の中だけの属性(レアリティなど)。 */
  attrs: z.record(fieldNameSchema, scalarValueSchema).optional(),
});
export type SetEntry = z.infer<typeof setEntrySchema>;

export const setSchema = z.object({
  key: keySchema,
  kind: setKindSchema,
  names: localizedTextSchema,
  settings: z
    .object({
      /** deck: 裏向きで置く。 */
      faceDown: z.boolean().optional(),
      /** deck: 始める前に切り混ぜる。 */
      shuffle: z.boolean().optional(),
      /** player_set: 人数分を配る。 */
      perPlayer: z.boolean().optional(),
      /** player_set: 持ち主の色で塗る部品の key。 */
      tintWithOwnerColor: z.array(keySchema).optional(),
    })
    .optional(),
  entries: z.array(setEntrySchema).min(1),
});
export type PartSet = z.infer<typeof setSchema>;

export const pageSchema = z.object({
  slug: keySchema,
  language: languageSchema,
  title: z.string().min(1),
  /** Markdown。`::part[key]` `::card[key]` `::set[key]` で部品や束を埋め込む。 */
  body: z.string(),
});
export type Page = z.infer<typeof pageSchema>;

export const manifestSchema = z.object({
  title: localizedTextSchema,
  description: localizedTextSchema.optional(),
  /** 箱が対応する言語。部品の i18n 文字はこの全言語にそろえる。 */
  languages: z.array(languageSchema).min(1),
  players: z
    .object({ min: z.number().int().positive(), max: z.number().int().positive() })
    .refine((p) => p.min <= p.max, { message: "players.min は max 以下" })
    .optional(),
  minutes: z.number().int().positive().optional(),
  /** 遊ぶゲーム(play の gameId)と、既定で使う束。 */
  play: z.object({ gameId: keySchema, defaultSet: keySchema.optional() }).optional(),
  cover: assetRefSchema.optional(),
  /** 配布用の PDF など。 */
  attachments: z.array(assetRefSchema).optional(),
});
export type Manifest = z.infer<typeof manifestSchema>;

/** 箱 1 つぶん(1 つの版)。 */
export const boxDocumentSchema = z.object({
  key: keySchema,
  manifest: manifestSchema,
  templates: z.array(templateSchema).min(1),
  parts: z.array(partSchema).min(1),
  sets: z.array(setSchema),
  pages: z.array(pageSchema),
});
export type BoxDocument = z.infer<typeof boxDocumentSchema>;
