// 箱の中身どうしの食い違いを調べる。
//
// zod の schema は 1 つずつの形しか見ないので、ここでは参照(部品 → 型、束 → 部品、
// レイヤー → 項目、説明書 → 部品)と、部品の値が型の項目に合っているかを見る。

import { parseEmbeds } from "./embeds.js";
import {
  type BoxDocument,
  boxDocumentSchema,
  type Field,
  type FieldValue,
  type Layer,
  type Part,
  type ScalarField,
  type ScalarValue,
  type Template,
  assetRefSchema,
  colorSchema,
} from "./schema.js";

export interface BoxIssue {
  /** 問題のある場所。例: `parts[challenge].fields.art` */
  path: string;
  message: string;
}

export type BoxValidationResult =
  | { ok: true; box: BoxDocument; issues: [] }
  | { ok: false; issues: BoxIssue[] };

/** 形(zod)と中身どうしの参照を両方見る。 */
export function validateBox(input: unknown): BoxValidationResult {
  const parsed = boxDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  const issues = checkBox(parsed.data);
  return issues.length === 0 ? { ok: true, box: parsed.data, issues: [] } : { ok: false, issues };
}

/** 形は正しい前提で、参照と値を見る。 */
export function checkBox(box: BoxDocument): BoxIssue[] {
  const issues: BoxIssue[] = [];
  const push = (path: string, message: string) => issues.push({ path, message });

  const templates = uniqueBy(box.templates, (t) => t.key, "templates", push);
  const parts = uniqueBy(box.parts, (p) => p.key, "parts", push);
  const sets = uniqueBy(box.sets, (s) => s.key, "sets", push);
  uniqueBy(box.pages, (p) => `${p.slug}@${p.language}`, "pages", push);

  for (const template of box.templates) {
    checkTemplate(template, `templates[${template.key}]`, push);
  }

  for (const part of box.parts) {
    const path = `parts[${part.key}]`;
    const template = templates.get(part.template);
    if (!template) {
      push(`${path}.template`, `型 ${part.template} がない`);
      continue;
    }
    checkPartValues(part, template, box.manifest.languages, path, push);
  }

  for (const set of box.sets) {
    const path = `sets[${set.key}]`;
    const seen = new Set<string>();
    set.entries.forEach((entry, i) => {
      if (!parts.has(entry.part)) push(`${path}.entries[${i}].part`, `部品 ${entry.part} がない`);
      if (seen.has(entry.part)) push(`${path}.entries[${i}].part`, `部品 ${entry.part} が束の中で重複している`);
      seen.add(entry.part);
    });
    for (const key of set.settings?.tintWithOwnerColor ?? []) {
      if (!set.entries.some((e) => e.part === key)) {
        push(`${path}.settings.tintWithOwnerColor`, `部品 ${key} はこの束に入っていない`);
      }
    }
  }

  const defaultSet = box.manifest.play?.defaultSet;
  if (defaultSet && !sets.has(defaultSet)) push("manifest.play.defaultSet", `束 ${defaultSet} がない`);

  for (const page of box.pages) {
    const path = `pages[${page.slug}@${page.language}]`;
    if (!box.manifest.languages.includes(page.language)) {
      push(`${path}.language`, `言語 ${page.language} は manifest.languages にない`);
    }
    for (const embed of parseEmbeds(page.body)) {
      const exists = embed.kind === "set" ? sets.has(embed.key) : parts.has(embed.key);
      if (!exists) push(`${path}.body`, `::${embed.kind}[${embed.key}] の参照先がない`);
      if (embed.kind === "card" && parts.has(embed.key)) {
        const t = templates.get(parts.get(embed.key)!.template);
        if (t && t.kind !== "card") push(`${path}.body`, `::card[${embed.key}] はカードではない(${t.kind})`);
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------

type Push = (path: string, message: string) => void;

function uniqueBy<T>(items: readonly T[], key: (item: T) => string, path: string, push: Push): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const k = key(item);
    if (map.has(k)) push(`${path}[${k}]`, `${k} が重複している`);
    map.set(k, item);
  }
  return map;
}

function checkTemplate(template: Template, path: string, push: Push): void {
  template.faces.forEach((face, i) => {
    const facePath = `${path}.faces[${i}]`;
    let itemFields: Record<string, ScalarField> | null = null;
    if ("repeat" in face) {
      const field = template.fields[face.repeat.field];
      if (!field) push(`${facePath}.repeat.field`, `項目 ${face.repeat.field} がない`);
      else if (field.type !== "list") push(`${facePath}.repeat.field`, `項目 ${face.repeat.field} は list ではない`);
      else itemFields = field.item;
    }
    face.layers.forEach((layer, j) => {
      checkLayerRefs(layer, template.fields, itemFields, `${facePath}.layers[${j}]`, push);
    });
  });
  const names = template.faces.filter((f) => "name" in f).map((f) => (f as { name: string }).name);
  if (new Set(names).size !== names.length) push(`${path}.faces`, "面の名前が重複している");
}

function checkLayerRefs(
  layer: Layer,
  fields: Record<string, Field>,
  itemFields: Record<string, ScalarField> | null,
  path: string,
  push: Push,
): void {
  for (const [prop, value] of Object.entries(layer)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if ("$field" in value) {
        const name = (value as { $field: string }).$field;
        if (!fields[name]) push(`${path}.${prop}`, `項目 ${name} がない`);
      } else if ("$item" in value) {
        const name = (value as { $item: string }).$item;
        if (!itemFields) push(`${path}.${prop}`, "$item は repeat の面の中でだけ使える");
        else if (!itemFields[name]) push(`${path}.${prop}`, `繰り返しの項目 ${name} がない`);
      }
    }
  }
  if (layer.when && !fields[layer.when.field]) push(`${path}.when.field`, `項目 ${layer.when.field} がない`);
}

function checkPartValues(part: Part, template: Template, languages: readonly string[], path: string, push: Push): void {
  for (const name of Object.keys(part.fields)) {
    const field = template.fields[name];
    if (!field) push(`${path}.fields.${name}`, `型 ${template.key} に項目 ${name} がない`);
    else if (field.type === "text" && field.i18n) push(`${path}.fields.${name}`, `${name} は言語ごとの文字なので i18n に入れる`);
  }
  for (const [lang, values] of Object.entries(part.i18n ?? {})) {
    if (!languages.includes(lang)) push(`${path}.i18n.${lang}`, `言語 ${lang} は manifest.languages にない`);
    for (const name of Object.keys(values)) {
      const field = template.fields[name];
      if (!field || field.type !== "text" || !field.i18n) {
        push(`${path}.i18n.${lang}.${name}`, `${name} は言語ごとの文字の項目ではない`);
      }
    }
  }

  for (const [name, field] of Object.entries(template.fields)) {
    if (field.type === "text" && field.i18n) {
      for (const lang of languages) {
        const value = part.i18n?.[lang]?.[name];
        if (value === undefined) {
          if (!field.optional) push(`${path}.i18n.${lang}.${name}`, "必須の文字がない");
        } else if (field.maxLength && [...value].length > field.maxLength) {
          push(`${path}.i18n.${lang}.${name}`, `${field.maxLength} 文字を超えている`);
        }
      }
      continue;
    }
    const value = part.fields[name];
    if (value === undefined) {
      if (!field.optional) push(`${path}.fields.${name}`, "必須の値がない");
      continue;
    }
    checkValue(field, value, `${path}.fields.${name}`, push);
  }
}

function checkValue(field: Field, value: FieldValue, path: string, push: Push): void {
  if (field.type === "list") {
    if (!Array.isArray(value)) return push(path, "list の値は配列");
    if (field.minLength !== undefined && value.length < field.minLength) push(path, `${field.minLength} 件以上`);
    if (field.maxLength !== undefined && value.length > field.maxLength) push(path, `${field.maxLength} 件以下`);
    value.forEach((item, i) => {
      for (const [name, itemField] of Object.entries(field.item)) {
        const v = item[name];
        if (v === undefined) {
          if (!itemField.optional) push(`${path}[${i}].${name}`, "必須の値がない");
        } else checkScalar(itemField, v, `${path}[${i}].${name}`, push);
      }
      for (const name of Object.keys(item)) {
        if (!field.item[name]) push(`${path}[${i}].${name}`, `繰り返しの項目 ${name} がない`);
      }
    });
    return;
  }
  if (Array.isArray(value)) return push(path, "配列は list の項目にだけ入れられる");
  checkScalar(field, value, path, push);
}

function checkScalar(field: ScalarField, value: ScalarValue, path: string, push: Push): void {
  switch (field.type) {
    case "text":
      if (typeof value !== "string") return push(path, "文字を入れる");
      if (field.maxLength && [...value].length > field.maxLength) push(path, `${field.maxLength} 文字を超えている`);
      return;
    case "image":
      if (typeof value !== "string" || !assetRefSchema.safeParse(value).success) push(path, "asset:<id> か http(s) の URL");
      return;
    case "color":
      if (typeof value !== "string" || !colorSchema.safeParse(value).success) push(path, "#RRGGBB の色");
      return;
    case "number":
      if (typeof value !== "number") return push(path, "数を入れる");
      if (field.integer && !Number.isInteger(value)) push(path, "整数を入れる");
      if (field.min !== undefined && value < field.min) push(path, `${field.min} 以上`);
      if (field.max !== undefined && value > field.max) push(path, `${field.max} 以下`);
      return;
    case "enum":
      if (typeof value !== "string" || !field.values.includes(value)) push(path, `${field.values.join(" / ")} のどれか`);
      return;
  }
}
