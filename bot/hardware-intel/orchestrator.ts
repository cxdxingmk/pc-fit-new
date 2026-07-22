import { schedule, type ScheduledTask } from "node-cron";
import { ArticleClassifier } from "./classifier.ts";
import type { AppConfig } from "./config.ts";
import { HardwareIntelRepository } from "./db.ts";
import { BriefingFormatter } from "./formatter.ts";
import { HttpClient } from "./httpClient.ts";
import { Logger } from "./logger.ts";
import { DiscordBotService } from "./notifiers/discordBot.ts";
import { TelegramBotService } from "./notifiers/telegramBot.ts";
import type { BotCommands } from "./notifiers/botCommands.ts";
import { IngestionPipeline } from "./pipeline.ts";
import { exportApprovedProposals } from "./proposals/exportApproved.ts";
import { normalizePartName } from "./proposals/matcher.ts";
import { ProposalGenerator } from "./proposals/proposalGenerator.ts";
import { RssParser } from "./rssParser.ts";
import type { HardwareCategory, PartStatus, WeeklySyncResult } from "./types.ts";

const KST_TIMEZONE = "Asia/Seoul";

export class Orchestrator {
  private readonly repo: HardwareIntelRepository;
  private readonly http = new HttpClient();
  private readonly rssParser = new RssParser();
  private readonly classifier = new ArticleClassifier();
  private readonly formatter = new BriefingFormatter();
  private readonly pipeline: IngestionPipeline;
  private readonly proposalGenerator: ProposalGenerator;

  private readonly discord: DiscordBotService | null;
  private readonly telegram: TelegramBotService | null;
  private cronTasks: ScheduledTask[] = [];
  private shuttingDown = false;

  constructor(config: AppConfig) {
    this.repo = new HardwareIntelRepository(config.dbPath);
    this.pipeline = new IngestionPipeline(this.http, this.rssParser, this.classifier, this.repo, config.feeds);
    this.proposalGenerator = new ProposalGenerator(this.repo);

    const onUpdate = async (): Promise<string> => {
      const result = await this.pipeline.runCycle();
      return this.formatter.formatIngestionResult(result);
    };
    const onBriefing = async (): Promise<string> => {
      const articles = await this.repo.getUnbriefedArticles();
      const briefing = this.formatter.formatBriefing(articles, "온디맨드 브리핑 (미브리핑 데이터 분)");
      await this.repo.markArticlesBriefed(articles.map((a) => a.id));
      return briefing;
    };

    const onProposals = async (): Promise<string> => {
      const pending = await this.repo.getPendingProposals();
      return this.formatter.formatPendingProposalsList(pending);
    };

    const onProposalDetail = async (id: number): Promise<string> => {
      const proposal = await this.repo.getProposalById(id);
      if (!proposal) return `#${id} 제안을 찾을 수 없습니다.`;
      return this.formatter.formatProposalDetail(proposal);
    };

    const onApprove = async (id: number, decidedBy: string): Promise<string> => {
      const proposal = await this.repo.getProposalById(id);
      if (!proposal) return `#${id} 제안을 찾을 수 없습니다.`;
      if (proposal.status !== "pending") return `#${id}는 이미 처리됨(status=${proposal.status}).`;

      await this.repo.decideProposal(id, "approved", decidedBy);
      // 사람이 확정한 매칭(기존 카탈로그 대상이 있는 경우만)을 part_aliases에 누적 — 다음에 같은
      // 표기가 나오면 matcher가 재추론 없이 즉시 재사용(자기개선).
      if (proposal.target_catalog_id) {
        await this.repo.upsertAlias(normalizePartName(proposal.detected_name), proposal.category, proposal.target_catalog_id);
      }
      const decided = await this.repo.getProposalById(id);
      const note =
        decided!.kind === "SPEC_UPDATE"
          ? "`!export-approved`로 내보낸 뒤 로컬 저장소에서 반영해주세요(봇은 웹앱 소스에 접근할 수 없어 자동 반영하지 않습니다)."
          : "NEW_PART/STATUS_CHANGE는 자동 반영 대상이 아닙니다 — 카탈로그에는 수동으로 추가해주세요.";
      return `${this.formatter.formatDecisionResult("approved", decided!)}\n${note}`;
    };

    const onReject = async (id: number, decidedBy: string, reason: string | null): Promise<string> => {
      const proposal = await this.repo.getProposalById(id);
      if (!proposal) return `#${id} 제안을 찾을 수 없습니다.`;
      if (proposal.status !== "pending") return `#${id}는 이미 처리됨(status=${proposal.status}).`;

      await this.repo.decideProposal(id, "rejected", decidedBy, reason ?? undefined);
      const updated = await this.repo.getProposalById(id);
      return this.formatter.formatDecisionResult("rejected", updated!);
    };

    const onExportApproved = async (): Promise<string> => {
      const items = await exportApprovedProposals(this.repo);
      return this.formatter.formatExportedProposals(items);
    };

    const onMarkApplied = async (ids: number[], markedBy: string): Promise<string> => {
      const results: Array<{ id: number; ok: boolean; message: string }> = [];
      for (const id of ids) {
        const proposal = await this.repo.getProposalById(id);
        if (!proposal) {
          results.push({ id, ok: false, message: "제안을 찾을 수 없음" });
          continue;
        }
        if (proposal.status !== "approved") {
          results.push({ id, ok: false, message: `status=${proposal.status}라 반영완료 처리 불가(approved 상태만 가능)` });
          continue;
        }
        await this.repo.markProposalApplied(id);
        results.push({ id, ok: true, message: `반영완료 처리됨(by ${markedBy})` });
      }
      return this.formatter.formatMarkAppliedResult(results);
    };

    const onPriceUpdate = async (): Promise<string> => {
      if (!config.priceUpdateApiUrl || !config.priceUpdateApiSecret) {
        return "PRICE_UPDATE_API_URL / PRICE_UPDATE_API_SECRET이 설정되지 않아 가격 갱신을 실행할 수 없습니다.";
      }

      let summary: string;
      try {
        const response = await fetch(new URL("/api/admin/update-prices", config.priceUpdateApiUrl), {
          method: "POST",
          headers: { "x-price-update-secret": config.priceUpdateApiSecret },
        });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          summary = `가격 갱신 요청 실패(HTTP ${response.status}): ${body || "응답 본문 없음"}`;
        } else {
          const result = (await response.json()) as { updated: number; skipped: number };
          summary = `갱신 완료: ${result.updated}개 항목 업데이트, ${result.skipped}개 항목 스킵`;
        }
      } catch (err) {
        Logger.error("가격 갱신 API 호출 실패", err);
        summary = `가격 갱신 요청 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`;
      }

      // 어느 채널에서 명령을 트리거했든 상관없이 Discord/Telegram 양쪽에 동일하게 알린다
      // (broadcast()는 이미 runDailyBriefing/runWeeklySync가 쓰는 "두 채널 다 보내기" 메서드).
      // 여기서는 실패해도 throw하지 않는다 — 가격 갱신 자체는 이미 끝났으므로, 브로드캐스트
      // 일부 실패로 트리거한 채널에 엉뚱한 "처리 중 오류" 메시지가 뜨면 안 된다.
      const broadcastFailures = await this.broadcast(summary);
      if (broadcastFailures.length > 0) {
        Logger.error(`가격 갱신 요약 브로드캐스트 일부 실패: ${broadcastFailures.join(", ")}`);
      }
      return summary;
    };

    const commands: BotCommands = {
      onUpdate,
      onBriefing,
      onProposals,
      onProposalDetail,
      onApprove,
      onReject,
      onExportApproved,
      onMarkApplied,
      onPriceUpdate,
    };

    this.discord = config.discordToken ? new DiscordBotService(config.discordToken, config.discordChannelId, commands) : null;
    this.telegram = config.telegramToken ? new TelegramBotService(config.telegramToken, config.telegramChatId, commands) : null;
  }

  async boot(): Promise<void> {
    Logger.info("━━━ Hardware Intel Bot 기동 시작 ━━━");
    await this.repo.init();

    if (this.discord) {
      try {
        await this.discord.start();
      } catch (err) {
        Logger.error("Discord 봇 시작 실패 — 토큰/인텐트 설정을 확인하세요", err);
      }
    } else {
      Logger.warn("DISCORD_BOT_TOKEN 미설정 — Discord 비활성화");
    }

    if (this.telegram) {
      try {
        await this.telegram.start();
      } catch (err) {
        Logger.error("Telegram 봇 시작 실패 — 토큰을 확인하세요", err);
      }
    } else {
      Logger.warn("TELEGRAM_BOT_TOKEN 미설정 — Telegram 비활성화");
    }

    this.registerSchedules();
    this.registerProcessGuards();

    try {
      await this.pipeline.runCycle();
    } catch (err) {
      Logger.error("기동 직후 워밍업 수집 실패", err);
    }

    Logger.info("━━━ 모든 서비스 기동 완료 — 무한 루프 대기 중 ━━━");
  }

  private registerSchedules(): void {
    this.cronTasks.push(
      schedule(
        "*/30 * * * *",
        () => {
          void this.guarded("정기 수집", async () => {
            if (!this.pipeline.running) await this.pipeline.runCycle();
          });
        },
        { timezone: KST_TIMEZONE },
      ),
    );

    this.cronTasks.push(
      schedule(
        "0 9 * * *",
        () => {
          void this.guarded("일일 브리핑", () => this.runDailyBriefing());
        },
        { timezone: KST_TIMEZONE },
      ),
    );

    this.cronTasks.push(
      schedule(
        "5 9 * * 1",
        () => {
          void this.guarded("주간 마스터 동기화", () => this.runWeeklySync());
        },
        { timezone: KST_TIMEZONE },
      ),
    );

    Logger.info("node-cron 스케줄 등록 완료 (KST 기준: 수집 매 30분 / 브리핑 09:00 / 주간 월 09:05)");
  }

  private async guarded(taskName: string, fn: () => Promise<void>): Promise<void> {
    try {
      Logger.info(`[스케줄] ${taskName} 시작`);
      await fn();
      Logger.info(`[스케줄] ${taskName} 완료`);
    } catch (err) {
      Logger.error(`[스케줄] ${taskName} 실패 — 프로세스는 계속 유지됩니다`, err);
    }
  }

  private async runDailyBriefing(): Promise<void> {
    try {
      if (!this.pipeline.running) await this.pipeline.runCycle();
    } catch (err) {
      Logger.error("브리핑 전 수집 실패 — 기존 데이터로 브리핑 진행", err);
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const articles = await this.repo.getArticlesSince(since);
    const briefing = this.formatter.formatBriefing(articles, "일일 하드웨어 인텔 브리핑 (지난 24시간)");

    const pendingProposals = await this.repo.getPendingProposals();
    const proposalsSection = this.formatter.formatPendingProposalsList(pendingProposals);

    const failures = await this.broadcast(`${briefing}\n\n${proposalsSection}`);
    await this.repo.markArticlesBriefed(articles.map((a) => a.id));
    if (failures.length > 0) {
      throw new Error(`일일 브리핑 발송 실패: ${failures.join(", ")}`);
    }
  }

  /** 두 플랫폼에 독립적으로 발송 시도 — 한쪽 실패가 다른 쪽 발송을 막지 않는다.
   *  실패한 플랫폼 이름 목록을 반환하므로 호출부에서 guarded()가 실패를 큰 소리로 보고할 수 있다. */
  private async broadcast(text: string): Promise<string[]> {
    const failures: string[] = [];
    if (this.discord) {
      try {
        await this.discord.sendToChannel(text);
      } catch (err) {
        Logger.error("Discord 발송 실패", err);
        failures.push("discord");
      }
    }
    if (this.telegram) {
      try {
        await this.telegram.sendToChat(text);
      } catch (err) {
        Logger.error("Telegram 발송 실패", err);
        failures.push("telegram");
      }
    }
    return failures;
  }

  private async runWeeklySync(): Promise<void> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const candidates = await this.repo.getWeeklyPartCandidates(since);

    const sync: WeeklySyncResult = {
      upgradedParts: [],
      newParts: [],
      perfUpdatedParts: [],
      vacuumOk: false,
      analyzeOk: false,
    };

    for (const article of candidates) {
      const partName = article.detected_part_name;
      if (!partName) continue;
      const status: PartStatus = article.detected_status === "RELEASED" ? "RELEASED" : "ANNOUNCED";
      const perfDelta = article.perf_gain_percent ?? 0;
      const category = (article.category as HardwareCategory) ?? "GENERAL";

      const outcome = await this.repo.upsertPart(partName, category, status, perfDelta);
      if (outcome.inserted && !sync.newParts.includes(partName)) sync.newParts.push(partName);
      if (outcome.upgraded && !sync.upgradedParts.includes(partName)) sync.upgradedParts.push(partName);
      if (outcome.perfUpdated && !sync.perfUpdatedParts.includes(partName)) sync.perfUpdatedParts.push(partName);
    }

    const optimizeResult = await this.repo.optimize();
    sync.vacuumOk = optimizeResult.vacuumOk;
    sync.analyzeOk = optimizeResult.analyzeOk;

    try {
      const proposalResult = await this.proposalGenerator.generate(candidates, sync);
      Logger.info(
        `[제안 생성] 그룹 ${proposalResult.scannedGroups}건 스캔 → 생성 ${proposalResult.created}건 ` +
          `(SPEC_UPDATE ${proposalResult.byKind.SPEC_UPDATE} / NEW_PART ${proposalResult.byKind.NEW_PART} / STATUS_CHANGE ${proposalResult.byKind.STATUS_CHANGE}), ` +
          `이미대기중 ${proposalResult.skippedAlreadyPending}건 스킵, 신규신호없음 ${proposalResult.skippedNoNewSignal}건 스킵`,
      );
    } catch (err) {
      Logger.error("카탈로그 제안 생성 실패 — 주간 동기화 자체는 계속 진행", err);
    }

    const report = this.formatter.formatWeeklyReport(sync);
    const failures = await this.broadcast(report);
    if (failures.length > 0) {
      throw new Error(`주간 마스터 동기화 발송 실패: ${failures.join(", ")}`);
    }
  }

  private registerProcessGuards(): void {
    process.on("uncaughtException", (err: Error) => {
      Logger.error("uncaughtException 포착 — 프로세스 유지", err);
    });
    process.on("unhandledRejection", (reason: unknown) => {
      Logger.error("unhandledRejection 포착 — 프로세스 유지", reason);
    });
    process.on("SIGINT", () => void this.shutdown("SIGINT"));
    process.on("SIGTERM", () => void this.shutdown("SIGTERM"));
  }

  private async shutdown(signal: string): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    Logger.info(`${signal} 수신 — Graceful Shutdown 시작`);

    for (const task of this.cronTasks) {
      try {
        await task.stop();
      } catch (err) {
        Logger.error("cron 태스크 종료 오류", err);
      }
    }
    if (this.telegram) {
      try {
        this.telegram.stop(signal);
      } catch (err) {
        Logger.error("Telegram 종료 중 오류", err);
      }
    }
    if (this.discord) {
      try {
        await this.discord.stop();
      } catch (err) {
        Logger.error("Discord 종료 중 오류", err);
      }
    }
    try {
      await this.repo.close();
    } catch (err) {
      Logger.error("DB 종료 중 오류", err);
    }

    Logger.info("모든 리소스 정리 완료 — 프로세스 종료");
    process.exit(0);
  }
}
