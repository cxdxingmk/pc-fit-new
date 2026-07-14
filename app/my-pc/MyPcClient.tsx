"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cpus } from "../database/cpu";
import { gpus } from "../database/gpu";
import { rams } from "../database/ram";
import { ssds } from "../database/ssd";
import { motherboards } from "../database/motherboard";
import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";
import { getMyPcScore, getGrade, getMyPcWorkloadScores, buildThreeLineSummary } from "../lib/myPc";
import { evaluateAllGames, type Resolution as DisplayResolution, type RefreshRate } from "../lib/displayMatch";
import type { UserSavedPc } from "../types/hardware";
import { simulatePcPerformance } from "../lib/simulator";
import { derivePartSeries } from "../lib/derivePartSeries";
import { readJsonFromStorage } from "../lib/localStorageJson";
import { encodeSpec, decodeSpec } from "../lib/specPermalink";
import Card from "../../components/ui/Card";
import Badge, { toneFromScore } from "../../components/ui/Badge";
import Callout from "../../components/ui/Callout";
import AccordionSection from "../../components/ui/AccordionSection";
import CascadingPartSelect from "../../components/ui/CascadingPartSelect";
import { useCascadingPartSelect } from "../../components/ui/useCascadingPartSelect";
import DarkSelect from "../../components/ui/DarkSelect";
import GpuAutoDetect from "../../components/GpuAutoDetect";
import WorkloadExplorer from "../components/WorkloadExplorer";
import QuoteReport, { type PerformanceScores, type QuoteParts } from "../components/QuoteReport";
import { useAuth } from "../context/AuthContext";
import {
  PcSummaryChip,
  DisplayControls,
  GameCard,
  overallVerdict,
  useShareImage,
  useSaveNudge,
  ShareReportCard,
  LoginNudgeModal,
  type CategoryScore,
  type ShareReportData,
} from "../components/pcfit-ui";

const SPEC_STORAGE_KEY = "user_pc_spec";
const REFRESH_RATE_OPTIONS: RefreshRate[] = [60, 144, 240];
const MONITOR_OPTIONS = ["FHD · 60Hz", "FHD · 144Hz", "QHD · 144Hz", "QHD · 240Hz", "4K · 60Hz", "4K · 144Hz"];
const CASE_OPTIONS = ["미들타워", "빅타워", "미니 ITX", "슬림형"];

const MONITOR_BOTTLENECK_LABEL: Record<string, string> = {
  NONE: "병목 없음",
  REFRESH_CAP: "주사율 상한에 묶여 그 이상은 못 보여줘요",
  // "부족" 프레이밍 대신 "설정이 이렇다"는 사실 안내로 — 목표 해상도를 실제 모니터보다
  // 높게 잡으면 당연히 뜨는 상태라, 경고처럼 읽히지 않게 한다.
  RESOLUTION_LIMIT: "설정한 해상도가 지금 모니터보다 높아요",
};

// 첫 화면 기본 샘플 사양 — "컴알못" 타겟이 실제로 흔히 쓰는 구형 보급형 조합으로 맞춘다.
// cpus[0]/motherboards[0]/rams[0]을 각각 독립적으로 기본값 삼으면 서로 소켓·DDR 규격이
// 안 맞는 조합(예: LGA1700 CPU + LGA1851 보드)이 될 수 있어, 소켓/DDR이 실제로 호환되는
// 조합만 명시적으로 고정한다.
const DEFAULT_CPU_ID = "r5-5600"; // Ryzen 5 5600 (AM4, 2020, 보급형)
const DEFAULT_MOTHERBOARD_ID = "b550m-aorus-pro"; // AM4 · DDR4, 위 CPU와 소켓 호환
const DEFAULT_RAM_ID = "16-ddr4-3200"; // 위 보드가 지원하는 DDR4
const DEFAULT_GPU_ID = "gtx1660super"; // GTX 1660 SUPER (2019, 보급형)

export default function MyPcClient() {
  const { user, mockLogin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [cpu, setCpu] = useState<CPU>(() => cpus.find((c) => c.id === DEFAULT_CPU_ID) ?? cpus[0]);
  const [gpu, setGpu] = useState<GPU>(() => gpus.find((g) => g.id === DEFAULT_GPU_ID) ?? gpus[0]);
  const [ram, setRam] = useState<RAM>(() => rams.find((r) => r.id === DEFAULT_RAM_ID) ?? rams[0]);
  const [ssd, setSsd] = useState<SSD>(ssds[0]);
  const [motherboard, setMotherboard] = useState<MotherBoard>(
    () => motherboards.find((m) => m.id === DEFAULT_MOTHERBOARD_ID) ?? motherboards[0]
  );
  const [psu, setPsu] = useState("500W");

  // 내 모니터 기준(등록 화면에서 저장한 값이 있으면 그 값을 기본값으로 사용)
  const [monitorRes, setMonitorRes] = useState<DisplayResolution>("QHD");
  const [monitorHz, setMonitorHz] = useState<RefreshRate>(144);

  useEffect(() => {
    const saved = readJsonFromStorage<{ monitorResolution?: DisplayResolution; monitorRefreshRate?: number }>(SPEC_STORAGE_KEY);
    if (saved?.monitorResolution) setMonitorRes(saved.monitorResolution);
    if (saved?.monitorRefreshRate && REFRESH_RATE_OPTIONS.includes(saved.monitorRefreshRate as RefreshRate)) {
      setMonitorHz(saved.monitorRefreshRate as RefreshRate);
    }
  }, []);

  const [isSpecEditOpen, setIsSpecEditOpen] = useState(false);

  // 퍼머링크로 재방문했는지(즉 ?spec= 이 있었는지) — 재방문 배너 노출 여부에만 쓴다.
  const [isRevisitedFromPermalink, setIsRevisitedFromPermalink] = useState(false);

  // 용도별 성능 시뮬레이터 — 렌더 목표 해상도 + (선택) 다른 모니터 기준 오버라이드
  // 기본값을 monitorRes 기본값("QHD")과 맞춰둔다 — 여기만 "4K"로 따로 두면 사용자가
  // 아무것도 안 건드린 첫 화면부터 "목표 해상도 > 모니터 해상도" 상태가 되어, 아무 조작도
  // 하지 않았는데 병목 안내가 뜨는 것처럼 보였다.
  const [gameTitle, setGameTitle] = useState("Cyberpunk 2077");
  const [resolution, setResolution] = useState<DisplayResolution>("QHD");
  const [useCustomMonitor, setUseCustomMonitor] = useState(false);
  const [customMonitorRes, setCustomMonitorRes] = useState<DisplayResolution>("QHD");
  const [customMonitorHz, setCustomMonitorHz] = useState<RefreshRate>(144);

  // 계층형 선택(브랜드 -> 시리즈/칩셋 -> 모델). register-pc의 CascadingPartSelect/useCascadingPartSelect를
  // 그대로 재사용한다 - 두 화면 모두 app/database/{cpu,gpu,motherboard}.ts를 원본으로 쓰므로 안전하게 통합된다.
  const cpuSeriesOf = useMemo(() => (item: CPU) => derivePartSeries(item.name), []);
  const gpuSeriesOf = useMemo(() => (item: GPU) => derivePartSeries(item.name), []);
  const mbChipsetOf = useMemo(() => (item: MotherBoard) => item.chipset, []);

  const cpuCascade = useCascadingPartSelect(cpus, cpuSeriesOf, cpu.id);
  const gpuCascade = useCascadingPartSelect(gpus, gpuSeriesOf, gpu.id);
  const mbCascade = useCascadingPartSelect(motherboards, mbChipsetOf, motherboard.id);

  const handleCpuSelect = (id: string) => {
    cpuCascade.selectModel(id);
    const found = cpus.find((item) => item.id === id);
    if (found) setCpu(found);
  };
  const handleGpuSelect = (id: string) => {
    gpuCascade.selectModel(id);
    const found = gpus.find((item) => item.id === id);
    if (found) setGpu(found);
  };
  const handleMbSelect = (id: string) => {
    mbCascade.selectModel(id);
    const found = motherboards.find((item) => item.id === id);
    if (found) setMotherboard(found);
  };

  // 퍼머링크 복원이 끝났는지 — 끝나기 전엔 URL 동기화 effect가 기본 샘플 사양으로
  // URL을 덮어써버리는 걸 막는다.
  const [hasHydratedSpec, setHasHydratedSpec] = useState(false);

  // ── 퍼머링크 복원: 최초 마운트에만 ?spec= 을 읽어 상태에 반영 ──
  // 개별 필드 하나만 오염돼도 나머지는 살리고, id가 카탈로그에 없으면 그 필드만 조용히 건너뛴다.
  useEffect(() => {
    const raw = searchParams.get("spec");
    if (raw) {
      const decoded = decodeSpec(raw);
      if (decoded) {
        const foundCpu = cpus.find((c) => c.id === decoded.c);
        const foundGpu = gpus.find((g) => g.id === decoded.g);
        const foundRam = rams.find((r) => r.id === decoded.r);
        const foundSsd = ssds.find((s) => s.id === decoded.s);
        const foundMb = motherboards.find((m) => m.id === decoded.m);
        if (foundCpu) handleCpuSelect(foundCpu.id);
        if (foundGpu) handleGpuSelect(foundGpu.id);
        if (foundRam) setRam(foundRam);
        if (foundSsd) setSsd(foundSsd);
        if (foundMb) handleMbSelect(foundMb.id);
        if (decoded.p) setPsu(decoded.p);
        if (decoded.mr === "FHD" || decoded.mr === "QHD" || decoded.mr === "4K") setMonitorRes(decoded.mr);
        if (decoded.mh === 60 || decoded.mh === 144 || decoded.mh === 240) setMonitorHz(decoded.mh);
        setIsRevisitedFromPermalink(true);
      }
    }
    setHasHydratedSpec(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 최초 마운트 1회만 실행
  }, []);

  // ── 현재 사양 -> URL 동기화: 퍼머링크 복원이 끝난 뒤부터 변경마다 반영(새로고침/공유 시에도 유지) ──
  useEffect(() => {
    if (!hasHydratedSpec) return;
    const encoded = encodeSpec({
      c: cpu.id,
      g: gpu.id,
      r: ram.id,
      s: ssd.id,
      m: motherboard.id,
      p: psu,
      mr: monitorRes,
      mh: monitorHz,
    });
    router.replace(`${pathname}?spec=${encoded}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router/pathname은 안정적이라 생략
  }, [hasHydratedSpec, cpu.id, gpu.id, ram.id, ssd.id, motherboard.id, psu, monitorRes, monitorHz]);

  const handleCopyLink = useCallback(() => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href).catch(() => {
      // 클립보드 권한 거부 등 — 조용히 무시(토스트는 낙관적으로 그대로 노출)
    });
  }, []);

  const handleResetToDefault = useCallback(() => {
    handleCpuSelect(DEFAULT_CPU_ID);
    handleGpuSelect(DEFAULT_GPU_ID);
    const defaultRam = rams.find((r) => r.id === DEFAULT_RAM_ID) ?? rams[0];
    setRam(defaultRam);
    setSsd(ssds[0]);
    handleMbSelect(DEFAULT_MOTHERBOARD_ID);
    setPsu("500W");
    setIsRevisitedFromPermalink(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handle*Select는 매 렌더 재생성되는 안정적 클로저
  }, []);

  const ramFieldId = useId();
  const ssdFieldId = useId();
  const psuFieldId = useId();
  const gameTitleFieldId = useId();
  const resolutionFieldId = useId();
  const customMonitorResFieldId = useId();
  const customMonitorHzFieldId = useId();

  const savedPc = useMemo<UserSavedPc>(
    () => ({
      id: "demo-pc",
      cpuId: cpu.id,
      gpuId: gpu.id,
      ramCapacity: ram.name.includes("64") ? "64GB" : ram.name.includes("32") ? "32GB" : "16GB",
      ramDetail: ram.name,
      ssdCapacity: ssd.name,
      ssdDetail: ssd.name,
      monitorResolution: monitorRes,
      monitorRefreshRate: monitorHz,
    }),
    [cpu.id, gpu.id, ram.name, ssd.name, monitorRes, monitorHz]
  );

  const effectiveMonitorRes = useCustomMonitor ? customMonitorRes : monitorRes;
  const effectiveMonitorHz = useCustomMonitor ? customMonitorHz : monitorHz;
  const simulationPc = useMemo<UserSavedPc>(
    () => ({ ...savedPc, monitorResolution: effectiveMonitorRes, monitorRefreshRate: effectiveMonitorHz }),
    [savedPc, effectiveMonitorRes, effectiveMonitorHz]
  );

  const parts = useMemo(() => ({ cpu, gpu, ram, ssd, motherboard }), [cpu, gpu, ram, ssd, motherboard]);

  const score = useMemo(() => getMyPcScore(parts), [parts]);
  const simulation = useMemo(() => simulatePcPerformance(simulationPc, gameTitle, resolution), [gameTitle, resolution, simulationPc]);
  const workloadScores = useMemo(() => getMyPcWorkloadScores({ cpu, gpu, ram }), [cpu, gpu, ram]);
  const [openWorkloads, setOpenWorkloads] = useState(false);
  const displayMatchRows = useMemo(
    () => evaluateAllGames(workloadScores, monitorRes, monitorHz, gpu.vram),
    [workloadScores, monitorRes, monitorHz, gpu.vram]
  );

  const categories = useMemo<CategoryScore[]>(
    () => [
      { axis: "게임", score: score.gameScore },
      { axis: "영상편집", score: score.workScore },
      { axis: "AI 작업", score: score.aiScore },
      { axis: "사무·일반", score: score.officeScore },
    ],
    [score]
  );

  // 진단서 카드 최상단 3줄 요약 — 한줄평(재사용) / 병목 요인(43종 penaltyKinds 집계) /
  // 추천 용도(4축 점수 비교). 부품을 바꾸면 workloadScores·categories가 갱신되며 자동 재계산된다.
  const summaryLines = useMemo(
    () =>
      buildThreeLineSummary({
        verdictLine: overallVerdict(score.totalScore).line,
        workloadScores,
        categories,
      }),
    [score.totalScore, workloadScores, categories]
  );

  const shareReport = useMemo<ShareReportData>(
    () => ({
      userName: user?.name,
      overall: score.totalScore,
      verdict: overallVerdict(score.totalScore).line,
      categories,
      specs: [
        { label: "CPU", value: cpu.name },
        { label: "GPU", value: gpu.name },
        { label: "RAM", value: savedPc.ramCapacity },
        { label: "모니터", value: `${monitorRes} / ${monitorHz}Hz` },
      ],
    }),
    [user?.name, score.totalScore, categories, cpu.name, gpu.name, savedPc.ramCapacity, monitorRes, monitorHz]
  );

  // QuoteReport(견적서/성능 대시보드) 프레젠테이셔널 컴포넌트로 넘길 데이터 매핑.
  // 필드명이 다른 부분만 여기서 맞춰준다 — 점수/견적 계산 로직 자체는 그대로 getMyPcScore 결과를 사용.
  const quoteParts = useMemo<QuoteParts>(
    () => ({
      cpu: cpu.name,
      gpu: gpu.name,
      mainboard: motherboard.name,
      ram: ram.name,
      ssd: ssd.name,
      psu,
      hdd: null,
    }),
    [cpu.name, gpu.name, motherboard.name, ram.name, ssd.name, psu]
  );

  const performanceScores = useMemo<PerformanceScores>(
    () => ({
      total: score.totalScore,
      gaming: score.gameScore,
      office: score.officeScore,
      video: score.workScore,
      ai: score.aiScore,
      summary: overallVerdict(score.totalScore).line,
    }),
    [score]
  );

  // 기존 "진단서 이미지로 저장" 로직(html2canvas 캡처 + 게스트 저장 넛지) 그대로 재사용 —
  // 트리거하는 버튼 UI만 QuoteReport 내부의 "견적서 저장하기" 버튼으로 옮긴다.
  const { cardRef: shareCardRef, save: saveShareImage, saving: isSavingShareImage } = useShareImage();
  const { showNudge, closeNudge, trackSave } = useSaveNudge();
  const handleQuoteSave = async () => {
    await saveShareImage();
    trackSave();
  };

  return (
    <div className="flex flex-col gap-6">
      {isRevisitedFromPermalink && (
        <Callout variant="info" role="status">
          저장해둔 진단 결과예요 — 부품을 바꿔서 다시 비교해볼까요?{" "}
          <button type="button" onClick={handleResetToDefault} className="font-semibold text-brand-soft underline hover:text-brand">
            새로 진단하기
          </button>
        </Callout>
      )}

      <GpuAutoDetect onGpuSelected={handleGpuSelect} />

      <PcSummaryChip
        cpu={cpu.name}
        gpu={gpu.name}
        ram={savedPc.ramCapacity}
        onEdit={() => setIsSpecEditOpen((prev) => !prev)}
      />

      {isSpecEditOpen && (
        <Card className="p-4" muted>
          <h3 className="text-sm font-semibold text-white/60">부품 선택</h3>
          <div className="mt-3 space-y-4">
            <CascadingPartSelect title="CPU" state={{ ...cpuCascade, selectModel: handleCpuSelect }} />
            <CascadingPartSelect title="GPU" state={{ ...gpuCascade, selectModel: handleGpuSelect }} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={ramFieldId} className="block text-xs font-medium text-white/40">
                  RAM
                </label>
                <div className="mt-1">
                  <DarkSelect
                    id={ramFieldId}
                    value={ram.id}
                    onChange={(event) => {
                      const found = rams.find((item) => item.id === event.target.value);
                      if (found) setRam(found);
                    }}
                  >
                    {rams.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </DarkSelect>
                </div>
              </div>

              <div>
                <label htmlFor={ssdFieldId} className="block text-xs font-medium text-white/40">
                  SSD
                </label>
                <div className="mt-1">
                  <DarkSelect
                    id={ssdFieldId}
                    value={ssd.id}
                    onChange={(event) => {
                      const found = ssds.find((item) => item.id === event.target.value);
                      if (found) setSsd(found);
                    }}
                  >
                    {ssds.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </DarkSelect>
                </div>
              </div>
            </div>

            <CascadingPartSelect title="메인보드" groupLabel="칩셋" state={{ ...mbCascade, selectModel: handleMbSelect }} />

            <div>
              <label htmlFor={psuFieldId} className="block text-xs font-medium text-white/40">
                파워 용량
              </label>
              <input
                id={psuFieldId}
                value={psu}
                onChange={(event) => setPsu(event.target.value)}
                className="mt-1 block w-full rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white ring-1 ring-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </div>
          </div>
        </Card>
      )}

      <QuoteReport
        userName={user?.name}
        parts={quoteParts}
        performance={performanceScores}
        monitorOptions={MONITOR_OPTIONS}
        caseOptions={CASE_OPTIONS}
        saving={isSavingShareImage}
        onSave={handleQuoteSave}
        summaryLines={summaryLines}
        onCopyLink={handleCopyLink}
      />
      <ShareReportCard data={shareReport} innerRef={shareCardRef} />
      <LoginNudgeModal open={showNudge} onClose={closeNudge} onLogin={mockLogin} />

      <section className="rounded-3xl bg-surface p-8 shadow-card ring-1 ring-line">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white/60">내 모니터 기준으로 보기</h2>
          <Badge tone={toneFromScore(score.totalScore)}>{getGrade(score.totalScore)}</Badge>
        </div>
        <DisplayControls res={monitorRes} hz={monitorHz} onRes={setMonitorRes} onHz={setMonitorHz} />
      </section>

      <p className="text-xs text-white/35">예상치는 통계 모델 기반 추정으로 실제 성능과 다를 수 있어요.</p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {displayMatchRows.map((row) => (
          <GameCard key={row.label} row={row} />
        ))}
      </section>

      {/* 프로그램별 예상 성능 (게임 23 + 전문/AI 앱 20) */}
      <AccordionSection title="🖥️ 프로그램별 예상 성능 (43종)" isOpen={openWorkloads} onToggle={() => setOpenWorkloads((prev) => !prev)}>
        <WorkloadExplorer scores={workloadScores} />
      </AccordionSection>

      {/* 용도별 성능 시뮬레이터 */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-white/60">🎮 용도별 성능 시뮬레이터</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={gameTitleFieldId} className="block text-xs font-medium text-white/40">
              게임 제목
            </label>
            <input
              id={gameTitleFieldId}
              value={gameTitle}
              onChange={(event) => setGameTitle(event.target.value)}
              className="mt-1 block w-full rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white ring-1 ring-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>
          <div>
            <label htmlFor={resolutionFieldId} className="block text-xs font-medium text-white/40">
              플레이 목표 해상도
            </label>
            <div className="mt-1">
              <DarkSelect id={resolutionFieldId} value={resolution} onChange={(event) => setResolution(event.target.value as DisplayResolution)}>
                <option value="FHD">FHD</option>
                <option value="QHD">QHD</option>
                <option value="4K">4K</option>
              </DarkSelect>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setUseCustomMonitor((prev) => !prev)}
          className="mt-3 w-fit text-xs font-semibold text-brand-soft transition-colors hover:text-brand"
        >
          {useCustomMonitor ? "내 모니터 기준으로 돌아가기" : `다른 모니터 기준으로 보기 (현재: ${monitorRes} / ${monitorHz}Hz)`}
        </button>

        {useCustomMonitor && (
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-line">
            <div>
              <label htmlFor={customMonitorResFieldId} className="block text-xs font-medium text-white/40">
                모니터 해상도
              </label>
              <div className="mt-1">
                <DarkSelect
                  id={customMonitorResFieldId}
                  value={customMonitorRes}
                  onChange={(event) => setCustomMonitorRes(event.target.value as DisplayResolution)}
                >
                  <option value="FHD">FHD</option>
                  <option value="QHD">QHD</option>
                  <option value="4K">4K</option>
                </DarkSelect>
              </div>
            </div>
            <div>
              <label htmlFor={customMonitorHzFieldId} className="block text-xs font-medium text-white/40">
                모니터 주사율
              </label>
              <div className="mt-1">
                <DarkSelect
                  id={customMonitorHzFieldId}
                  value={customMonitorHz}
                  onChange={(event) => setCustomMonitorHz(Number(event.target.value) as RefreshRate)}
                >
                  {REFRESH_RATE_OPTIONS.map((hz) => (
                    <option key={hz} value={hz}>
                      {hz}Hz
                    </option>
                  ))}
                </DarkSelect>
              </div>
            </div>
          </div>
        )}

        <dl className="mt-4 divide-y divide-white/[0.06] rounded-xl bg-white/[0.03] px-4 ring-1 ring-line">
          <DetailRow label="렌더링 FPS" value={simulation.renderedFps} />
          <DetailRow label="예상 평균 FPS" value={simulation.averageFps} />
          <DetailRow label="1% 저하 프레임" value={simulation.onePercentLowFps} />
          <DetailRow label="모니터 병목" value={MONITOR_BOTTLENECK_LABEL[simulation.monitorBottleneck]} />
          <DetailRow label="업스케일 권장" value={simulation.recommendUpscaling ? "예" : "아니오"} />
        </dl>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-white/40">{label}</dt>
      <dd className="truncate text-right font-medium text-white/85">{value}</dd>
    </div>
  );
}
