// 束を、ゲームが使う形に開く。

import type { BoxDocument, Part, PartSet, Template } from "./schema.js";

/** 束の中身を枚数ぶん並べた部品の key(山札を作るときなど)。並びは束の定義どおり。 */
export function expandSet(set: PartSet): string[] {
  return set.entries.flatMap((e) => Array.from({ length: e.quantity }, () => e.part));
}

/** 束の部品の数(全部の枚数の合計)。 */
export function countSet(set: PartSet): number {
  return set.entries.reduce((n, e) => n + e.quantity, 0);
}

/** 箱から引くための索引。 */
export interface BoxIndex {
  box: BoxDocument;
  part(key: string): Part;
  template(key: string): Template;
  templateOf(partKey: string): Template;
  set(key: string): PartSet;
}

export function indexBox(box: BoxDocument): BoxIndex {
  const parts = new Map(box.parts.map((p) => [p.key, p]));
  const templates = new Map(box.templates.map((t) => [t.key, t]));
  const sets = new Map(box.sets.map((s) => [s.key, s]));
  const need = <T>(map: Map<string, T>, key: string, what: string): T => {
    const v = map.get(key);
    if (!v) throw new Error(`${what} ${key} が箱 ${box.key} にない`);
    return v;
  };
  return {
    box,
    part: (key) => need(parts, key, "部品"),
    template: (key) => need(templates, key, "型"),
    templateOf: (partKey) => need(templates, need(parts, partKey, "部品").template, "型"),
    set: (key) => need(sets, key, "束"),
  };
}
