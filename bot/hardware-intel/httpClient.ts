import { Logger } from "./logger.ts";
import { sleep } from "./util.ts";

export class HttpClient {
  private readonly maxRetries = 2;
  private readonly timeoutMs = 15_000;

  async getText(url: string): Promise<string> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; HardwareIntelBot/1.0; personal RSS reader)",
            Accept: "application/rss+xml, application/xml, text/xml, text/html, */*",
          },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        return await res.text();
      } catch (err) {
        lastError = err;
        const backoff = 1_000 * (attempt + 1);
        Logger.warn(`HTTP 실패 (${attempt + 1}/${this.maxRetries + 1}) ${url} — ${backoff}ms 후 재시도`);
        await sleep(backoff);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`HTTP GET 실패: ${url}`);
  }
}
