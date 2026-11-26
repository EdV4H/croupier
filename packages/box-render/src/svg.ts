// 解決済みの面(croupier-box の resolveFaces の結果)→ SVG の文字列。
//
// 文字の幅はフォントを読まずに見積もる(全角 = 1em、半角 ≒ 0.55em)。
// 折り返しと「詰める(shrink)」はこの見積もりで決めるので、本物の書体とは少しずれる。
// ずれが困る場面(印刷・共有画像)は PNG に書き出すときに実フォントで描き直す。

import type {
  Part,
  ResolveOptions,
  ResolvedFace,
  ResolvedImage,
  ResolvedLayer,
  ResolvedShape,
  ResolvedText,
  Template,
} from "@edv4h/croupier-box";
import { resolveFace } from "@edv4h/croupier-box";

export interface SvgRenderOptions {
  /** `asset:<id>` を実際の URL(または data: URI)にする。省略時はそのまま出す。 */
  resolveAsset?: (src: string) => string;
  /** 書体の役割名(heading / body など)→ font-family。 */
  fonts?: Record<string, string>;
  /** 役割名が無い・見つからないときの font-family。 */
  defaultFont?: string;
  /** clipPath の id の頭。1 つのページに何枚も並べるときにぶつからないよう変える。 */
  idPrefix?: string;
  /** 出力の幅(px)。省略時は型の大きさ。高さは縦横比を保つ。 */
  width?: number;
}

const DEFAULT_FONT = "'Noto Sans JP', 'Hiragino Sans', system-ui, sans-serif";
const LINE_HEIGHT = 1.3;
const MIN_SHRINK = 0.5;

let counter = 0;

/** 1 面を SVG にする。 */
export function renderFaceSvg(face: ResolvedFace, options: SvgRenderOptions = {}): string {
  const id = `${options.idPrefix ?? "cb"}-${(counter++).toString(36)}`;
  const { width: w, height: h } = face;
  const outW = options.width ?? w;
  const outH = Math.round((outW * h) / w * 100) / 100;
  const label = face.layers.find((l): l is ResolvedImage => l.kind === "image" && !!l.alt)?.alt
    ?? face.layers.find((l): l is ResolvedText => l.kind === "text")?.text;

  const body = face.layers.map((layer, i) => renderLayer(layer, face, options, `${id}-${i}`)).join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    ` width="${num(outW)}" height="${num(outH)}" viewBox="0 0 ${num(w)} ${num(h)}"`,
    label ? ` role="img" aria-label="${attr(label)}">` : ">",
    label ? `<title>${text(label)}</title>` : "",
    `<defs><clipPath id="${id}">${outlinePath(face)}</clipPath></defs>`,
    `<g clip-path="url(#${id})">${body}</g>`,
    `</svg>`,
  ].join("");
}

/** 型と部品から 1 面を解決して SVG にする。面が無ければ undefined。 */
export function renderPartSvg(
  template: Template,
  part: Part,
  faceName: string,
  resolveOptions: ResolveOptions,
  options: SvgRenderOptions = {},
): string | undefined {
  const face = resolveFace(template, part, faceName, resolveOptions);
  return face ? renderFaceSvg(face, options) : undefined;
}

// ---------------------------------------------------------------------------

function outlinePath(face: ResolvedFace): string {
  const { width: w, height: h, outline } = face;
  switch (outline.shape) {
    case "circle":
      return `<ellipse cx="${num(w / 2)}" cy="${num(h / 2)}" rx="${num(w / 2)}" ry="${num(h / 2)}"/>`;
    case "hexagon": {
      // 左右が尖った六角形(幅いっぱい・高さいっぱい)
      const q = w / 4;
      const pts = [
        [0, h / 2],
        [q, 0],
        [w - q, 0],
        [w, h / 2],
        [w - q, h],
        [q, h],
      ];
      return `<polygon points="${pts.map(([x, y]) => `${num(x!)},${num(y!)}`).join(" ")}"/>`;
    }
    default:
      return `<rect width="${num(w)}" height="${num(h)}" rx="${num(outline.radius ?? 0)}"/>`;
  }
}

function renderLayer(layer: ResolvedLayer, face: ResolvedFace, options: SvgRenderOptions, id: string): string {
  const op = layer.opacity !== undefined && layer.opacity < 1 ? ` opacity="${num(layer.opacity)}"` : "";
  switch (layer.kind) {
    case "fill":
      return `<rect width="${num(face.width)}" height="${num(face.height)}" fill="${attr(layer.color)}"${op}/>`;
    case "image":
      return renderImage(layer, options, op);
    case "shape":
      return renderShape(layer, op);
    case "text":
      return renderText(layer, options, op, id);
  }
}

function renderImage(layer: ResolvedImage, options: SvgRenderOptions, op: string): string {
  const [x, y, w, h] = layer.box;
  const href = attr(options.resolveAsset ? options.resolveAsset(layer.src) : layer.src);
  const aspect = layer.fit === "contain" ? "xMidYMid meet" : "xMidYMid slice";
  // 入れ子の <svg> は自分の箱の外を描かないので、cover のはみ出しがここで切れる
  return (
    `<svg x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}"${op}>` +
    `<image width="100%" height="100%" preserveAspectRatio="${aspect}" href="${href}" xlink:href="${href}"/>` +
    `</svg>`
  );
}

function renderShape(layer: ResolvedShape, op: string): string {
  const [x, y, w, h] = layer.box;
  const paint =
    ` fill="${attr(layer.fill ?? "none")}"` +
    (layer.stroke ? ` stroke="${attr(layer.stroke)}" stroke-width="${num(layer.strokeWidth ?? 1)}"` : "") +
    op;
  if (layer.shape === "ellipse") {
    return `<ellipse cx="${num(x + w / 2)}" cy="${num(y + h / 2)}" rx="${num(w / 2)}" ry="${num(h / 2)}"${paint}/>`;
  }
  return `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(layer.radius ?? 0)}"${paint}/>`;
}

function renderText(layer: ResolvedText, options: SvgRenderOptions, op: string, _id: string): string {
  const [x, y, w] = layer.box;
  const { lines, size } = layoutText(layer);
  const anchor = layer.align === "center" ? "middle" : layer.align === "end" ? "end" : "start";
  const tx = layer.align === "center" ? x + w / 2 : layer.align === "end" ? x + w : x;
  const family = (layer.font && options.fonts?.[layer.font]) || options.defaultFont || DEFAULT_FONT;
  const weight = layer.weight === undefined ? "" : ` font-weight="${layer.weight}"`;
  const tspans = lines
    .map((line, i) => `<tspan x="${num(tx)}" y="${num(y + size * 0.88 + i * size * LINE_HEIGHT)}">${text(line)}</tspan>`)
    .join("");
  return (
    `<text font-family="${attr(family)}" font-size="${num(size)}"${weight} fill="${attr(layer.color)}"` +
    ` text-anchor="${anchor}"${op}>${tspans}</text>`
  );
}

// ---------------------------------------------------------------------------
// 文字の見積もり

/** 1 文字の幅(em)。全角は 1、半角英数は 0.55、空白は 0.3。 */
export function charWidthEm(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (ch === " ") return 0.3;
  if (code < 0x80) return 0.55;
  if (code >= 0xff61 && code <= 0xff9f) return 0.5; // 半角カナ
  return 1;
}

export function estimateTextWidth(value: string, size: number): number {
  let em = 0;
  for (const ch of value) em += charWidthEm(ch);
  return em * size;
}

/** 箱の幅で折り返し、shrink なら高さに収まるまで文字を小さくする。 */
export function layoutText(layer: Pick<ResolvedText, "text" | "box" | "size" | "shrink">): {
  lines: string[];
  size: number;
} {
  const [, , w, h] = layer.box;
  let size = layer.size;
  let lines = wrap(layer.text, w, size);
  if (layer.shrink) {
    const minSize = layer.size * MIN_SHRINK;
    while (size > minSize && !fits(lines, w, h, size)) {
      size = Math.max(minSize, size * 0.92);
      lines = wrap(layer.text, w, size);
    }
  }
  return { lines, size: Math.round(size * 100) / 100 };
}

function fits(lines: string[], w: number, h: number, size: number): boolean {
  const height = size + (lines.length - 1) * size * LINE_HEIGHT;
  return height <= h + 0.01 && lines.every((l) => estimateTextWidth(l, size) <= w + 0.01);
}

function wrap(value: string, width: number, size: number): string[] {
  const out: string[] = [];
  for (const paragraph of value.split("\n")) {
    let line = "";
    let lineWidth = 0;
    // 英単語は途中で切らない。日本語は 1 文字ずつ切れる
    for (const token of paragraph.match(/[A-Za-z0-9'’.,!?:;()-]+|\s+|./gu) ?? []) {
      const tw = estimateTextWidth(token, size);
      if (lineWidth + tw > width && line.trim() !== "") {
        out.push(line.trimEnd());
        line = token.trimStart();
        lineWidth = estimateTextWidth(line, size);
      } else {
        line += token;
        lineWidth += tw;
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

// ---------------------------------------------------------------------------

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function text(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function attr(s: string): string {
  return text(s).replace(/"/g, "&quot;");
}
