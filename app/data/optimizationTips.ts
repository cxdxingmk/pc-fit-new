export interface OptimizationTipMap {
  Gaming: {
    NVIDIA: string[];
    AMD: string[];
  };
  Creator: {
    lowRam: string[];
    general: string[];
  };
  AI: string[];
}

export const OPTIMIZATION_TIPS: OptimizationTipMap = {
  Gaming: {
    NVIDIA: [
      "윈도우 게임 모드 활성화: 바탕화면 검색창에 '게임 모드' 검색 후 [켬]으로 변경 시 프레임 5% 상승",
      "NVIDIA 제어판 설정: 바탕화면 우클릭 -> NVIDIA 제어판 -> [디지털 바이브런스]를 60%~65%로 조정 시 게임 내 적 식별력 극대화",
      "그래픽 드라이버 최적화: GeForce Experience 앱을 통해 항상 최신 게임 레디 드라이버 상태를 유지하세요."
    ],
    AMD: [
      "윈도우 게임 모드 활성화: 시스템 설정에서 '게임 모드'를 반드시 [켬]으로 세팅하세요.",
      "AMD 아드레날린 설정: 라데온 소프트웨어에서 'Radeon Anti-Lag' 기능을 켜면 마우스 반응 속도가 빨라집니다."
    ]
  },
  Creator: {
    lowRam: [
      "가상 메모리(페이징 파일) 설정: RAM이 16GB 이하이므로, 윈도우 고급 시스템 설정에서 SSD 공간을 가상 메모리로 할당하면 렌더링 중 튕김 현상을 막을 수 있습니다.",
      "프리미어 프로 메모리 할당: [편집] -> [환경 설정] -> [메모리]에서 타 프로그램 보유 RAM을 최소화하고 프리미어 할당량을 극대화하세요."
    ],
    general: [
      "GPU 가속(CUDA) 활성화: 편집 프로그램 설정에서 머큐리 재생 엔진을 [GPU 가속]으로 변경하면 프리뷰 속도가 3배 빨라집니다.",
      "미디어 캐시 주기적 삭제: 프로젝트가 버벅일 때 캐시 파일을 전체 삭제하면 디스크 용량 확보와 함께 속도가 개선됩니다."
    ]
  },
  AI: [
    "CUDA 및 cuDNN 드라이버 설치: NVIDIA 그래픽카드의 AI 텐서 코어를 100% 활용하기 위해 전용 CUDA 툴킷 설치가 필수적입니다.",
    "xFormers 가속 활성화: Stable Diffusion 웹UI 사용 시 실행 인자에 '--xformers'를 추가하면 이미지 생성 속도가 30% 이상 향상됩니다."
  ]
};
