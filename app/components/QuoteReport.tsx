"use client";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * QuoteReport.tsx — 견적서 저장/성능 대시보드 (다나와/컴퓨존 그리드 스타일)
 * ─────────────────────────────────────────────────────────────────────────────
 * 반영 사항:
 *  [1] 모든 박스 내부 텍스트 상하좌우 완전 중앙 정렬 (flex items-center justify-center)
 *  [2] '종합 성능' 영역을 점수+레이더를 한 행의 컴팩트 밴드로 통합
 *  [3] 다나와/컴퓨존식 정돈된 그리드 테이블 (분류 | 제품명 | 상태 3열 구조)
 *  [4] 필수 6부품(CPU/GPU/메인보드/RAM/SSD/파워) 상시 노출,
 *      HDD는 선택 항목 — 미선택 시 '선택 안 함'으로 안전 처리 (에러 없음)
 *  [5] 모니터/케이스는 사용자가 직접 선택하는 셀렉트 UX + 마이크로 카피 안내
 *  [6] 부품/조립 사진 업로드 + 미리보기 (인메모리 처리, 최대 4장)
 *  [7] '파워' 행 하단에 PsuInlineGuide, 모니터/케이스 안내 문구 아래 PsuAlertBanner
 *      (app/lib/psuRecommendation.ts 계산 결과를 표시만 담당)
 *
 * 비즈니스 로직 보존: 성능 계산/저장 스크립트는 건드리지 않고,
 * 모든 데이터를 props로 주입받아 표시만 담당합니다 (Presentational Component).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { PsuAlertBanner, PsuInlineGuide, usePsuGuide } from "@/components/ui/PsuGuide";
import DarkSelect from "@/components/ui/DarkSelect";
import Callout from "@/components/ui/Callout";

// ═══════════════════════════════════════════════════════════════════════════
// 타입 정의 — 기존 데이터 구조에 맞춰 필드명만 매핑해서 사용하세요
// ═══════════════════════════════════════════════════════════════════════════
export interface QuoteParts {
  cpu: string;
  gpu: string;
  mainboard: string;
  ram: string;
  ssd: string;
  psu: string;
  /** 선택 항목 — undefined/null/빈 문자열이면 '선택 안 함'으로 표시 */
  hdd?: string | null;
}

export interface PerformanceScores {
  total: number; // 종합 점수 (0~100)
  gaming: number; // 게임 (0~100)
  office: number; // 사무·일반
  video: number; // 영상편집
  ai: number; // AI 작업
  summary: string; // 예: "웬만한 작업은 전부 여유롭게 소화해요."
}

export interface QuoteReportProps {
  userName?: string;
  /** 생략하면 컴포넌트가 마운트 후에 오늘 날짜로 채운다(아래 참고) — 호출부가 넘기지 않는 게 기본 */
  reportDate?: string;
  parts: QuoteParts;
  performance: PerformanceScores;
  monitorOptions: string[];
  caseOptions: string[];
  /** 저장 중 상태 — 버튼 비활성화/라벨 전환용 (선택) */
  saving?: boolean;
  /** 저장 시 상위 비즈니스 로직으로 전달 — 기존 저장 스크립트 연결 지점 */
  onSave?: (payload: { monitor: string | null; caseName: string | null; images: File[] }) => void;
  /** 종합 성능 배지 바로 아래 노출할 3줄 요약(한줄평/병목 요인/추천 용도) — 없으면 섹션 자체를 숨긴다 */
  summaryLines?: [string, string, string];
  /** "결과 링크 복사" 클릭 시 호출 — 실제 클립보드 쓰기는 상위(퍼머링크를 아는 쪽)에서 담당 */
  onCopyLink?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// 상수 & 유틸 (로직/스타일 분리)
// ═══════════════════════════════════════════════════════════════════════════
const MAX_IMAGES = 4;

/** 필수 6부품 — 이 배열 순서 그대로 테이블에 상시 노출 */
const REQUIRED_PART_ROWS: ReadonlyArray<{
  key: keyof Omit<QuoteParts, "hdd">;
  label: string;
}> = [
  { key: "cpu", label: "CPU" },
  { key: "gpu", label: "그래픽카드" },
  { key: "mainboard", label: "메인보드" },
  { key: "ram", label: "메모리" },
  { key: "ssd", label: "SSD" },
  { key: "psu", label: "파워" },
];

const cellCenter = "flex items-center justify-center text-center"; // 완전 중앙 정렬 공통 클래스

// ═══════════════════════════════════════════════════════════════════════════
// 서브 컴포넌트 — 컴팩트 레이더 차트 (SVG, 외부 라이브러리 무의존)
// ═══════════════════════════════════════════════════════════════════════════
function CompactRadar({ scores }: { scores: PerformanceScores }) {
  const SIZE = 132; // 기존 대비 대폭 축소된 고정 사이즈
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = SIZE / 2 - 18;

  // 상(게임) → 우(영상편집) → 하(AI) → 좌(사무) 4축
  const axes = [
    { label: "게임", value: scores.gaming, angle: -90 },
    { label: "영상편집", value: scores.video, angle: 0 },
    { label: "AI 작업", value: scores.ai, angle: 90 },
    { label: "사무·일반", value: scores.office, angle: 180 },
  ];

  const toPoint = (angleDeg: number, ratio: number): [number, number] => {
    const rad = (angleDeg * Math.PI) / 180;
    return [CX + R * ratio * Math.cos(rad), CY + R * ratio * Math.sin(rad)];
  };

  const dataPolygon = axes.map((a) => toPoint(a.angle, Math.max(0.05, a.value / 100)).join(",")).join(" ");
  const gridPolygon = (ratio: number) => axes.map((a) => toPoint(a.angle, ratio).join(",")).join(" ");

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="용도별 성능 레이더 차트" className="shrink-0">
      {[0.33, 0.66, 1].map((r) => (
        <polygon key={r} points={gridPolygon(r)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      <polygon points={dataPolygon} fill="var(--color-brand)" fillOpacity={0.25} stroke="var(--color-brand)" strokeWidth="1.5" />
      {axes.map((a) => {
        const [lx, ly] = toPoint(a.angle, 1.22);
        return (
          <text key={a.label} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.55)" fontSize="8.5" fontWeight="700">
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════════════════
export default function QuoteReport({
  userName = "유저",
  reportDate,
  parts,
  performance,
  monitorOptions,
  caseOptions,
  saving = false,
  onSave,
  summaryLines,
  onCopyLink,
}: QuoteReportProps) {
  // ── 모니터/케이스 직접 선택 상태 ──
  const [monitor, setMonitor] = useState<string>("");
  const [caseName, setCaseName] = useState<string>("");

  // 리포트 날짜 — new Date()를 렌더 중에 바로 쓰면(예전엔 reportDate 기본값이 그랬다) /my-pc가
  // 정적 렌더 페이지라 빌드 시점에 고정된 서버 값과 실제 방문 시점의 클라이언트 값이 달라져
  // React #418(하이드레이션 실패)이 난다. 첫 렌더는 빈 문자열로 서버와 맞추고 마운트 후에만 채운다.
  const [clientReportDate, setClientReportDate] = useState("");
  useEffect(() => {
    setClientReportDate(new Date().toLocaleDateString("ko-KR"));
  }, []);
  const displayedReportDate = reportDate ?? clientReportDate;

  // ── "결과 링크 복사" 클릭 피드백 — 실제 클립보드 쓰기는 onCopyLink(상위)가 담당,
  //    여기선 클릭 직후 잠깐 토스트만 띄운다(실패해도 UX상 큰 문제 없는 가벼운 피드백).
  const [showCopyToast, setShowCopyToast] = useState(false);
  const handleCopyLink = useCallback(() => {
    onCopyLink?.();
    setShowCopyToast(true);
    window.setTimeout(() => setShowCopyToast(false), 2000);
  }, [onCopyLink]);

  // ── 이미지 업로드 상태 (인메모리 — localStorage 미사용) ──
  const [images, setImages] = useState<File[]>([]);
  const previews = useMemo(() => images.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })), [images]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 파워 권장 용량 계산 — 표시만 담당, 계산은 app/lib/psuRecommendation.ts 순수 함수가 처리
  const psu = usePsuGuide(parts.cpu, parts.gpu, parts.psu);

  const handleImageChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    setImages((prev) => [...prev, ...selected].slice(0, MAX_IMAGES));
    e.target.value = ""; // 같은 파일 재선택 허용
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(() => {
    onSave?.({
      monitor: monitor || null,
      caseName: caseName || null,
      images,
    });
  }, [onSave, monitor, caseName, images]);

  // HDD 선택적 처리 — 값이 없어도 절대 에러 없이 '선택 안 함'
  const hddDisplay = parts.hdd?.trim() ? parts.hdd : "선택 안 함";
  const hddSelected = Boolean(parts.hdd?.trim());

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 text-white">
      {/* ══ 헤더 ══ */}
      <header className="flex items-center justify-between rounded-xl bg-surface px-5 py-4 ring-1 ring-line">
        <div className="flex items-center gap-3">
          <span className={`h-10 w-10 rounded-lg bg-gradient-to-br from-brand to-brand-soft ${cellCenter}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path d="M8 21h8M12 16v5" />
            </svg>
          </span>
          <div>
            <h1 className="text-base font-semibold text-white">{userName}님의 PC 진단서</h1>
            <p className="text-xs text-white/40">
              {displayedReportDate ? `${displayedReportDate} · ` : ""}PC FIT
            </p>
          </div>
        </div>
        <span className="rounded-full bg-good/10 px-3 py-1 text-xs font-medium text-good">진단 완료</span>
      </header>

      {/* ══ 종합 성능 — 압축된 단일 컴팩트 밴드 ══ */}
      {/* <sm: 세로 스택(점수·요약·레이더가 각자 전체 폭을 씀) / sm+: 기존 가로 배치 */}
      <section
        aria-label="종합 성능"
        className="flex flex-col items-center gap-4 rounded-xl bg-surface px-5 py-4 ring-1 ring-line sm:flex-row sm:gap-5"
      >
        <div className={`min-w-[120px] flex-col gap-0.5 ${cellCenter}`}>
          <p className="text-[11px] font-medium tracking-wide text-white/40">종합 성능</p>
          <p className="leading-none">
            <span className="text-4xl font-bold tabular-nums text-white">{performance.total}</span>
            <span className="ml-1 text-sm text-white/40">/100</span>
          </p>
        </div>
        <div className="hidden h-14 w-px bg-line sm:block" aria-hidden="true" />
        <p className="w-full text-center text-sm text-white/70 sm:w-auto sm:min-w-0 sm:flex-1">{performance.summary}</p>
        <CompactRadar scores={performance} />
      </section>

      {/* ══ 3줄 요약 — 한줄평 / 병목 요인 / 추천 용도 (43종 워크로드 데이터에서 파생) ══ */}
      {summaryLines && (
        <section aria-label="한눈에 보기 요약" className="rounded-xl bg-surface px-5 py-4 ring-1 ring-line">
          <ul className="space-y-1.5 text-sm leading-relaxed text-white/75">
            {summaryLines.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="shrink-0 text-brand-soft">
                  ·
                </span>
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ══ 다나와/컴퓨존식 부품 그리드 테이블 ══ */}
      <section aria-label="견적 부품 목록" className="overflow-hidden rounded-xl ring-1 ring-line">
        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[110px_1fr_92px] bg-surface-raise text-xs font-medium text-white/40">
          <div className={`px-3 py-2.5 ${cellCenter}`}>분류</div>
          <div className={`px-3 py-2.5 ${cellCenter}`}>제품명</div>
          <div className={`px-3 py-2.5 ${cellCenter}`}>상태</div>
        </div>

        {/* 필수 6부품 — 항상 노출 */}
        {REQUIRED_PART_ROWS.map(({ key, label }, i) => (
          <div key={key} className={i % 2 === 0 ? "bg-surface" : "bg-surface/60"}>
            <div className="grid grid-cols-[110px_1fr_92px] text-sm">
              <div className={`px-3 py-3 font-medium text-white/40 ${cellCenter}`}>{label}</div>
              <div className={`min-w-0 px-3 py-3 font-semibold text-white ${cellCenter}`}>
                <span className="min-w-0 truncate">{parts[key]}</span>
              </div>
              <div className={`px-3 py-3 ${cellCenter}`}>
                <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-soft">필수</span>
              </div>
            </div>
            {/* 파워 행 바로 아래 — 최소 권장 파워 안내 (상시 노출, 미달 시에만 경고 톤) */}
            {key === "psu" && <PsuInlineGuide recommendation={psu.recommendation} adequacy={psu.adequacy} />}
          </div>
        ))}

        {/* HDD — 선택 항목 (미선택 시에도 에러 없이 표시) */}
        <div className="grid grid-cols-[110px_1fr_92px] bg-surface text-sm">
          <div className={`px-3 py-3 font-medium text-white/40 ${cellCenter}`}>HDD</div>
          <div className={`min-w-0 px-3 py-3 ${cellCenter} ${hddSelected ? "font-semibold text-white" : "text-white/30"}`}>
            <span className="min-w-0 truncate">{hddDisplay}</span>
          </div>
          <div className={`px-3 py-3 ${cellCenter}`}>
            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-white/40">선택</span>
          </div>
        </div>
      </section>

      {/* ══ 모니터 & 케이스 직접 선택 + 마이크로 카피 ══ */}
      <section aria-label="모니터 및 케이스 선택" className="space-y-3 rounded-xl bg-surface p-5 ring-1 ring-line">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-center text-xs font-medium text-white/40">모니터 (직접 선택)</span>
            <DarkSelect value={monitor} onChange={(e) => setMonitor(e.target.value)} className="text-center">
              <option value="">선택 안 함</option>
              {monitorOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </DarkSelect>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-center text-xs font-medium text-white/40">케이스 (직접 선택)</span>
            <DarkSelect value={caseName} onChange={(e) => setCaseName(e.target.value)} className="text-center">
              <option value="">선택 안 함</option>
              {caseOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </DarkSelect>
          </label>
        </div>
        {/* 마이크로 카피 */}
        <Callout variant="warning" className="justify-center text-center">
          모니터와 케이스는 본체 연산 성능(FPS, 병목)에 직접적인 영향을 주지 않습니다.
        </Callout>
        {/* 파워 용량 미달 시에만 승격 노출되는 경고 배너 */}
        <PsuAlertBanner recommendation={psu.recommendation} adequacy={psu.adequacy} />
      </section>

      {/* ══ 사진 첨부 (업로드 + 미리보기) ══ */}
      <section aria-label="사진 첨부" className="space-y-3 rounded-xl bg-surface p-5 ring-1 ring-line">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">부품/조립 사진 첨부</h2>
          <span className="text-xs text-white/40">
            {images.length}/{MAX_IMAGES}장
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {previews.map((p, i) => (
            <div key={p.url} className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기 용도 */}
              <img src={p.url} alt={`첨부 이미지 ${i + 1}: ${p.name}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label={`${p.name} 삭제`}
                className={`absolute right-1 top-1 h-6 w-6 rounded-full bg-black/70 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 ${cellCenter}`}
              >
                ✕
              </button>
            </div>
          ))}

          {images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`aspect-square flex-col gap-1 rounded-lg border-2 border-dashed border-line text-white/40 transition-colors hover:border-brand hover:text-brand-soft ${cellCenter}`}
            >
              <span className="text-xl leading-none">＋</span>
              <span className="text-[11px]">사진 추가</span>
            </button>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
      </section>

      {/* ══ 저장 버튼 — 기존 저장 로직(onSave)으로 위임 + 결과 링크 복사(퍼머링크) ══ */}
      <div className="relative flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`flex-1 rounded-xl bg-brand py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-soft disabled:opacity-60 ${cellCenter}`}
        >
          {saving ? "견적서 만드는 중…" : "견적서 저장하기"}
        </button>
        {onCopyLink && (
          <button
            type="button"
            onClick={handleCopyLink}
            className={`shrink-0 rounded-xl bg-white/[0.06] px-4 py-3.5 text-sm font-semibold text-white/80 ring-1 ring-line transition-colors hover:bg-white/[0.1] hover:text-white ${cellCenter}`}
          >
            {showCopyToast ? "복사됨 ✓" : "결과 링크 복사"}
          </button>
        )}

        {showCopyToast && (
          <div
            role="status"
            className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-4 py-2 text-xs font-medium text-white shadow-lg"
          >
            결과 링크를 복사했어요
          </div>
        )}
      </div>
    </div>
  );
}
