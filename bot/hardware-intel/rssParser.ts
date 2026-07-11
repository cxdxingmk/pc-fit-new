import { parse as parseHtml, HTMLElement as ParsedElement } from "node-html-parser";
import { Logger } from "./logger.ts";
import type { RawFeedItem } from "./types.ts";
import { nowIso } from "./util.ts";

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(parseInt(code, 10)));
}

function stripTags(html: string): string {
  try {
    const root = parseHtml(html);
    return decodeHtmlEntities(root.textContent).replace(/\s+/g, " ").trim();
  } catch {
    return decodeHtmlEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  }
}

export class RssParser {
  parse(xml: string, sourceName: string): RawFeedItem[] {
    const items: RawFeedItem[] = [];
    try {
      const root = parseHtml(xml, { lowerCaseTagName: true });
      const nodes: ParsedElement[] = [...root.querySelectorAll("item"), ...root.querySelectorAll("entry")];
      for (const node of nodes) {
        const title = stripTags(this.textOf(node, "title"));
        let link = this.textOf(node, "link").trim();
        if (!link) {
          const linkEl = node.querySelector("link");
          link = linkEl?.getAttribute("href")?.trim() ?? "";
        }
        const description = stripTags(
          this.textOf(node, "description") || this.textOf(node, "summary") || this.textOf(node, "content"),
        );
        const pubDate =
          this.textOf(node, "pubdate") ||
          this.textOf(node, "published") ||
          this.textOf(node, "updated") ||
          this.textOf(node, "dc:date") ||
          nowIso();
        if (title && link.startsWith("http")) {
          items.push({ title, link, description, pubDate: pubDate.trim(), sourceName });
        }
      }
    } catch (err) {
      Logger.error(`RSS 파싱 오류 (${sourceName})`, err);
    }
    return items;
  }

  private textOf(node: ParsedElement, tag: string): string {
    const child = node.querySelector(tag);
    if (!child) return "";
    return decodeHtmlEntities(child.textContent ?? "").trim();
  }
}
