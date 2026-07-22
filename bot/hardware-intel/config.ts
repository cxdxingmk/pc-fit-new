import "dotenv/config";
import type { FeedSource } from "./types.ts";

export interface AppConfig {
  discordToken: string;
  discordChannelId: string;
  telegramToken: string;
  telegramChatId: string;
  dbPath: string;
  feeds: FeedSource[];
  /** /가격갱신 명령이 호출할 웹앱(Vercel)의 배포 주소 — 미설정이면 해당 명령은 안내 메시지만 반환하고 아무것도 호출하지 않는다. */
  priceUpdateApiUrl: string;
  /** 웹앱의 PRICE_UPDATE_API_SECRET과 동일한 값이어야 한다. */
  priceUpdateApiSecret: string;
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
    priceUpdateApiUrl: (process.env.PRICE_UPDATE_API_URL ?? "").trim(),
    priceUpdateApiSecret: (process.env.PRICE_UPDATE_API_SECRET ?? "").trim(),
  };
}
