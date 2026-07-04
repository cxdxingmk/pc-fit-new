"use client";

import { useMemo, useState } from "react";
import { useBuild } from "../context/BuildContext";
import { recommend } from "../lib/recommender";

import PriceCard from "./components/PriceCard";
import ReasonCard from "./components/ReasonCard";
import CompatibilityCard from "./components/CompatibilityCard";

export default function ResultPage() {
  const { buildData } = useBuild();
  const [openDetailId, setOpenDetailId] = useState<string | null>(null);

  const topResults = useMemo(
    () => recommend(buildData.answers, buildData.existingParts, buildData.caseOwnership),
    [buildData.answers, buildData.existingParts, buildData.caseOwnership]
  );

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">AI 기반 견적 추천</p>
          <h1 className="mt-3 text-4xl font-bold text-slate-900 sm:text-5xl">
            TOP 3 완성형 PC 견적 세트
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600">
            보유 부품과 예산을 반영해 소켓·전력·메모리 규격까지 맞춘 완성형 세트를 제안합니다.
          </p>
        </div>

        {topResults.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-xl font-semibold text-slate-900">추천 결과가 없습니다.</p>
            <p className="mt-3 text-slate-600">빌드 단계를 완료한 후 다시 시도해 주세요.</p>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-3">
            {topResults.map((item, index) => {
              const isOpen = openDetailId === item.id;

              return (
                <div key={item.id} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">추천 #{index + 1}</p>
                      <h2 className="mt-2 text-xl font-bold text-slate-900">완성형 견적 세트</h2>
                    </div>
                    <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                      {item.finalScore.toFixed(1)}점
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-500">핵심 구성</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                      <li>CPU: {item.cpu}</li>
                      <li>GPU: {item.gpu}</li>
                      <li>RAM: {item.ram}</li>
                      <li>SSD: {item.ssd}</li>
                      <li>메인보드: {item.motherboard}</li>
                      <li>파워: {item.power}</li>
                      <li>케이스: {item.case}</li>
                    </ul>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 p-5">
                    <PriceCard totalPrice={item.totalPrice} />
                  </div>

                  <div className="mt-5">
                    <CompatibilityCard score={item.compatibilityScore} warnings={item.warnings} />
                  </div>

                  <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                    <ReasonCard reason={item.reason} />
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpenDetailId(isOpen ? null : item.id)}
                    className="mt-6 inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-700"
                  >
                    {isOpen ? "상세 스펙 접기" : "상세 스펙 보기"}
                  </button>

                  <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "mt-4 max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-sm font-semibold text-slate-600">부품별 세부 견적</p>
                      <ul className="mt-3 space-y-3 text-sm text-slate-700">
                        {item.parts.map((part) => (
                          <li key={part.label} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                            <div>
                              <p className="font-semibold text-slate-900">{part.label}</p>
                              <p className="text-xs text-slate-500">{part.name}</p>
                            </div>
                            <span className="text-sm font-semibold text-slate-700">
                              {part.price.toLocaleString()}원
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-sm font-semibold text-emerald-700">호환성 근거</p>
                        <ul className="mt-2 space-y-2 text-sm text-slate-700">
                          {item.compatibilityDetails.map((detail) => (
                            <li key={detail} className="rounded-xl bg-white px-3 py-2">{detail}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}