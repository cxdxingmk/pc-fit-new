export class Logger {
  private static ts(): string {
    return new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
  }

  static info(msg: string): void {
    console.log(`[INFO ] [${Logger.ts()} KST] ${msg}`);
  }

  static warn(msg: string): void {
    console.warn(`[WARN ] [${Logger.ts()} KST] ${msg}`);
  }

  static error(msg: string, err?: unknown): void {
    const detail = err instanceof Error ? ` :: ${err.message}` : err !== undefined ? ` :: ${String(err)}` : "";
    console.error(`[ERROR] [${Logger.ts()} KST] ${msg}${detail}`);
  }
}
