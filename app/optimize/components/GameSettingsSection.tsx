import type { DisplayMatchRow } from "@/app/lib/displayMatch";
import type { GPU } from "@/app/database/gpu";
import { recommendGraphicsPreset } from "@/app/lib/graphicsPresetAdvisor";
import { SectionCard, TierBadge } from "@/app/components/pcfit-ui";

export default function GameSettingsSection({ rows, gpu }: { rows: DisplayMatchRow[]; gpu: GPU }) {
  if (rows.length === 0) return null;

  return (
    <SectionCard className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-white">게임별 그래픽 옵션 추천</h2>
        <p className="mt-1 text-sm text-white/50">지금 사양·모니터 기준으로 어떤 옵션이 적당한지 알려드려요.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {rows.map((row) => {
          const advice = recommendGraphicsPreset(row, gpu);
          return (
            <article key={row.label} className="flex flex-col gap-2 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-line">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-bold text-white">{row.label}</h3>
                <TierBadge tier={row.status} />
              </div>
              <p className="text-sm font-semibold text-brand-soft">추천 옵션: {advice.presetLabel}</p>
              <p className="text-[13px] leading-relaxed text-white/60">{advice.note}</p>
              {advice.resolutionAdvice && <p className="text-[13px] leading-relaxed text-warn">{advice.resolutionAdvice}</p>}
              {advice.upscalingAdvice && <p className="text-[13px] leading-relaxed text-white/60">{advice.upscalingAdvice}</p>}
            </article>
          );
        })}
      </div>
    </SectionCard>
  );
}
