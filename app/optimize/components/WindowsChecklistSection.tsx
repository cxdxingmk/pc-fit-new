import { WINDOWS_CHECKLIST } from "@/app/data/optimizationChecklist";
import { SectionCard } from "@/app/components/pcfit-ui";

export default function WindowsChecklistSection() {
  return (
    <SectionCard className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-white">Windows 설정 최적화 체크리스트</h2>
        <p className="mt-1 text-sm text-white/50">설치 없이 지금 바로 적용할 수 있는 설정들이에요. 사양과 무관하게 누구에게나 도움이 돼요.</p>
      </div>

      <ol className="flex flex-col gap-4">
        {WINDOWS_CHECKLIST.map((item, index) => (
          <li key={item.id} className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-line">
            <p className="text-sm font-bold text-white">
              {index + 1}. {item.title}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-white/55">{item.description}</p>
            <ul className="mt-3 flex flex-col gap-1">
              {item.howTo.map((step, i) => (
                <li key={i} className="text-[13px] leading-relaxed text-white/70">
                  · {step}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
