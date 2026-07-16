"use client";

import { useRouter } from "next/navigation";
import StageTransition from "@/components/ui/StageTransition";

const STAGES = ["그래픽카드 감지", "성능 매칭", "진단서 생성"];
const TOTAL_DURATION_MS = 1800;

export default function AnalyzePage() {
  const router = useRouter();

  return <StageTransition stages={STAGES} totalDurationMs={TOTAL_DURATION_MS} title="PC 진단서를 만들고 있어요" onComplete={() => router.replace("/my-pc")} />;
}
