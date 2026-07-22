import { Context as TelegrafContext, Telegraf } from "telegraf";
import { Logger } from "../logger.ts";
import { MessageChunker } from "../formatter.ts";
import { sleep } from "../util.ts";
import type { BotCommands } from "./botCommands.ts";

export class TelegramBotService {
  private readonly bot: Telegraf;
  private readonly maxLength = 4_000;
  private started = false;
  private readonly chatId: string;
  private readonly commands: BotCommands;

  constructor(token: string, chatId: string, commands: BotCommands) {
    this.chatId = chatId;
    this.commands = commands;
    this.bot = new Telegraf(token);
  }

  async start(): Promise<void> {
    // ── 디버깅용 임시 로깅 — /가격갱신이 반응 없는 문제 진단용. 원인 확인 후 제거할 것. ──
    // 어떤 핸들러와도 매칭되기 전에 무조건 실행되므로, 여기 로그가 안 찍히면 폴링/토큰 쪽
    // 문제(메시지 자체를 못 받음)이고, 여기는 찍히는데 /가격갱신 핸들러가 응답을 안 하면
    // bot.hears() 정규식 매칭 문제(공백/보이지 않는 문자 등)로 좁혀진다. JSON.stringify로
    // 감싸 텍스트 앞뒤 공백이나 개행처럼 눈에 안 보이는 문자도 로그에서 드러나게 한다.
    this.bot.use(async (ctx, next) => {
      const chatId = ctx.chat?.id ?? "(chat 정보 없음)";
      const text = ctx.message && "text" in ctx.message ? ctx.message.text : undefined;
      Logger.info(`[디버그] 받은 메시지: chatId=${chatId}, text=${JSON.stringify(text ?? "(텍스트 없음, 예: 스티커/사진 등)")}`);
      await next();
    });

    this.bot.command("update", async (ctx: TelegrafContext) => {
      try {
        await ctx.reply("⏳ 실시간 수집 파이프라인을 가동합니다…");
        const report = await this.commands.onUpdate();
        await this.replyChunked(ctx, report);
      } catch (err) {
        Logger.error("Telegram /update 처리 오류", err);
        await this.safeReply(ctx, "⚠ 처리 중 오류가 발생했습니다.");
      }
    });

    this.bot.command("briefing", async (ctx: TelegrafContext) => {
      try {
        await ctx.reply("⏳ 미브리핑 데이터를 정리 중입니다…");
        const briefing = await this.commands.onBriefing();
        await this.replyChunked(ctx, briefing);
      } catch (err) {
        Logger.error("Telegram /briefing 처리 오류", err);
        await this.safeReply(ctx, "⚠ 처리 중 오류가 발생했습니다.");
      }
    });

    this.bot.command("proposals", async (ctx: TelegrafContext) => {
      try {
        const list = await this.commands.onProposals();
        await this.replyChunked(ctx, list);
      } catch (err) {
        Logger.error("Telegram /proposals 처리 오류", err);
        await this.safeReply(ctx, "⚠ 처리 중 오류가 발생했습니다.");
      }
    });

    this.bot.command("proposal", async (ctx) => {
      const id = Number.parseInt((ctx.payload ?? "").trim(), 10);
      if (Number.isNaN(id)) {
        await this.safeReply(ctx, "사용법: `/proposal <id>`");
        return;
      }
      try {
        const detail = await this.commands.onProposalDetail(id);
        await this.replyChunked(ctx, detail);
      } catch (err) {
        Logger.error("Telegram /proposal 처리 오류", err);
        await this.safeReply(ctx, "⚠ 처리 중 오류가 발생했습니다.");
      }
    });

    this.bot.command("approve", async (ctx) => {
      const id = Number.parseInt((ctx.payload ?? "").trim(), 10);
      if (Number.isNaN(id)) {
        await this.safeReply(ctx, "사용법: `/approve <id>`");
        return;
      }
      try {
        const decidedBy = ctx.from?.username ?? String(ctx.from?.id ?? "unknown");
        const result = await this.commands.onApprove(id, decidedBy);
        await this.replyChunked(ctx, result);
      } catch (err) {
        Logger.error("Telegram /approve 처리 오류", err);
        await this.safeReply(ctx, "⚠ 처리 중 오류가 발생했습니다.");
      }
    });

    this.bot.command("reject", async (ctx) => {
      const payload = (ctx.payload ?? "").trim();
      const [idStr, ...reasonParts] = payload.split(/\s+/);
      const id = Number.parseInt(idStr, 10);
      if (Number.isNaN(id)) {
        await this.safeReply(ctx, "사용법: `/reject <id> [사유]`");
        return;
      }
      try {
        const decidedBy = ctx.from?.username ?? String(ctx.from?.id ?? "unknown");
        const reason = reasonParts.length > 0 ? reasonParts.join(" ") : null;
        const result = await this.commands.onReject(id, decidedBy, reason);
        await this.replyChunked(ctx, result);
      } catch (err) {
        Logger.error("Telegram /reject 처리 오류", err);
        await this.safeReply(ctx, "⚠ 처리 중 오류가 발생했습니다.");
      }
    });

    this.bot.command("export_approved", async (ctx: TelegrafContext) => {
      try {
        const result = await this.commands.onExportApproved();
        await this.replyChunked(ctx, result);
      } catch (err) {
        Logger.error("Telegram /export_approved 처리 오류", err);
        await this.safeReply(ctx, "⚠ 처리 중 오류가 발생했습니다.");
      }
    });

    this.bot.command("mark_applied", async (ctx) => {
      const ids = (ctx.payload ?? "")
        .trim()
        .split(/\s+/)
        .map((s) => Number.parseInt(s, 10))
        .filter((n) => !Number.isNaN(n));
      if (ids.length === 0) {
        await this.safeReply(ctx, "사용법: `/mark_applied <id> [id2] [id3] ...`");
        return;
      }
      try {
        const markedBy = ctx.from?.username ?? String(ctx.from?.id ?? "unknown");
        const result = await this.commands.onMarkApplied(ids, markedBy);
        await this.replyChunked(ctx, result);
      } catch (err) {
        Logger.error("Telegram /mark_applied 처리 오류", err);
        await this.safeReply(ctx, "⚠ 처리 중 오류가 발생했습니다.");
      }
    });

    // 한글 명령은 Telegraf의 .command()(BotFather 공식 등록 규칙: 영소문자/숫자/밑줄만 전제)
    // 대신 .hears()로 등록한다 — 임의의 유니코드 텍스트를 안전하게 매칭한다. 그룹 채팅에서
    // Telegram이 자동으로 붙이는 "@봇이름" 접미사도 허용한다.
    this.bot.hears(/^\/가격갱신(@\w+)?$/, async (ctx: TelegrafContext) => {
      try {
        await ctx.reply("⏳ 네이버 쇼핑에서 부품 가격을 갱신하는 중입니다…");
        const result = await this.commands.onPriceUpdate();
        await this.replyChunked(ctx, result);
      } catch (err) {
        Logger.error("Telegram /가격갱신 처리 오류", err);
        await this.safeReply(ctx, "⚠ 처리 중 오류가 발생했습니다.");
      }
    });

    this.bot.command("start", async (ctx: TelegrafContext) => {
      await this.safeReply(
        ctx,
        "🤖 Hardware Intel Bot 가동 중\n/update — 즉시 수집 실행\n/briefing — 브리핑 요약 출력\n" +
          "/proposals — 승인 대기 제안 목록\n/proposal <id> — 제안 상세\n/approve <id> — 승인\n/reject <id> [사유] — 거절\n" +
          "/export_approved — 승인된 제안 내보내기\n/mark_applied <id...> — 반영 완료 처리\n/가격갱신 — 네이버 쇼핑 기반 부품 가격 갱신",
      );
    });

    this.bot.catch((err: unknown) => Logger.error("Telegram 봇 오류", err));

    // launch()는 내부 폴링 루프를 유지하므로 await 하지 않음
    void this.bot.launch().catch((err: unknown) => Logger.error("Telegram launch 실패", err));
    this.started = true;
    Logger.info("Telegram 봇 폴링 시작");
  }

  private async safeReply(ctx: TelegrafContext, text: string): Promise<void> {
    try {
      await ctx.reply(text);
    } catch (err) {
      Logger.error("Telegram 응답 실패", err);
    }
  }

  private async replyChunked(ctx: TelegrafContext, text: string): Promise<void> {
    const chunks = MessageChunker.split(text, this.maxLength);
    for (const chunk of chunks) {
      await this.safeReply(ctx, chunk);
      await sleep(400);
    }
  }

  async sendToChat(text: string): Promise<void> {
    Logger.info(`Telegram 채팅 발송 시도 → chatId=${this.chatId || "(미설정)"}`);
    if (!this.started) {
      const err = new Error("Telegram 봇이 아직 시작되지 않아 채팅 발송을 건너뜁니다.");
      Logger.error(err.message);
      throw err;
    }
    try {
      const chunks = MessageChunker.split(text, this.maxLength);
      for (const chunk of chunks) {
        await this.bot.telegram.sendMessage(this.chatId, chunk, {
          link_preview_options: { is_disabled: true },
        });
        await sleep(400);
      }
    } catch (err) {
      Logger.error("Telegram 채팅 발송 실패", err);
      throw err;
    }
  }

  stop(reason: string): void {
    try {
      this.bot.stop(reason);
      Logger.info("Telegram 봇 정상 종료");
    } catch (err) {
      Logger.error("Telegram 종료 오류", err);
    }
  }
}
