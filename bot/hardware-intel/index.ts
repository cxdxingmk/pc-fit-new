import "dotenv/config";
import { loadConfig } from "./config.ts";
import { Logger } from "./logger.ts";
import { Orchestrator } from "./orchestrator.ts";

void (async (): Promise<void> => {
  const config = loadConfig();
  if (!config.discordToken && !config.telegramToken) {
    Logger.error("DISCORD_BOT_TOKEN, TELEGRAM_BOT_TOKEN 이 모두 비어 있습니다. .env 를 확인하세요.");
    process.exit(1);
  }

  const orchestrator = new Orchestrator(config);
  try {
    await orchestrator.boot();
  } catch (err) {
    Logger.error("치명적 기동 실패", err);
    process.exit(1);
  }
})();
