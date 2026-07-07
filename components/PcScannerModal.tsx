"use client";

import { useEffect, useRef, useState } from "react";
import { parseCommandOutput, wmiScanCommand, type ParseCommandOutputResult } from "../app/lib/scanParser";

interface PcScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanText: string;
  setScanText: (value: string) => void;
  onParsed: (result: ParseCommandOutputResult) => void;
}

function StepBadge({ number }: { number: number }) {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500 text-xl font-black text-slate-950 shadow-lg shadow-cyan-500/30">
      {number}
    </div>
  );
}

export default function PcScannerModal({ isOpen, onClose, scanText, setScanText, onParsed }: PcScannerModalProps) {
  const [copyDone, setCopyDone] = useState(false);
  const [parseError, setParseError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setParseError(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [scanText]);

  if (!isOpen) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(wmiScanCommand);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 1600);
    } catch {
      setCopyDone(false);
    }
  };

  const handleParseAndApply = () => {
    const parsed = parseCommandOutput(scanText);
    if (!parsed.cpuId && !parsed.gpuId) {
      setParseError(true);
      textareaRef.current?.focus();
      return;
    }
    setParseError(false);
    onParsed(parsed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-5xl rounded-3xl border border-slate-700 bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-black/60 md:p-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between gap-4">
          <h2 className="text-2xl font-black leading-snug text-cyan-200 md:text-3xl">
            어려운 부품 이름은 몰라도 괜찮아요! 1분 만에 컴퓨터가 알아서 다 찾아드립니다 📋
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            닫기
          </button>
        </div>

        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
          <span className="text-lg" aria-hidden="true">
            🛡️
          </span>
          <p>이 명령어는 컴퓨터 정보만 조회하며, 아무것도 설치하거나 변경하지 않습니다.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 md:p-5">
            <div className="flex items-start gap-4">
              <StepBadge number={1} />
              <div>
                <p className="text-lg font-extrabold leading-relaxed">
                  1. 키보드에서 윈도우 로고 키 + R을 같이 누른 후, 나오는 창에 cmd를 적고 엔터를 쳐주세요.
                </p>
                <p className="mt-3 text-base text-slate-300">화면에 검은색 창이 하나 뜨실 거예요!</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 md:p-5">
            <div className="flex items-start gap-4">
              <StepBadge number={2} />
              <div className="w-full">
                <p className="text-lg font-extrabold leading-relaxed">2. 아래 파란색 버튼을 눌러 명령어를 복사해 주세요.</p>
                <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-cyan-200">
                  {wmiScanCommand}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="mt-4 w-full rounded-2xl bg-cyan-500 px-5 py-4 text-lg font-black text-slate-950 transition hover:bg-cyan-400"
                >
                  내용 복사하기 📋
                </button>
                {copyDone ? <p className="mt-3 text-base font-semibold text-emerald-300">복사 완료!</p> : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 md:p-5 md:col-span-2">
            <div className="flex items-start gap-4">
              <StepBadge number={3} />
              <div>
                <p className="text-lg font-extrabold leading-relaxed">
                  3. 방금 켠 검은색 창에 마우스 우클릭을 하거나 Ctrl + V를 눌러 붙여넣고 엔터를 치세요.
                </p>
                <p className="mt-3 text-base text-slate-300">
                  그 다음, 검은 창에 나온 결과 글자들을 마우스로 싹 긁어서 복사(Ctrl + C)해 주세요.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 md:p-5 md:col-span-2">
            <div className="flex items-start gap-4">
              <StepBadge number={4} />
              <div className="w-full">
                <p className="text-lg font-extrabold leading-relaxed">4. 복사한 글자들을 아래 박스에 붙여넣어 주세요!</p>
                <textarea
                  ref={textareaRef}
                  value={scanText}
                  onChange={(event) => setScanText(event.target.value)}
                  placeholder="여기에 검은 창 결과 글자들을 붙여넣어 주세요 (Ctrl + V)"
                  className={`mt-4 h-48 w-full rounded-2xl border bg-slate-950 px-4 py-4 text-base text-slate-100 placeholder:text-slate-500 ${
                    parseError ? "border-rose-500 ring-2 ring-rose-500/50" : "border-slate-700"
                  }`}
                />
                {parseError ? (
                  <p className="mt-2 text-sm font-semibold text-rose-300">
                    CPU/GPU를 인식하지 못했어요. 결과 텍스트를 다시 확인하거나 아래 &apos;내 PC 직접 입력&apos;에서 수동으로 선택해 주세요.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleParseAndApply}
          className="mt-7 w-full rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-cyan-500 px-6 py-4 text-xl font-black text-slate-950 transition hover:brightness-110"
        >
          ✨ 내 컴퓨터 성능 확인하기
        </button>

        <p className="mt-3 text-center text-sm text-slate-400">
          버튼을 누르면 CPU, GPU, 메인보드, RAM, SSD를 자동 인식해서 한 번에 세팅합니다.
        </p>
      </div>
    </div>
  );
}
