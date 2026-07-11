import { Client as DiscordClient, GatewayIntentBits, Message as DiscordMessage, Partials, TextChannel } from "discord.js";
import { Logger } from "../logger.ts";
import { MessageChunker } from "../formatter.ts";
import { sleep } from "../util.ts";
import type { BotCommands } from "./botCommands.ts";

export class DiscordBotService {
  private readonly client: DiscordClient;
  private readonly maxLength = 2_000;
  private ready = false;
  private readonly token: string;
  private readonly channelId: string;
  private readonly commands: BotCommands;

  constructor(token: string, channelId: string, commands: BotCommands) {
    this.token = token;
    this.channelId = channelId;
    this.commands = commands;
    this.client = new DiscordClient({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
      partials: [Partials.Channel],
    });
  }

  async start(): Promise<void> {
    this.client.on("ready", () => {
      this.ready = true;
      Logger.info(`Discord 봇 로그인 완료: ${this.client.user?.tag ?? "unknown"}`);
    });

    this.client.on("messageCreate", (message: DiscordMessage) => {
      void this.handleMessage(message);
    });

    this.client.on("error", (err) => Logger.error("Discord 클라이언트 오류", err));

    await this.client.login(this.token);
  }

  private async handleMessage(message: DiscordMessage): Promise<void> {
    try {
      if (message.author.bot) return;
      const raw = message.content.trim();
      const content = raw.toLowerCase();

      if (content === "!update") {
        await message.reply("⏳ 실시간 수집 파이프라인을 가동합니다…");
        const report = await this.commands.onUpdate();
        await this.replyChunked(message, report);
      } else if (content === "!briefing") {
        await message.reply("⏳ 미브리핑 데이터를 정리 중입니다…");
        const briefing = await this.commands.onBriefing();
        await this.replyChunked(message, briefing);
      } else if (content === "!proposals") {
        const list = await this.commands.onProposals();
        await this.replyChunked(message, list);
      } else if (content.startsWith("!proposal ")) {
        const id = Number.parseInt(raw.slice("!proposal ".length).trim(), 10);
        if (Number.isNaN(id)) {
          await message.reply("사용법: `!proposal <id>`");
          return;
        }
        const detail = await this.commands.onProposalDetail(id);
        await this.replyChunked(message, detail);
      } else if (content.startsWith("!approve ")) {
        const id = Number.parseInt(raw.slice("!approve ".length).trim(), 10);
        if (Number.isNaN(id)) {
          await message.reply("사용법: `!approve <id>`");
          return;
        }
        const result = await this.commands.onApprove(id, message.author.username);
        await this.replyChunked(message, result);
      } else if (content.startsWith("!reject ")) {
        const rest = raw.slice("!reject ".length).trim();
        const [idStr, ...reasonParts] = rest.split(/\s+/);
        const id = Number.parseInt(idStr, 10);
        if (Number.isNaN(id)) {
          await message.reply("사용법: `!reject <id> [사유]`");
          return;
        }
        const reason = reasonParts.length > 0 ? reasonParts.join(" ") : null;
        const result = await this.commands.onReject(id, message.author.username, reason);
        await this.replyChunked(message, result);
      } else if (content === "!export-approved") {
        const result = await this.commands.onExportApproved();
        await this.replyChunked(message, result);
      } else if (content.startsWith("!mark-applied ")) {
        const ids = raw
          .slice("!mark-applied ".length)
          .trim()
          .split(/\s+/)
          .map((s) => Number.parseInt(s, 10))
          .filter((n) => !Number.isNaN(n));
        if (ids.length === 0) {
          await message.reply("사용법: `!mark-applied <id> [id2] [id3] ...`");
          return;
        }
        const result = await this.commands.onMarkApplied(ids, message.author.username);
        await this.replyChunked(message, result);
      }
    } catch (err) {
      Logger.error("Discord 명령 처리 오류", err);
      try {
        await message.reply("⚠ 처리 중 오류가 발생했습니다. 로그를 확인해 주세요.");
      } catch {
        // 응답 실패는 무시 (프로세스 보호)
      }
    }
  }

  private async replyChunked(message: DiscordMessage, text: string): Promise<void> {
    const chunks = MessageChunker.split(text, this.maxLength);
    for (const chunk of chunks) {
      await message.reply(chunk);
      await sleep(400);
    }
  }

  async sendToChannel(text: string): Promise<void> {
    Logger.info(`Discord 채널 발송 시도 → channelId=${this.channelId || "(미설정)"}`);
    if (!this.ready) {
      const err = new Error("Discord 봇이 아직 준비되지 않아 채널 발송을 건너뜁니다.");
      Logger.error(err.message);
      throw err;
    }
    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Discord 채널을 찾을 수 없거나 텍스트 채널이 아닙니다: ${this.channelId}`);
      }
      const textChannel = channel as TextChannel;
      const chunks = MessageChunker.split(text, this.maxLength);
      for (const chunk of chunks) {
        await textChannel.send(chunk);
        await sleep(400);
      }
    } catch (err) {
      Logger.error("Discord 채널 발송 실패", err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.client.destroy();
      Logger.info("Discord 봇 정상 종료");
    } catch (err) {
      Logger.error("Discord 종료 오류", err);
    }
  }
}
