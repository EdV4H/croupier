// 説明書(Markdown)の中の埋め込み記法。
//
//   ::part[key]  部品(どの種類でも)
//   ::card[key]  カード(部品のうち kind が card のもの)
//   ::set[key]   束(中身の一覧)

export type EmbedKind = "part" | "card" | "set";

export interface Embed {
  kind: EmbedKind;
  key: string;
  /** body の中の位置(文字の添字)。 */
  index: number;
  /** 記法そのもの(置き換え用)。 */
  raw: string;
}

const EMBED = /::(part|card|set)\[([a-z0-9][a-z0-9-]{0,63})\]/g;

export function parseEmbeds(body: string): Embed[] {
  return [...body.matchAll(EMBED)].map((m) => ({
    kind: m[1] as EmbedKind,
    key: m[2] as string,
    index: m.index ?? 0,
    raw: m[0],
  }));
}

/** 埋め込みを描く側の文字列に置き換える(HTML やプレーンテキストなど)。 */
export function replaceEmbeds(body: string, render: (embed: Embed) => string): string {
  return body.replace(EMBED, (raw, kind: EmbedKind, key: string, index: number) =>
    render({ kind, key, index, raw }),
  );
}
