"use client";

import { useEffect, useMemo, useState, type ClipboardEvent } from "react";
import Container from "@/components/layout/Container";
import WorkloadCategoryCard from "@/components/scan/WorkloadCategoryCard";
import PartialSuccessCard, { type ScanFieldStatus } from "@/components/scan/PartialSuccessCard";
import { runFullScan, formatRamApproxDisplay, type BrowserScanResult } from "../lib/browserScan";
import { mergeScanResults } from "../lib/mergeScanResults";
import { parseSpecOutput, type ParseCommandOutputResult } from "../lib/scanParser";
import { WORKLOAD_PROFILES } from "../lib/workloadProfiles";
import { formatFpsDisplay, formatScoreDisplay } from "../lib/fpsDisplay";
import { evaluateDisplayMatch } from "../lib/displayMatch";
import { scoreWorkloadsByCategory } from "../lib/workloadScoring";
import { cpus } from "../database/cpu";
import { gpus } from "../database/gpu";
import { matchGpuToDb } from "../lib/gpuMatch";
import { createSessionToken } from "../lib/sessionToken";
import { submitScan, SubmitInFlightError, SubmitThrottledError, MIN_SUBMIT_INTERVAL_MS } from "../lib/api/submitScan";

// CPU가 아직 확인되지 않았을 때 카테고리 점수를 계산하기 위한 중립 기준값.
// register-pc 페이지의 기본 선택값(cpus[0])과 동일한 관례를 따른다 — 실제 CPU가
// 확인되면 이 값은 즉시 merged.cpuId로 대체된다.
const BASELINE_CPU = cpus[0];
const BASELINE_GPU = gpus[0];

function resolveGpuCatalogEntry(detectedGpu: string | null) {
  if (!detectedGpu) return null;
  return matchGpuToDb(detectedGpu).matched;
}

export default function ScanPage() {
  const [sessionToken] = useState(() => createSessionToken());
  const [webglResult, setWebglResult] = useState<BrowserScanResult | null>(null);
  const [scanning, setScanning] = useState(true);
  const [cmdResult, setCmdResult] = useState<ParseCommandOutputResult | null>(null);
  const [cmdRawText, setCmdRawText] = useState("");
  const [showCpuConfirm, setShowCpuConfirm] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [throttledUntil, setThrottledUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // 쓰로틀 락이 걸려있는 동안 버튼에 "잠시만요… N초"를 실시간으로 보여준다 —
  // 조용히 클릭을 무시하면 유저 입장에서는 "고장났나?"로 읽힌다.
  useEffect(() => {
    if (throttledUntil === null) return;
    const tick = () => {
      const remain = Math.max(0, Math.ceil((throttledUntil - Date.now()) / 1000));
      setRemainingSeconds(remain);
      if (remain <= 0) setThrottledUntil(null);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [throttledUntil]);

  useEffect(() => {
    let cancelled = false;
    runFullScan().then((result) => {
      if (!cancelled) {
        setWebglResult(result);
        setScanning(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const merged = useMemo(
    () => mergeScanResults(webglResult ?? { gpu: null, threads: null, ramApproxGB: null, screen: null }, cmdResult),
    [webglResult, cmdResult]
  );

  const matchedGpuEntry = useMemo(() => resolveGpuCatalogEntry(merged.gpuModel), [merged.gpuModel]);
  const effectiveGpu = matchedGpuEntry ?? BASELINE_GPU;
  const effectiveCpu = useMemo(
    () => (merged.cpuId ? (cpus.find((c) => c.id === merged.cpuId) ?? BASELINE_CPU) : BASELINE_CPU),
    [merged.cpuId]
  );

  const categoryScores = useMemo(
    () => scoreWorkloadsByCategory(effectiveCpu, effectiveGpu, merged.ramApproxGB ?? undefined),
    [effectiveCpu, effectiveGpu, merged.ramApproxGB]
  );

  const scanFields: ScanFieldStatus[] = [
    { label: "GPU", detected: merged.gpuModel != null, value: merged.gpuModel ?? undefined },
    { label: "CPU", detected: merged.cpuConfirmed, value: merged.cpuLabel ?? undefined },
    { label: "스레드 수", detected: merged.threads != null, value: merged.threads ? `${merged.threads}개` : undefined },
    { label: "메모리 용량(근사)", detected: merged.ramApproxGB != null, value: merged.ramApproxGB ? formatRamApproxDisplay(merged.ramApproxGB) : undefined },
    { label: "모니터", detected: merged.screen != null, value: merged.screen ? `${merged.screen.w}×${merged.screen.h}` : undefined },
  ];

  const handleCmdPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData("text");
    if (!pastedText.trim()) return;
    event.preventDefault();
    setCmdRawText(pastedText);
    setCmdResult(parseSpecOutput(pastedText));
  };

  const handleSubmit = async () => {
    if (throttledUntil !== null) return; // 버튼이 disabled라 사실상 도달하지 않지만, 방어적으로 한 번 더 막는다
    setSubmitStatus("전송 중...");
    // 클릭 즉시 락을 걸어 버튼에 카운트다운을 보여준다(성공/실패 결과를 기다리지 않고 낙관적으로 표시).
    setThrottledUntil(Date.now() + MIN_SUBMIT_INTERVAL_MS);
    try {
      const result = await submitScan({
        sessionToken,
        gpuModel: merged.gpuModel,
        threads: merged.threads,
        ramApproxGB: merged.ramApproxGB,
        screen: merged.screen,
      });
      if (result.ok) {
        setSubmitStatus("전송 완료");
      } else if (result.error === "missing_api_base_url") {
        setSubmitStatus("API 주소가 아직 설정되지 않았습니다 (.env.local의 NEXT_PUBLIC_API_BASE_URL).");
      } else if (result.error === "timeout") {
        setSubmitStatus("응답이 늦어지고 있어요. 잠시 후 다시 시도해주세요.");
      } else {
        setSubmitStatus(`전송 실패: ${result.error}`);
      }
    } catch (error) {
      if (error instanceof SubmitThrottledError) {
        setSubmitStatus("");
      } else if (error instanceof SubmitInFlightError) {
        setSubmitStatus(error.message);
      } else {
        setSubmitStatus("알 수 없는 오류가 발생했습니다.");
      }
    }
  };

  return (
    <main className="min-h-screen bg-ink py-10 text-white">
      <Container className="flex flex-col gap-6">
        <div>
          <p className="text-sm font-semibold text-brand-soft">자동감지</p>
          <h1 className="mt-2 text-2xl font-bold text-white">내 컴퓨터, 자동으로 찾아볼게요</h1>
          <p className="mt-2 text-sm text-white/60">
            {scanning ? "브라우저에서 하드웨어 정보를 감지하는 중이에요..." : "감지가 끝났어요. 아래에서 확인해 주세요."}
          </p>
        </div>

        <PartialSuccessCard fields={scanning ? [] : scanFields} onFixMissing={() => setShowCpuConfirm(true)} />

        {showCpuConfirm && (
          <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <p className="text-sm font-semibold text-white">CPU 확인하기</p>
            <p className="mt-1 text-xs leading-relaxed text-white/55">
              CMD 결과를 붙여넣으면 CPU를 정확히 인식해요. 방법을 모르신다면{" "}
              <a href="/mypage/register-pc" className="text-brand-soft underline underline-offset-2">
                자세한 가이드
              </a>
              를 참고하세요.
            </p>
            <textarea
              value={cmdRawText}
              onChange={(event) => setCmdRawText(event.target.value)}
              onPaste={handleCmdPaste}
              placeholder="CMD 실행 결과를 여기에 붙여넣어 주세요."
              className="mt-3 h-28 w-full rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 ring-1 ring-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>
        )}

        <p className="text-xs text-white/35">예상치는 통계 모델 기반 추정으로 실제 성능과 다를 수 있어요.</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {WORKLOAD_PROFILES.map((profile) => {
            const isGameCategory = profile.name.startsWith("게임/");
            const avgScore = categoryScores[profile.name] ?? 0;

            const displayValue = isGameCategory
              ? formatFpsDisplay({
                  estimatedFps: evaluateDisplayMatch(avgScore, profile.name, "QHD", 144).estimatedFps,
                  boundBy: profile.boundBy,
                  cpuConfirmed: merged.cpuConfirmed,
                })
              : formatScoreDisplay({ score: avgScore, boundBy: profile.boundBy, cpuConfirmed: merged.cpuConfirmed });

            return (
              <WorkloadCategoryCard
                key={profile.name}
                label={profile.label}
                boundBy={profile.boundBy}
                displayValue={displayValue}
                cpuConfirmed={merged.cpuConfirmed}
                onConfirmCpu={() => setShowCpuConfirm(true)}
              />
            );
          })}
        </div>

        <div className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-5 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/40">감지 결과를 서버로 보내 더 정확한 추천을 받을 수 있어요.</p>
          <div className="flex items-center gap-3">
            {submitStatus && <p className="text-xs text-white/60">{submitStatus}</p>}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={scanning || throttledUntil !== null}
              className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {throttledUntil !== null ? `잠시만요… ${remainingSeconds}초` : "결과 전송하기"}
            </button>
          </div>
        </div>
      </Container>
    </main>
  );
}
