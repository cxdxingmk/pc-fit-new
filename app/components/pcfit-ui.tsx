/**
 * PC FIT — MyPcClient UI 리디자인 컴포넌트 세트 (데스크톱 전용)
 * 톤앤매너: 다크 차콜 + 토스 블루, 신호등 배지 우선, rounded-2xl+, 은은한 glow
 * displayMatch.ts 타입과 1:1 호환. 기준 뷰포트 1440px~2560px, 모바일 분기 없음.
 */

"use client";

import type { ReactNode, Ref } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import type { Resolution, RefreshRate, DisplayTier, DisplayMatchRow } from "@/app/lib/displayMatch";
import { anchorCorrectedFps, anchorCorrectedMessage, getEngineCapFps } from "@/app/lib/workloadScoring";
import { formatGameFpsDisplay } from "@/app/lib/gameFpsRange";
import InfoTooltip from "@/components/ui/InfoTooltip";

// ─────────────────────────────────────────────────────────────────────────────
// 마이크로 인터랙션 프리셋 — 클래스 상수로 통일 관리
// 원칙: scale 은 1.01 이하, duration 은 200ms 기본. 클릭 피드백은 active:scale-[0.99].
// ─────────────────────────────────────────────────────────────────────────────

export const FX = {
  card: "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:ring-white/10 hover:bg-surface-raise",
  button: "transition-all duration-200 ease-out hover:brightness-110 active:scale-[0.99]",
  accordion: "transition-colors duration-200 hover:bg-white/[0.03]",
  chevron: "transition-transform duration-300 ease-in-out",
  input: "transition-shadow duration-200 focus:ring-2 focus:ring-brand/60",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 0. 공용 원자 컴포넌트 (섹션 카드 / 주요 버튼) — 전 페이지 공유
// ─────────────────────────────────────────────────────────────────────────────

export function SectionCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-surface p-8 shadow-card ring-1 ring-line ${className}`}>{children}</section>;
}

export function PrimaryButton({
  children,
  onClick,
  full = false,
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  full?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${full ? "w-full" : "w-fit"} rounded-2xl bg-brand px-6 py-3.5 text-sm font-bold text-white shadow-glow ${FX.button} hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-brand/40 disabled:shadow-none disabled:active:scale-100`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TIER 배지 — 신호등 컬러 + 미세 애니메이션 (displayMatch.ts 의 TIER_UI 확장판)
// ─────────────────────────────────────────────────────────────────────────────

// 게이머 은어("방어", "역부족") 대신 컴맹 타겟도 바로 이해할 수 있는 일상어로 표기한다.
const TIER_STYLE: Record<DisplayTier, { label: string; dot: string; text: string; ring: string; pulse?: boolean }> = {
  PERFECT: { label: "충분히 여유로워요", dot: "bg-good", text: "text-good", ring: "ring-good/25", pulse: true },
  GOOD: { label: "무난하게 돌아가요", dot: "bg-lime-400", text: "text-lime-300", ring: "ring-lime-400/20" },
  LACK_GPU: { label: "그래픽카드가 아쉬워요", dot: "bg-warn", text: "text-warn", ring: "ring-warn/25" },
  LACK_CPU: { label: "CPU가 아쉬워요", dot: "bg-warn", text: "text-warn", ring: "ring-warn/25" },
  CRITICAL: { label: "성능이 많이 부족해요", dot: "bg-bad", text: "text-bad", ring: "ring-bad/25" },
};

export function TierBadge({ tier }: { tier: DisplayTier }) {
  const s = TIER_STYLE[tier];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[0.04] px-2.5 py-1 text-xs font-semibold ring-1 ${s.ring} ${s.text}`}>
      <span className="relative flex h-1.5 w-1.5">
        {s.pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${s.dot} opacity-60 motion-reduce:hidden`} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${s.dot}`} />
      </span>
      {s.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 세그먼트 컨트롤 — 해상도/주사율 드롭다운 폐기 (옵션 3개 고정 탭)
// ─────────────────────────────────────────────────────────────────────────────

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  format = String,
  label,
  labelSlot,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  format?: (v: T) => string;
  label: string;
  labelSlot?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium tracking-wide text-white/40">{labelSlot ?? label}</span>
      <div role="tablist" aria-label={label} className="flex rounded-xl bg-white/[0.04] p-1 ring-1 ring-line">
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={String(opt)}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(opt)}
              className={cnLocal(
                "min-w-0 flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
                active ? "bg-brand text-white shadow-glow" : "text-white/50 hover:text-white/80"
              )}
            >
              {format(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function cnLocal(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function DisplayControls({
  res,
  hz,
  onRes,
  onHz,
}: {
  res: Resolution;
  hz: RefreshRate;
  onRes: (r: Resolution) => void;
  onHz: (h: RefreshRate) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Segmented
        label="모니터 해상도"
        labelSlot={<Tooltip term="해상도">모니터 해상도</Tooltip>}
        value={res}
        options={["FHD", "QHD", "4K"] as const}
        onChange={onRes}
      />
      <Segmented
        label="주사율"
        labelSlot={<Tooltip term="주사율">주사율</Tooltip>}
        value={hz}
        options={[60, 144, 240] as const}
        onChange={onHz}
        format={(v) => `${v}Hz`}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. 히어로 — 종합 점수 + 체급 레이더 (좌 점수 / 우 레이더 고정 2칼럼)
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryScore {
  axis: string;
  score: number;
}

export function overallVerdict(avg: number): { grade: string; line: string; tone: string } {
  if (avg >= 90) return { grade: "최상급", line: "웬만한 작업은 전부 여유롭게 소화해요.", tone: "text-good" };
  if (avg >= 75) return { grade: "상급", line: "최신 게임과 작업 모두 무리 없어요.", tone: "text-brand-soft" };
  if (avg >= 55) return { grade: "보통", line: "가벼운 게임·작업 위주로 알맞아요.", tone: "text-warn" };
  return { grade: "아쉬움", line: "옵션 타협이 필요한 사양이에요.", tone: "text-bad" };
}

export function ScoreHero({ categories }: { categories: CategoryScore[] }) {
  const avg = Math.round(categories.reduce((a, c) => a + c.score, 0) / Math.max(categories.length, 1));
  const v = overallVerdict(avg);

  return (
    <section className="grid grid-cols-[1fr_340px] items-center gap-10 rounded-3xl bg-surface p-10 shadow-card ring-1 ring-line">
      <div className="flex flex-col gap-3">
        <span className={`w-fit rounded-full bg-white/[0.05] px-3 py-1 text-xs font-bold tracking-wide ${v.tone}`}>종합 {v.grade}</span>
        <div className="flex items-end gap-2">
          <span className="text-7xl font-extrabold leading-none tracking-tight text-white">{avg}</span>
          <span className="pb-1.5 text-lg font-medium text-white/30">/ 100</span>
        </div>
        <p className="text-[15px] leading-relaxed text-white/70">{v.line}</p>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={categories} outerRadius="78%">
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="score" stroke="var(--color-brand)" strokeWidth={2} fill="var(--color-brand)" fillOpacity={0.22} isAnimationActive animationDuration={700} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 게임 결과 카드 — "배지 먼저, 숫자는 뒤로" (내부 enum 노출 없이 message 문구만 사용)
// ─────────────────────────────────────────────────────────────────────────────

function MiniGauge({ value }: { value: number }) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand to-brand-soft transition-[width] duration-500" style={{ width: `${value}%` }} />
    </div>
  );
}

export function GameCard({ row }: { row: DisplayMatchRow }) {
  const [open, setOpen] = useState(false);
  // 헤드라인(범위 표기)과 하단 설명 문구가 서로 다른 fps를 말하지 않도록, 앵커/엔진 캡
  // 보정된 값을 한 번만 계산해 두 곳 모두에 동일하게 먹인다 — 절대 따로 계산하지 않는다.
  const correctedFps = anchorCorrectedFps(row.id, row.estimatedFps);
  const engineCap = getEngineCapFps(row.id);
  const message = anchorCorrectedMessage(row.id, row, correctedFps);

  return (
    <article className={`group flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line ${FX.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-bold text-white">{row.label}</h3>
          <p className="mt-0.5 flex items-center text-xs text-white/35">
            {row.category.replace("게임/", "")}
            <InfoTooltip content={GLOSSARY[row.category.replace("게임/", "")]} preferredPlacement="right" />
          </p>
        </div>
        <TierBadge tier={row.status} />
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-extrabold tabular-nums tracking-tight text-white/90">
          {formatGameFpsDisplay(correctedFps, row.label, engineCap)}
        </span>
        <span className="flex items-center text-xs font-medium text-white/35">
          fps 예상
          <InfoTooltip content={GLOSSARY.fps} preferredPlacement="top" />
        </span>
      </div>

      <MiniGauge value={row.effectiveScore} />

      <p className="text-[13px] leading-relaxed text-white/55">{message}</p>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-auto w-fit text-xs font-semibold text-brand-soft transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        aria-expanded={open}
      >
        {open ? "간단히 보기" : "자세한 수치 보기"}
      </button>

      {open && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-white/[0.03] p-3 text-xs ring-1 ring-line">
          {[
            ["기본 점수", `${row.baseScore}점`],
            ["해상도 반영 점수", `${row.effectiveScore}점`],
            ["주사율 방어율", `${Math.round(row.defenseRatio * 100)}%`],
            ["병목", row.bottleneck === "BALANCED" ? "균형" : row.bottleneck === "GPU" ? "GPU" : "CPU"],
          ].map(([k, val]) => (
            <div key={k} className="contents">
              <dt className="flex items-center text-white/35">
                {k}
                {k === "병목" && <InfoTooltip content={GLOSSARY.병목} preferredPlacement="right" />}
              </dt>
              <dd className="text-right font-semibold tabular-nums text-white/75">{val}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 내 PC 요약 칩 — 결과 화면에서 입력 폼을 대체
// ─────────────────────────────────────────────────────────────────────────────

export function PcSummaryChip({ cpu, gpu, ram, onEdit }: { cpu: string; gpu: string; ram: string; onEdit: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
      <span className="text-xs font-semibold text-white/40">내 PC</span>
      {[cpu, gpu, ram].map((t) => (
        <span key={t} className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/75">
          {t}
        </span>
      ))}
      <button type="button" onClick={onEdit} className="ml-auto rounded-full px-3 py-1 text-xs font-semibold text-brand-soft transition-colors hover:bg-brand/10">
        사양 수정
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. 축별 점수 타입 — ShareReportCard 등에서 카테고리 점수를 표현하는 데 쓰인다.
// ─────────────────────────────────────────────────────────────────────────────

export interface AxisScore {
  axis: string;
  score: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. 미니멀 툴팁 + 컴맹용 용어 사전 — 데스크톱 전용(hover + focus), JS 상태 없이 group 으로 구현
//    (DisplayControls 등 라벨 슬롯형 사용처 전용. 성능 카드는 InfoTooltip(components/ui) 사용)
// ─────────────────────────────────────────────────────────────────────────────

export const GLOSSARY: Record<string, string> = {
  VRAM: "그래픽카드의 임시 기억 공간이에요. 4K 모니터나 AI 작업에서 특히 중요해요.",
  주사율: "화면이 1초에 몇 번 바뀌는지예요. 높을수록 게임이 부드러워요.",
  해상도: "화면의 선명함 단위예요. 4K는 FHD보다 4배 선명하지만 그래픽카드가 4배 힘들어요.",
  fps: "게임이 1초에 그려내는 장면 수예요. 60이면 원활, 144면 아주 부드러워요.",
  CUDA: "NVIDIA 그래픽카드 전용 계산 기술이에요. AI 프로그램 대부분이 이걸 필요로 해요.",
  병목: "한 부품이 느려서 다른 부품이 기다리는 상태예요. 물병 목처럼 좁은 곳이 속도를 정해요.",
  IPC: "CPU가 한 박자에 처리하는 일의 양이에요. 클럭이 같아도 세대가 다르면 성능이 달라요.",
  CPU클럭: "CPU의 처리 속도가 프레임을 크게 좌우하는 게임이에요. 프레임이 낮다면 CPU 업그레이드가 효과적이에요.",
  멀티코어: "CPU와 그래픽카드 성능이 고르게 필요한 게임이에요.",
  GPU래스터: "그래픽카드 성능이 프레임을 크게 좌우하는 게임이에요.",
  RT: "레이트레이싱(빛 반사·그림자를 실사처럼 표현하는 옵션) 같은 고사양 그래픽이 있는 게임이에요. 그래픽카드 성능이 특히 중요해요.",
};

export function Tooltip({
  term,
  children,
  text,
}: {
  term?: keyof typeof GLOSSARY | string;
  children: ReactNode;
  text?: string;
}) {
  const body = text ?? (term ? GLOSSARY[term] : undefined);
  if (!body) return <>{children}</>;
  return (
    <span className="group relative inline-flex cursor-help items-center gap-1" tabIndex={0}>
      {children}
      <span className="text-[10px] text-white/25 group-hover:text-brand-soft">ⓘ</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl bg-ink-soft/95 px-4 py-3 text-xs font-medium leading-relaxed text-white/85 opacity-0 shadow-card ring-1 ring-white/10 backdrop-blur transition-all duration-200 group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus:opacity-100"
      >
        {body}
        <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-ink-soft/95 ring-1 ring-white/10" />
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. 커뮤니티 공유용 고품격 리포트 카드 + html2canvas 엔진
//    화면 밖(fixed, left:-9999px)에 저장 전용 카드를 항상 렌더 → 버튼 클릭 시 그 DOM 만 캡처.
//    레이더는 recharts 대신 순수 SVG 정적 폴리곤으로 그린다(html2canvas + recharts 애니메이션 조합은
//    캡처 시점에 빈 차트가 찍히는 문제가 있음). scale:2 로 고해상도 PNG 출력.
// ─────────────────────────────────────────────────────────────────────────────

function StaticRadar({ data, size = 260 }: { data: AxisScore[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.36;
  const n = data.length;
  // 라벨(예: "사무·일반")이 svg 경계 밖으로 잘리지 않도록 뷰박스에 여백을 둔다 —
  // width/height는 그대로 두고 viewBox만 넓혀 전체를 살짝 축소해 여백을 확보한다.
  const pad = 32;
  const pt = (i: number, r: number) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)] as const;
  };
  const ring = (ratio: number) => data.map((_, i) => pt(i, R * ratio).join(",")).join(" ");
  const poly = data.map((d, i) => pt(i, (R * Math.max(d.score, 8)) / 100).join(",")).join(" ");

  return (
    <svg width={size} height={size} viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`}>
      {[0.33, 0.66, 1].map((r) => (
        <polygon key={r} points={ring(r)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {data.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
      })}
      <polygon points={poly} fill="rgba(76,125,255,0.25)" stroke="#4C7DFF" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 20);
        return (
          <text key={d.axis} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.65)" fontSize="12" fontWeight="700">
            {d.axis}
          </text>
        );
      })}
    </svg>
  );
}

export interface ShareReportData {
  userName?: string;
  overall: number;
  verdict: string;
  categories: AxisScore[];
  specs: { label: string; value: string }[];
  serviceName?: string;
  serviceUrl?: string;
  qrSlot?: ReactNode;
}

/**
 * 저장 전용 카드 — 화면에는 보이지 않고 캡처에만 사용.
 * html2canvas 는 CSS `color-mix(in oklab, ...)` 함수를 파싱하지 못해 캡처가 조용히 실패한다
 * (Tailwind v4는 `/opacity` 슬래시 표기와 `ring-*` 를 전부 이 함수로 컴파일함). 그래서 이 카드는
 * 색이 들어가는 모든 곳을 Tailwind 유틸 대신 리터럴 rgba() 인라인 스타일로 직접 쓴다.
 */
export function ShareReportCard({ data, innerRef }: { data: ShareReportData; innerRef: Ref<HTMLDivElement> }) {
  const { userName, overall, verdict, categories, specs, serviceName = "PC FIT", serviceUrl, qrSlot } = data;
  // window.location.host는 마운트 이후에만 읽는다 — 렌더 중에 바로 읽으면 서버 렌더 결과("")와
  // 클라이언트 결과(실제 host)가 달라져 하이드레이션 불일치 에러가 난다.
  const [runtimeHost, setRuntimeHost] = useState("");
  useEffect(() => {
    setRuntimeHost(window.location.host);
  }, []);
  // 우선순위: 호출부가 명시적으로 넘긴 값 → 환경변수(NEXT_PUBLIC_SITE_URL, 배포 도메인) →
  // 지금 서비스 중인 실제 host — 하드코딩된 임의 도메인은 쓰지 않는다.
  // .env.local에 값이 비어있으면(NEXT_PUBLIC_SITE_URL=) 빈 문자열로 채워지므로,
  // 다음 폴백으로 넘어가려면 ??가 아니라 ||로 falsy(빈 문자열 포함)를 걸러야 한다.
  const resolvedServiceUrl = serviceUrl || process.env.NEXT_PUBLIC_SITE_URL || runtimeHost;
  const hairline = (alpha: number): string => `inset 0 0 0 1px rgba(255,255,255,${alpha})`;

  return (
    <div
      ref={innerRef}
      aria-hidden="true"
      style={{ width: 720, background: "#0A0B0F", boxShadow: hairline(0.1) }}
      className="pointer-events-none fixed left-[-9999px] top-0 flex flex-col gap-7 rounded-3xl p-10 font-sans"
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold text-white" style={{ background: "#4C7DFF" }}>
            PF
          </span>
          <div>
            <p className="text-lg font-extrabold text-white">{userName ? `${userName}님의 ` : ""}PC 진단서</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              {new Date().toLocaleDateString("ko-KR")} · {serviceName}
            </p>
          </div>
        </div>
        <span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: "rgba(48,209,88,0.1)", color: "#30D158" }}>
          진단 완료
        </span>
      </header>

      <div
        className="grid grid-cols-[1fr_auto] items-center gap-6 rounded-2xl p-7"
        style={{ background: "rgba(255,255,255,0.03)", boxShadow: hairline(0.06) }}
      >
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
            종합 성능
          </span>
          <p className="text-6xl font-extrabold leading-none tracking-tight text-white">
            {overall}
            <span className="ml-1 text-xl" style={{ color: "rgba(255,255,255,0.3)" }}>
              /100
            </span>
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            {verdict}
          </p>
        </div>
        <StaticRadar data={categories} />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {specs.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.03)", boxShadow: hairline(0.06) }}
          >
            <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
              {s.label}
            </span>
            <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      <footer className="flex items-center justify-between pt-5" style={{ boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.06)` }}>
        <div>
          <p className="text-sm font-bold" style={{ color: "#6E96FF" }}>
            나에게 딱 맞는 PC 찾기, {serviceName}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            {resolvedServiceUrl} · 로그인 없이 1분 진단
          </p>
        </div>
        {qrSlot && (
          <div className="rounded-lg p-1.5" style={{ background: "#ffffff" }}>
            {qrSlot}
          </div>
        )}
      </footer>
    </div>
  );
}

/** 캡처 & 다운로드 훅 */
export function useShareImage(filename = "pcfit-report.png") {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (!cardRef.current || saving) return;
    setSaving(true);
    try {
      await document.fonts.ready;
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: "#0A0B0F",
        useCORS: true,
        logging: false,
      });
      const url = canvas.toDataURL("image/png");
      const a = Object.assign(document.createElement("a"), { href: url, download: filename });
      a.click();
    } finally {
      setSaving(false);
    }
  }, [saving, filename]);

  return { cardRef, save, saving };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. 비로그인 저장 넛지 — 게스트가 진단서를 일정 횟수 넘게 저장하면 로그인을 다정하게 권한다.
//     이 앱엔 실제 소셜 로그인이 없어 mockLogin(useAuth)을 그대로 연결해 쓴다.
// ─────────────────────────────────────────────────────────────────────────────

const NUDGE_KEY = "pcfit_guest_saves";
const FREE_SAVES = 3;

export function useSaveNudge() {
  const [showNudge, setShowNudge] = useState(false);

  const trackSave = useCallback((): boolean => {
    const n = Number(localStorage.getItem(NUDGE_KEY) ?? 0) + 1;
    localStorage.setItem(NUDGE_KEY, String(n));
    if (n > FREE_SAVES) {
      setShowNudge(true);
      return false;
    }
    return true;
  }, []);

  return { showNudge, closeNudge: () => setShowNudge(false), trackSave };
}

export function LoginNudgeModal({ open, onClose, onLogin }: { open: boolean; onClose: () => void; onLogin: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-96 flex-col items-center gap-4 rounded-3xl bg-surface p-8 text-center shadow-card ring-1 ring-line"
      >
        <span className="text-3xl">💾</span>
        <h3 className="text-lg font-extrabold text-white">진단서가 마음에 드셨나요?</h3>
        <p className="text-sm leading-relaxed text-white/55">
          1초 로그인하면 진단 기록이 저장돼서
          <br />
          부품을 바꿀 때마다 비교해볼 수 있어요.
        </p>
        <PrimaryButton full onClick={onLogin}>
          임의 로그인하고 저장하기
        </PrimaryButton>
        <button onClick={onClose} className="text-xs font-medium text-white/35 hover:text-white/60">
          다음에 할게요
        </button>
      </div>
    </div>
  );
}
