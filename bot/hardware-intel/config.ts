import "dotenv/config";
import type { FeedSource } from "./types.ts";

export interface AppConfig {
  discordToken: string;
  discordChannelId: string;
  telegramToken: string;
  telegramChatId: string;
  dbPath: string;
  feeds: FeedSource[];
}

const FEEDS: FeedSource[] = [
  { name: "TechPowerUp", url: "https://www.techpowerup.com/rss/news" },
  { name: "VideoCardz", url: "https://videocardz.com/feed" },
  { name: "Tom's Hardware", url: "https://www.tomshardware.com/feeds/all" },
  { name: "Phoronix", url: "https://www.phoronix.com/rss.php" },
  { name: "Reddit r/hardware", url: "https://www.reddit.com/r/hardware/.rss" },
];

export function loadConfig(): AppConfig {
  return {
    discordToken: (process.env.DISCORD_BOT_TOKEN ?? "").trim(),
    discordChannelId: (process.env.DISCORD_CHANNEL_ID ?? "").trim(),
    telegramToken: (process.env.TELEGRAM_BOT_TOKEN ?? "").trim(),
    telegramChatId: (process.env.TELEGRAM_CHAT_ID ?? "").trim(),
    dbPath: (process.env.HARDWARE_INTEL_DB_PATH ?? "hardware_intel.db").trim(),
    feeds: FEEDS,
  };
}
