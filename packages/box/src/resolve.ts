// 型 + 部品の値 → 描くだけの面(参照も条件も残っていないレイヤーの列)。
//
// 描く側(croupier-box-render など)はこの結果だけを見ればよく、
// 項目の参照・言語の選び方・表示条件・面の繰り返しを知らなくて済む。

import type { Box, Condition, Field, FieldValue, Layer, Part, ScalarValue, Template } from "./schema.js";

export interface ResolvedFill {
  kind: "fill";
  color: string;
  opacity?: number;
}
export interface ResolvedImage {
  kind: "image";
  src: string;
  box: Box;
  fit: "cover" | "contain";
  alt?: string;
  opacity?: number;
}
export interface ResolvedText {
  kind: "text";
  text: string;
  box: Box;
  font?: string;
  size: number;
  weight?: "normal" | "bold" | number;
  color: string;
  align: "start" | "center" | "end";
  shrink: boolean;
  opacity?: number;
}
export interface ResolvedShape {
  kind: "shape";
  shape: "rect" | "ellipse";
  box: Box;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}
export type ResolvedLayer = ResolvedFill | ResolvedImage | ResolvedText | ResolvedShape;

export interface ResolvedFace {
  name: string;
  width: number;
  height: number;
  outline: NonNullable<Template["outline"]>;
  layers: ResolvedLayer[];
}

export interface ResolveOptions {
  /** 文字を出す言語。無ければ fallbackLanguages を順に見る。 */
  language: string;
  fallbackLanguages?: readonly string[];
  /** 項目の値を上書きする(player_set の持ち主の色など)。 */
  overrides?: Record<string, FieldValue>;
}

const DEFAULT_TEXT_COLOR = "#000000";

/** 部品の全部の面を解決する。 */
export function resolveFaces(template: Template, part: Part, options: ResolveOptions): ResolvedFace[] {
  const lookup = makeLookup(template, part, options);
  const outline = template.outline ?? { shape: "rect" as const };
  const faces: ResolvedFace[] = [];

  for (const face of template.faces) {
    if ("repeat" in face) {
      const items = lookup(face.repeat.field);
      if (!Array.isArray(items)) continue;
      const prefix = face.repeat.namePrefix ?? "face";
      items.forEach((item, i) => {
        faces.push({
          name: `${prefix}-${i + 1}`,
          width: template.size.w,
          height: template.size.h,
          outline,
          layers: resolveLayers(face.layers, template, lookup, item),
        });
      });
    } else {
      faces.push({
        name: face.name,
        width: template.size.w,
        height: template.size.h,
        outline,
        layers: resolveLayers(face.layers, template, lookup, undefined),
      });
    }
  }
  return faces;
}

/** 名前を指定して 1 面だけ解決する(無ければ undefined)。 */
export function resolveFace(
  template: Template,
  part: Part,
  faceName: string,
  options: ResolveOptions,
): ResolvedFace | undefined {
  return resolveFaces(template, part, options).find((f) => f.name === faceName);
}

// ---------------------------------------------------------------------------

type Lookup = (field: string) => FieldValue | undefined;
type Item = Record<string, ScalarValue> | undefined;

function makeLookup(template: Template, part: Part, options: ResolveOptions): Lookup {
  const languages = [options.language, ...(options.fallbackLanguages ?? [])];
  return (name) => {
    if (options.overrides && name in options.overrides) return options.overrides[name];
    const field: Field | undefined = template.fields[name];
    if (field?.type === "text" && field.i18n) {
      for (const lang of languages) {
        const v = part.i18n?.[lang]?.[name];
        if (v !== undefined) return v;
      }
      return undefined;
    }
    return part.fields[name];
  };
}

function resolveLayers(layers: readonly Layer[], template: Template, lookup: Lookup, item: Item): ResolvedLayer[] {
  const out: ResolvedLayer[] = [];
  const full: Box = [0, 0, template.size.w, template.size.h];
  const get = (v: unknown): ScalarValue | undefined => resolveRef(v, lookup, item);

  for (const layer of layers) {
    if (layer.when && !matches(layer.when, lookup)) continue;
    const opacity = layer.opacity;
    switch (layer.kind) {
      case "fill": {
        const color = asString(get(layer.color));
        if (color) out.push({ kind: "fill", color, ...(opacity !== undefined && { opacity }) });
        break;
      }
      case "image": {
        const src = asString(get(layer.src));
        if (!src) break;
        const alt = layer.alt === undefined ? undefined : asString(get(layer.alt));
        out.push({
          kind: "image",
          src,
          box: layer.box ?? full,
          fit: layer.fit ?? "cover",
          ...(alt !== undefined && { alt }),
          ...(opacity !== undefined && { opacity }),
        });
        break;
      }
      case "text": {
        const raw = get(layer.text);
        if (raw === undefined || raw === "") break;
        out.push({
          kind: "text",
          text: String(raw),
          box: layer.box,
          ...(layer.font !== undefined && { font: layer.font }),
          size: layer.size,
          ...(layer.weight !== undefined && { weight: layer.weight }),
          color: asString(get(layer.color)) ?? DEFAULT_TEXT_COLOR,
          align: layer.align ?? "start",
          shrink: layer.shrink ?? false,
          ...(opacity !== undefined && { opacity }),
        });
        break;
      }
      case "shape": {
        const fill = layer.fill === undefined ? undefined : asString(get(layer.fill));
        const stroke = layer.stroke === undefined ? undefined : asString(get(layer.stroke));
        if (!fill && !stroke) break;
        out.push({
          kind: "shape",
          shape: layer.shape,
          box: layer.box,
          ...(layer.radius !== undefined && { radius: layer.radius }),
          ...(fill && { fill }),
          ...(stroke && { stroke, strokeWidth: layer.strokeWidth ?? 1 }),
          ...(opacity !== undefined && { opacity }),
        });
        break;
      }
    }
  }
  return out;
}

function resolveRef(value: unknown, lookup: Lookup, item: Item): ScalarValue | undefined {
  if (value && typeof value === "object") {
    if ("$field" in value) {
      const v = lookup((value as { $field: string }).$field);
      return Array.isArray(v) ? undefined : v;
    }
    if ("$item" in value) return item?.[(value as { $item: string }).$item];
    return undefined;
  }
  return value as ScalarValue | undefined;
}

function matches(condition: Condition, lookup: Lookup): boolean {
  const v = lookup(condition.field);
  if (condition.present !== undefined) {
    const present = v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
    return condition.present === present;
  }
  if (Array.isArray(v)) return false;
  if (condition.equals !== undefined) return v === condition.equals;
  if (condition.in) return v !== undefined && typeof v !== "boolean" && condition.in.includes(v);
  return true;
}

function asString(v: ScalarValue | undefined): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}
