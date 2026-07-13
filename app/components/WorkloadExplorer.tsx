"use client";

/**
 * WorkloadExplorer — 43종 워크로드 점수를 "검색창 + 태그 칩"으로 탐색.
 * 별칭(alias) 기반 검색으로 "배그"→배틀그라운드, "롤"→리그 오브 레전드처럼
 * 컴맹 유저가 실제로 치는 단어를 흡수한다. 점수는 항상 실시간 계산된
 * workloadScoring.ts의 scoreAllWorkloads() 결과를 그대로 받는다(고정 데이터 아님).
 */

import { useDeferredValue, useMemo, useState } from "react";
import type { WorkloadScore } from "../lib/workloadScoring";

type WorkloadGroup = "game" | "video" | "cad" | "render" | "ai";

const GROUP_META: Record<WorkloadGroup, { label: string; emoji: string }> = {
  game: { label: "게임", emoji: "🎮" },
  video: { label: "영상/VFX", emoji: "🎬" },
  cad: { label: "CAD", emoji: "📐" },
  render: { label: "렌더링", emoji: "🧊" },
  ai: { label: "AI/딥러닝", emoji: "🧠" },
};

/** workloadScoring.ts 의 category 문자열("게임/CPU클럭" 등)을 5개 탐색 그룹으로 묶는다 */
function groupOf(category: string): WorkloadGroup {
  if (category.startsWith("게임/")) return "game";
  if (category === "영상/VFX") return "video";
  if (category === "CAD") return "cad";
  if (category === "렌더링") return "render";
  return "ai";
}

/** 워크로드 id → 유저가 실제로 검색할 법한 줄임말/은어/영문명 */
const ALIASES: Record<string, string[]> = {
  lol: ["롤", "lol", "리그오브레전드", "소환사"],
  valorant: ["발로", "valorant", "발로란트"],
  ow2: ["옵치", "오버워치", "overwatch"],
  fconline: ["피파", "fc온라인", "fconline", "피온"],
  sudden: ["서든", "suddenattack", "서든어택"],
  cs2: ["cs2", "카스", "카운터스트라이크", "counterstrike"],
  fortnite: ["포나", "포트나이트", "fortnite"],
  pubg: ["배그", "pubg", "펍지", "총겜"],
  lostark: ["로아", "lostark"],
  wow: ["와우", "wow", "월드오브워크래프트"],
  maple: ["메이플", "maplestory"],
  dnf: ["던파", "dnf", "던전앤파이터"],
  rdr2: ["rdr2", "레데리", "레드데드"],
  mhwilds: ["몬헌", "monsterhunter", "몬스터헌터"],
  bdo: ["검사", "bdo", "검은사막"],
  valhalla: ["발할라", "ac발할라", "assassinscreed"],
  gta5: ["gta", "gta5", "지티에이"],
  eldenring: ["엘든", "엘든링", "eldenring"],
  cyberpunk: ["사펑", "cyberpunk", "사이버펑크"],
  witcher3: ["위쳐", "witcher", "위쳐3"],
  horizon: ["호라이즌", "horizon"],
  forza5: ["포르자", "forza"],
  avatar: ["아바타", "avatar", "프론티어"],
  premiere: ["프리미어", "premiere", "영상편집", "유튜브편집"],
  davinci: ["다빈치", "davinci", "리졸브"],
  aftereffects: ["애펙", "aftereffects", "모션그래픽"],
  finalcut: ["파컷", "finalcut", "파이널컷"],
  vegas: ["베가스", "vegas"],
  autocad: ["캐드", "autocad", "오토캐드"],
  solidworks: ["솔웍스", "solidworks"],
  catia: ["카티아", "catia"],
  revit: ["레빗", "revit"],
  sketchup: ["스케치업", "sketchup"],
  blender: ["블렌더", "blender"],
  cinema4d: ["c4d", "시네마4d", "cinema4d"],
  maxmaya: ["맥스", "마야", "3dsmax", "maya"],
  octane: ["옥테인", "octane"],
  vray: ["브이레이", "vray"],
  pytorch: ["파이토치", "pytorch"],
  stablediff: ["sd", "stablediffusion", "스테이블디퓨전"],
  ollama: ["올라마", "ollama", "로컬llm"],
  tensorflow: ["텐서플로", "tensorflow", "tf"],
  jupyter: ["주피터", "jupyter", "아나콘다", "코딩"],
};

/** 공백 제거 + 소문자화 — "배 그", "PUBG" 모두 흡수 */
const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();

function matchesQuery(label: string, aliases: string[], q: string): boolean {
  if (!q) return true;
  const nq = normalize(q);
  if (normalize(label).includes(nq)) return true;
  return aliases.some((a) => normalize(a).includes(nq));
}

/** 토스식 "숫자 하나로 상태 전달": 색과 라벨을 점수에서 파생. ScoreHero의 종합 등급 기준(90/75/55)과 통일. */
function scoreTier(score: number) {
  if (score >= 90) return { label: "PERFECT", text: "text-good", bar: "bg-good", ring: "ring-good/20" };
  if (score >= 75) return { label: "GOOD", text: "text-brand-soft", bar: "bg-brand", ring: "ring-brand/20" };
  if (score >= 55) return { label: "OK", text: "text-warn", bar: "bg-warn", ring: "ring-warn/20" };
  return { label: "UPGRADE", text: "text-bad", bar: "bg-bad", ring: "ring-bad/20" };
}

function noteFor(w: WorkloadScore, tierLabel: string): string {
  if (w.penalties.length > 0) return w.penalties[0];
  switch (tierLabel) {
    case "PERFECT":
      return "여유롭게 구동돼요";
    case "GOOD":
      return "무난하게 구동돼요";
    case "OK":
      return "설정 조절이 필요할 수 있어요";
    default:
      return "업그레이드를 고려해보세요";
  }
}

type ChipKey = "all" | WorkloadGroup;

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "game", label: "#게임" },
  { key: "video", label: "#영상/VFX" },
  { key: "cad", label: "#CAD" },
  { key: "render", label: "#렌더링" },
  { key: "ai", label: "#AI" },
];

export default function WorkloadExplorer({ scores }: { scores: WorkloadScore[] }) {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<ChipKey>("all");
  // 타이핑은 즉시 반영, 카드 리스트 필터링은 한 박자 늦게 → 입력 랙 제거
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    return scores
      .filter((w) => (chip === "all" ? true : groupOf(w.category) === chip))
      .filter((w) => matchesQuery(w.label, ALIASES[w.id] ?? [], deferredQuery))
      .sort((a, b) => b.score - a.score);
  }, [scores, chip, deferredQuery]);

  const resetAll = () => {
    setQuery("");
    setChip("all");
  };

  return (
    <section className="w-full">
      <div className="sticky top-0 z-10 bg-gradient-to-b from-surface via-surface/95 to-transparent pb-3 pt-1">
        <label
          htmlFor="workload-search"
          className="group flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3.5 ring-1 ring-line transition-all duration-200 focus-within:bg-white/[0.09] focus-within:ring-2 focus-within:ring-brand/60"
        >
          <svg
            className="h-5 w-5 shrink-0 text-white/40 transition-colors group-focus-within:text-brand-soft"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>

          <input
            id="workload-search"
            type="search"
            inputMode="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="배그, 롤, 포토샵, 블렌더… 뭐든 검색해보세요"
            className="w-full bg-transparent text-[15px] text-white placeholder:text-white/35 outline-none [&::-webkit-search-cancel-button]:hidden"
            aria-label="워크로드 검색"
          />

          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="검색어 지우기"
              className="shrink-0 rounded-full bg-white/10 p-1 text-white/50 transition-colors hover:bg-white/20 hover:text-white"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </label>

        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="워크로드 카테고리"
        >
          {CHIPS.map(({ key, label }) => {
            const active = chip === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setChip(key)}
                className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-150 active:scale-95 ${
                  active ? "bg-brand text-white shadow-glow" : "bg-white/[0.06] text-white/60 ring-1 ring-line hover:bg-white/[0.1] hover:text-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mb-3 mt-1 text-[12px] text-white/40" aria-live="polite">
        {filtered.length === scores.length ? `전체 ${scores.length}개 항목` : `${scores.length}개 중 ${filtered.length}개 표시 중`}
      </p>

      {filtered.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 pb-2">
          {filtered.map((w) => {
            const tier = scoreTier(w.score);
            const group = groupOf(w.category);
            return (
              <li
                key={w.id}
                className={`rounded-2xl bg-white/[0.04] p-4 ring-1 ${tier.ring} ring-inset transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white/[0.06]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-bold text-white">{w.label}</h3>
                    <p className="text-[12px] text-white/45">
                      {GROUP_META[group].emoji} {GROUP_META[group].label}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-xl font-extrabold tabular-nums ${tier.text}`}>{w.score}</p>
                    <p className={`text-[10px] font-bold tracking-widest ${tier.text}`}>{tier.label}</p>
                  </div>
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <div className={`h-full rounded-full ${tier.bar} transition-[width] duration-500 ease-out`} style={{ width: `${w.score}%` }} />
                </div>

                <p className="mt-2.5 text-[12.5px] text-white/55">{noteFor(w, tier.label)}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-4xl" aria-hidden="true">
            🔍
          </span>
          <p className="text-[15px] font-semibold text-white">&lsquo;{query}&rsquo; 검색 결과가 없어요</p>
          <p className="text-[13px] text-white/45">줄임말로 검색해보세요 (예: 배그, 롤, 블렌더)</p>
          <button
            type="button"
            onClick={resetAll}
            className="mt-2 rounded-full bg-white/[0.08] px-5 py-2.5 text-[13px] font-semibold text-white ring-1 ring-line transition-colors hover:bg-white/[0.14] active:scale-95"
          >
            전체 목록 보기
          </button>
        </div>
      )}
    </section>
  );
}
