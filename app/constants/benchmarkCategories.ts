export type BenchmarkCategoryId =
  | "game"
  | "video-editing"
  | "ai-acceleration"
  | "architecture-3d-cad"
  | "development-programming";

export type BenchmarkCategory = {
  id: BenchmarkCategoryId;
  label: string;
  description: string;
  examples: readonly string[];
};

export const benchmarkCategories: readonly BenchmarkCategory[] = [
  {
    id: "game",
    label: "게임",
    description: "고프레임 게임 플레이와 그래픽 품질 중심",
    examples: ["Cyberpunk 2077", "Apex Legends", "Black Myth: Wukong"],
  },
  {
    id: "video-editing",
    label: "영상/편집",
    description: "편집 프리뷰, 이펙트, 렌더링 시간 중심",
    examples: ["Premiere Pro", "After Effects", "DaVinci Resolve"],
  },
  {
    id: "ai-acceleration",
    label: "AI 가속",
    description: "추론/학습 처리량과 VRAM 여유 중심",
    examples: ["Stable Diffusion", "LLM Inference", "TensorRT"],
  },
  {
    id: "architecture-3d-cad",
    label: "건축/3D/CAD",
    description: "3D 뷰포트 반응성과 렌더 성능 중심",
    examples: ["AutoCAD", "Blender", "Maya"],
  },
  {
    id: "development-programming",
    label: "개발/프로그래밍",
    description: "빌드/컴파일 및 개발 워크플로 처리 성능 중심",
    examples: ["Docker", "Large-scale compilation", "Game Engine Build"],
  },
] as const;

export const videoEditingSoftwareOptions = [
  "Premiere Pro",
  "After Effects",
  "DaVinci Resolve",
  "직접 입력",
] as const;
