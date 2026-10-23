// HTML から本文の行だけを取り出す（メニューや装飾は落とす）
import * as cheerio from "cheerio";

export function pageLines(html: string): string[] {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, header, footer, form, iframe, svg, aside").remove();
  $("br").replaceWith("\n");
  $("p, li, div, h1, h2, h3, h4, h5, h6, tr, dd, dt, section, article, td, th").append("\n");
  const main = $("main").length ? $("main") : $("article").length ? $("article") : $("body");
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of main.text().split("\n")) {
    const line = raw.replace(/[\s　]+/g, " ").trim();
    if (line.length < 2 || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines;
}

// 本文中のリンクを「リンク文字列 → URL」で返す（同じサイト内だけ）
export function pageLinks(html: string, pageUrl: string): Map<string, string> {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, header, footer, aside").remove();
  const base = new URL(pageUrl);
  const host = (h: string) => h.replace(/^www\./, "");
  const links = new Map<string, string>();
  $("a[href]").each((_, el) => {
    const text = $(el).text().replace(/[\s　]+/g, " ").trim();
    if (text.length < 4) return;
    try {
      const u = new URL($(el).attr("href") ?? "", base);
      if (!/^https?:$/.test(u.protocol) || host(u.host) !== host(base.host) || /\.(pdf|jpe?g|png|zip|docx?|xlsx?)$/i.test(u.pathname)) return;
      u.hash = "";
      if (u.href !== base.href && !links.has(text)) links.set(text, u.href);
    } catch {
      /* 壊れたリンクは無視 */
    }
  });
  return links;
}

// 詳細ページの見出し（og:title → h1 → title）。サイト名の部分は落とす
export function pageHeading(html: string): string {
  const $ = cheerio.load(html);
  const raw = $('meta[property="og:title"]').attr("content") || $("main h1, article h1, h1").first().text() || $("title").text() || "";
  return raw.replace(/[\s　]+/g, " ").split(/\s*[|｜]\s*|\s+[-–—]\s+/)[0]?.trim() ?? "";
}

type LdNode = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

// ページに埋め込まれた schema.org の Event を、「【予定】」行にする（最も正確な情報源）
export function ldEventLines(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const nodes: LdNode[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as LdNode;
      nodes.push(o);
      if (o["@graph"]) walk(o["@graph"]);
    }
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try { walk(JSON.parse($(el).text())); } catch { /* 壊れたJSONは無視 */ }
  });
  return nodes
    .filter((n) => /Event$/.test(str(n["@type"]) || (Array.isArray(n["@type"]) ? (n["@type"] as unknown[]).map(str).join(" ") : "")))
    .map((n) => {
      const offers = (Array.isArray(n.offers) ? n.offers[0] : n.offers) as LdNode | undefined;
      const price = offers ? str(offers.price) : "";
      const fee = price === "0" ? "無料" : price ? `${price}円` : "";
      return `【予定】${str(n.name)}｜開始 ${str(n.startDate)}｜終了 ${str(n.endDate)}｜料金 ${fee}｜${str(n.url) || pageUrl}`;
    })
    .filter((l) => !l.startsWith("【予定】｜"));
}
