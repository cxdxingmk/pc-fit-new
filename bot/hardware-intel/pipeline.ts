import type { ArticleClassifier } from "./classifier.ts";
import type { HardwareIntelRepository } from "./db.ts";
import type { HttpClient } from "./httpClient.ts";
import { Logger } from "./logger.ts";
import type { RssParser } from "./rssParser.ts";
import type { FeedSource, IngestionResult } from "./types.ts";
import { sleep } from "./util.ts";

export class IngestionPipeline {
  private isRunning = false;
  private readonly http: HttpClient;
  private readonly parser: RssParser;
  private readonly classifier: ArticleClassifier;
  private readonly repo: HardwareIntelRepository;
  private readonly feeds: FeedSource[];

  constructor(
    http: HttpClient,
    parser: RssParser,
    classifier: ArticleClassifier,
    repo: HardwareIntelRepository,
    feeds: FeedSource[],
  ) {
    this.http = http;
    this.parser = parser;
    this.classifier = classifier;
    this.repo = repo;
    this.feeds = feeds;
  }

  get running(): boolean {
    return this.isRunning;
  }

  async runCycle(): Promise<IngestionResult> {
    if (this.isRunning) {
      throw new Error("이미 수집 사이클이 실행 중입니다. 잠시 후 다시 시도해 주세요.");
    }
    this.isRunning = true;
    const startedAt = new Date();
    const result: IngestionResult = {
      fetchedFeeds: 0,
      failedFeeds: 0,
      newArticles: 0,
      duplicates: 0,
      perfDataPoints: 0,
      byCategory: {},
      startedAt,
      finishedAt: startedAt,
    };

    try {
      for (const feed of this.feeds) {
        try {
          Logger.info(`피드 수집 시작: ${feed.name}`);
          const xml = await this.http.getText(feed.url);
          const items = this.parser.parse(xml, feed.name);
          result.fetchedFeeds++;

          for (const item of items) {
            const article = this.classifier.classify(item);
            const inserted = await this.repo.insertArticleIfNew(article);
            if (inserted) {
              result.newArticles++;
              result.byCategory[article.category] = (result.byCategory[article.category] ?? 0) + 1;
              if (article.perfGainPercent !== null) result.perfDataPoints++;
            } else {
              result.duplicates++;
            }
          }
          await sleep(1_200); // 예의 바른 크롤링을 위한 피드 간 딜레이
        } catch (err) {
          result.failedFeeds++;
          Logger.error(`피드 수집 실패: ${feed.name}`, err);
        }
      }
    } finally {
      result.finishedAt = new Date();
      this.isRunning = false;
    }
    Logger.info(
      `수집 완료 — 신규 ${result.newArticles}건, 중복 ${result.duplicates}건, 성능데이터 ${result.perfDataPoints}건`,
    );
    return result;
  }
}
