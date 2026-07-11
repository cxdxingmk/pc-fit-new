import type { ProposalExportItem } from "./proposals/exportApproved.ts";
import type { ArticleRow, HardwareCategory, IngestionResult, ProposalRow, WeeklySyncResult } from "./types.ts";
import { truncate } from "./util.ts";

const PROPOSAL_KIND_LABELS: Record<string, string> = {
  NEW_PART: "🆕 신규 부품",
  STATUS_CHANGE: "⬆️ 발표→출시 전환",
  SPEC_UPDATE: "📈 스펙/점수 갱신",
};

const CATEGORY_LABELS: Record<HardwareCategory, string> = {
  CPU: "🧠 CPU",
  GPU: "🎮 GPU",
  RAM: "📊 RAM/메모리",
  SSD: "💾 SSD/스토리지",
  MAINBOARD: "🔌 메인보드",
  DRIVER_UPDATE: "🛠 드라이버 업데이트",
  BIOS_FIRMWARE: "⚙️ BIOS/펌웨어",
  GAME_OPTIMIZATION: "🚀 게임 최적화 (DLSS/FSR)",
  POWER_THERMAL: "⚡ 전력/발열 실측 벤치마크",
  ISSUE_REPORT: "🚨 초기 불량/이슈 리포트",
  GENERAL: "📰 일반 하드웨어 뉴스",
};

const CATEGORY_ORDER: HardwareCategory[] = [
  "GPU",
  "CPU",
  "RAM",
  "SSD",
  "MAINBOARD",
  "DRIVER_UPDATE",
  "BIOS_FIRMWARE",
  "GAME_OPTIMIZATION",
  "POWER_THERMAL",
  "ISSUE_REPORT",
  "GENERAL",
];

export class BriefingFormatter {
  formatBriefing(articles: ArticleRow[], headerTitle: string): string {
    if (articles.length === 0) {
      return `📭 **${headerTitle}**\n\n수집된 신규 데이터가 없습니다.`;
    }
    const grouped = new Map<HardwareCategory, ArticleRow[]>();
    for (const article of articles) {
      const category = (article.category as HardwareCategory) ?? "GENERAL";
      const bucket = grouped.get(category) ?? [];
      bucket.push(article);
      grouped.set(category, bucket);
    }

    const lines: string[] = [];
    lines.push(`📡 **${headerTitle}**`);
    lines.push(`총 ${articles.length}건 수집 | ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST`);
    lines.push("");

    for (const category of CATEGORY_ORDER) {
      const bucket = grouped.get(category);
      if (!bucket || bucket.length === 0) continue;
      lines.push(`━━ ${CATEGORY_LABELS[category]} (${bucket.length}건) ━━`);
      for (const article of bucket.slice(0, 8)) {
        const perfTag = article.perf_gain_percent !== null ? ` [성능 +${article.perf_gain_percent}%]` : "";
        const partTag = article.detected_part_name ? ` 〈${article.detected_part_name}〉` : "";
        lines.push(`• ${article.title}${perfTag}${partTag}`);
        lines.push(`  요약: ${truncate(article.summary, 150)}`);
        lines.push(`  🔗 출처(${article.source_name}): ${article.link}`);
      }
      if (bucket.length > 8) {
        lines.push(`  …외 ${bucket.length - 8}건`);
      }
      lines.push("");
    }
    return lines.join("\n").trim();
  }

  formatIngestionResult(result: IngestionResult): string {
    const durationSec = ((result.finishedAt.getTime() - result.startedAt.getTime()) / 1000).toFixed(1);
    const categoryLines = Object.entries(result.byCategory)
      .map(([cat, count]) => `  - ${CATEGORY_LABELS[cat as HardwareCategory] ?? cat}: ${count}건`)
      .join("\n");
    return [
      "✅ **실시간 수집 사이클 완료**",
      `소요 시간: ${durationSec}s | 성공 피드: ${result.fetchedFeeds} | 실패 피드: ${result.failedFeeds}`,
      `신규 기사: ${result.newArticles}건 | 중복 스킵: ${result.duplicates}건 | 성능 데이터: ${result.perfDataPoints}건`,
      categoryLines ? `카테고리별 신규:\n${categoryLines}` : "신규 카테고리 데이터 없음",
      "",
      "`!briefing` / `/briefing` 명령으로 미브리핑 요약을 확인할 수 있습니다.",
    ].join("\n");
  }

  formatWeeklyReport(sync: WeeklySyncResult): string {
    const lines: string[] = [];
    lines.push("🧹 **주간 마스터 데이터 동기화 보고서 (매주 월요일 09:05 KST)**");
    lines.push("");
    lines.push(`🆕 신규 추가 부품: ${sync.newParts.length}개`);
    for (const part of sync.newParts.slice(0, 20)) lines.push(`  + ${part}`);
    lines.push(`⬆️ 발표됨→출시됨 업그레이드: ${sync.upgradedParts.length}개`);
    for (const part of sync.upgradedParts.slice(0, 20)) lines.push(`  ↑ ${part}`);
    lines.push(`📈 성능 데이터 누적 갱신: ${sync.perfUpdatedParts.length}개`);
    for (const part of sync.perfUpdatedParts.slice(0, 20)) lines.push(`  % ${part}`);
    lines.push("");
    lines.push(`🧹 DB 최적화 — VACUUM: ${sync.vacuumOk ? "성공" : "실패"} | ANALYZE: ${sync.analyzeOk ? "성공" : "실패"}`);
    return lines.join("\n");
  }

  /** !proposals / /proposals 및 일일 브리핑에 삽입되는 승인 대기 목록. */
  formatPendingProposalsList(proposals: ProposalRow[]): string {
    if (proposals.length === 0) {
      return "📋 승인 대기 중인 카탈로그 제안이 없습니다.";
    }
    const lines: string[] = [`📋 **승인 대기 중인 카탈로그 제안: ${proposals.length}건**`, ""];
    for (const p of proposals) {
      const kindLabel = PROPOSAL_KIND_LABELS[p.kind] ?? p.kind;
      const confidence = p.match_confidence !== null ? ` (신뢰도 ${Math.round(p.match_confidence * 100)}%)` : "";
      lines.push(`#${p.id} ${kindLabel} — ${p.category} 〈${p.detected_name}〉${confidence}`);
    }
    lines.push("");
    lines.push("`!approve <id>` / `!reject <id> [사유]` (Telegram: `/approve`, `/reject`)로 처리, `!proposals`로 상세 확인.");
    return lines.join("\n");
  }

  /** !proposals 상세 보기 — 개별 제안의 변경 전/후 diff를 사람이 읽을 수 있게 펼친다. */
  formatProposalDetail(p: ProposalRow): string {
    const kindLabel = PROPOSAL_KIND_LABELS[p.kind] ?? p.kind;
    const lines: string[] = [`#${p.id} ${kindLabel} — ${p.category} 〈${p.detected_name}〉`];
    if (p.target_catalog_id) {
      lines.push(`대상 카탈로그 id: ${p.target_catalog_id}`);
    }
    if (p.match_confidence !== null) {
      lines.push(`매칭 신뢰도: ${Math.round(p.match_confidence * 100)}%`);
    }
    if (p.payload_before) {
      lines.push(`변경 전: ${p.payload_before}`);
    }
    lines.push(`변경 후(제안값): ${p.payload_after}`);

    let sourceIds: number[] = [];
    try {
      sourceIds = JSON.parse(p.source_article_ids) as number[];
    } catch {
      // 무시 — 근거 기사 id 파싱 실패해도 나머지 정보는 표시
    }
    if (sourceIds.length > 0) {
      lines.push(`근거 기사 id: ${sourceIds.join(", ")}`);
    }
    lines.push(`생성: ${p.created_at}`);
    return lines.join("\n");
  }

  formatDecisionResult(action: "approved" | "rejected", p: ProposalRow): string {
    const verb = action === "approved" ? "✅ 승인" : "🚫 거절";
    return `${verb} 처리됨: #${p.id} 〈${p.detected_name}〉`;
  }

  /** !export-approved 응답 — 봇은 웹앱 소스에 접근할 수 없어 JSON을 그대로 찍어주고, 사람이
   *  로컬 저장소에서 scripts/applyProposals.ts로 반영한 뒤 !mark-applied로 닫아야 함을 안내한다. */
  formatExportedProposals(items: ProposalExportItem[]): string {
    if (items.length === 0) {
      return "📤 내보낼 승인된 제안이 없습니다(SPEC_UPDATE 종류 중 아직 미반영인 것만 대상).";
    }
    const ids = items.map((i) => i.id).join(" ");
    return [
      `📤 **승인된 제안 내보내기: ${items.length}건**`,
      "아래 JSON을 파일로 저장한 뒤 로컬 pc-fit-new 저장소에서:",
      "`npm run apply-proposals -- <저장한 파일 경로>`",
      "실행 후 정상 반영됐으면 여기서:",
      `\`!mark-applied ${ids}\``,
      "로 알려주세요(그래야 다음에 다시 내보내지 않습니다).",
      "",
      "```json",
      JSON.stringify(items, null, 2),
      "```",
    ].join("\n");
  }

  formatMarkAppliedResult(results: Array<{ id: number; ok: boolean; message: string }>): string {
    const lines = ["📌 **적용 완료 처리 결과**", ""];
    for (const r of results) {
      lines.push(`${r.ok ? "✅" : "⚠"} #${r.id}: ${r.message}`);
    }
    return lines.join("\n");
  }
}

export class MessageChunker {
  static split(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];

    const chunks: string[] = [];
    const paragraphs = text.split("\n");
    let current = "";

    for (const paragraph of paragraphs) {
      if (paragraph.length > maxLength) {
        if (current.trim().length > 0) {
          chunks.push(current.trimEnd());
          current = "";
        }
        let remaining = paragraph;
        while (remaining.length > maxLength) {
          chunks.push(remaining.slice(0, maxLength));
          remaining = remaining.slice(maxLength);
        }
        current = remaining.length > 0 ? `${remaining}\n` : "";
        continue;
      }
      if (current.length + paragraph.length + 1 > maxLength) {
        chunks.push(current.trimEnd());
        current = "";
      }
      current += `${paragraph}\n`;
    }
    if (current.trim().length > 0) chunks.push(current.trimEnd());
    return chunks.filter((chunk) => chunk.length > 0);
  }
}
