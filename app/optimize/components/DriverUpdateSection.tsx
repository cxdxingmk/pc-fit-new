import { filterDriverUpdateGuide, type GpuBrand } from "@/app/data/optimizationChecklist";
import { SectionCard } from "@/app/components/pcfit-ui";

export default function DriverUpdateSection({ gpuBrand }: { gpuBrand: GpuBrand }) {
  const items = filterDriverUpdateGuide(gpuBrand);

  return (
    <SectionCard className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-white">드라이버 · 업데이트 확인</h2>
        <p className="mt-1 text-sm text-white/50">직접 설치까지 해드리진 못하지만, 확인하는 방법을 알려드려요.</p>
      </div>

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-line">
            <p className="text-sm font-bold text-white">{item.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-white/55">{item.description}</p>
            <ol className="mt-3 flex flex-col gap-1">
              {item.howTo.map((step, i) => (
                <li key={i} className="text-[13px] leading-relaxed text-white/70">
                  {i + 1}. {step}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
