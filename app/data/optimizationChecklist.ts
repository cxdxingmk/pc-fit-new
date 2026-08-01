/**
 * "설치 없이" 최적화 가이드 — Windows 설정 체크리스트 + 드라이버/업데이트 확인 안내.
 *
 * 둘 다 사용자 PC 사양과 무관한 공통 콘텐츠지만, 드라이버 확인 안내는 GPU 브랜드(NVIDIA/AMD/Intel)에
 * 따라 실제 프로그램 이름·경로가 달라져서 순수 정적 텍스트로는 부족하다 — appliesTo로 브랜드별
 * 항목을 걸러내고, 없으면(appliesTo 생략) 모든 브랜드 공통 항목으로 취급한다.
 */
import type { GPU } from "../database/gpu";

export type GpuBrand = GPU["brand"];

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  howTo: string[];
}

export interface DriverUpdateItem {
  id: string;
  title: string;
  description: string;
  howTo: string[];
  /** 생략하면 브랜드 무관 공통 항목 */
  appliesTo?: GpuBrand[];
}

export const WINDOWS_CHECKLIST: ChecklistItem[] = [
  {
    id: "power-plan",
    title: "전원 옵션을 '최고의 성능'으로",
    description: "기본값인 균형 모드는 배터리·발열을 아끼려고 CPU 클럭을 일부러 낮춰요. 데스크탑이라면 굳이 아낄 필요가 없어요.",
    howTo: [
      "시작 버튼 우클릭 → 전원 옵션",
      "추가 전원 설정 → '고성능' 또는 '최고의 성능' 선택 (안 보이면 '전원 관리 옵션 만들기'에서 고성능 기준으로 생성)",
    ],
  },
  {
    id: "startup-apps",
    title: "시작프로그램 정리",
    description: "부팅할 때마다 자동 실행되는 프로그램이 많을수록 메모리·CPU를 배경에서 계속 갉아먹어요.",
    howTo: ["Ctrl+Shift+Esc로 작업 관리자 열기", "'시작 앱' 탭 이동", "게임/작업 중 필요 없는 항목(메신저, 클라우드 동기화 등)을 '사용 안 함'으로 변경"],
  },
  {
    id: "visual-effects",
    title: "시각 효과 끄기",
    description: "창 애니메이션, 그림자, 투명 효과 같은 꾸밈 요소가 저사양 PC에서는 체감 반응속도를 갉아먹어요.",
    howTo: ["시작 메뉴에서 'sysdm.cpl' 검색 후 실행", "고급 탭 → 성능 '설정' → '최적 성능으로 조정' 선택 (또는 필요한 효과만 남기고 나머지 체크 해제)"],
  },
  {
    id: "game-mode",
    title: "Windows 게임 모드 켜기",
    description: "게임 실행 중 백그라운드 작업(업데이트, 알림)을 자동으로 뒤로 미뤄줘요.",
    howTo: ["설정 → 게임 → 게임 모드", "게임 모드를 켜짐으로 설정"],
  },
  {
    id: "background-apps",
    title: "불필요한 백그라운드 앱 끄기",
    description: "화면에 안 보여도 계속 돌아가며 메모리·네트워크를 쓰는 앱들이 있어요.",
    howTo: ["설정 → 앱 → 설치된 앱", "안 쓰는 앱은 삭제하거나, 설정 → 개인정보 및 보안 → 백그라운드 앱에서 실행 권한을 꺼주세요"],
  },
  {
    id: "graphics-performance",
    title: "그래픽 성능 기본 설정을 '고성능'으로",
    description: "노트북이나 내장그래픽이 같이 있는 PC는 게임이 저전력 그래픽으로 실행되는 경우가 있어요.",
    howTo: ["설정 → 시스템 → 디스플레이 → 그래픽", "게임 실행 파일을 추가하고 옵션에서 '고성능'으로 지정"],
  },
  {
    id: "storage-space",
    title: "저장 공간 여유 확보",
    description: "SSD 여유 공간이 너무 적으면(특히 10% 미만) 시스템 전반이 느려질 수 있어요.",
    howTo: ["설정 → 시스템 → 저장소에서 여유 용량 확인", "'저장소 센스' 켜서 임시 파일을 자동 정리"],
  },
];

export const DRIVER_UPDATE_GUIDE: DriverUpdateItem[] = [
  {
    id: "gpu-driver-nvidia",
    title: "NVIDIA 그래픽 드라이버 최신 버전 확인",
    description: "새 드라이버는 최신 게임 최적화와 버그 수정을 포함하는 경우가 많아요.",
    howTo: ["NVIDIA 앱(또는 GeForce Experience) 실행", "드라이버 탭에서 업데이트 확인 후 설치", "설치 후 재부팅"],
    appliesTo: ["NVIDIA"],
  },
  {
    id: "gpu-driver-amd",
    title: "AMD 그래픽 드라이버 최신 버전 확인",
    description: "AMD Software: Adrenalin Edition에서 드라이버 업데이트와 게임별 최적화 프로필을 함께 제공해요.",
    howTo: ["AMD Software: Adrenalin Edition 실행 (없으면 AMD 공식 사이트에서 설치)", "홈 화면에서 업데이트 알림 확인 후 설치", "설치 후 재부팅"],
    appliesTo: ["AMD"],
  },
  {
    id: "gpu-driver-intel",
    title: "Intel 그래픽 드라이버 최신 버전 확인",
    description: "Intel Arc Control(또는 Intel 드라이버 & 지원 지원 도구)에서 최신 드라이버를 확인할 수 있어요.",
    howTo: ["Intel Arc Control 또는 Intel Driver & Support Assistant 실행 (없으면 Intel 공식 사이트에서 설치)", "업데이트 확인 후 설치", "설치 후 재부팅"],
    appliesTo: ["Intel"],
  },
  {
    id: "windows-update",
    title: "Windows 업데이트 확인",
    description: "보안 패치뿐 아니라 성능 관련 수정도 Windows 업데이트로 들어오는 경우가 있어요.",
    howTo: ["설정 → Windows Update", "'업데이트 확인' 클릭 → 있으면 설치 후 재부팅"],
  },
  {
    id: "chipset-driver",
    title: "메인보드 칩셋 드라이버 확인",
    description: "칩셋 드라이버가 오래되면 CPU·메모리·USB 성능이 제대로 안 나올 수 있어요.",
    howTo: ["메인보드 제조사 공식 사이트 접속 (예: ASUS, GIGABYTE, MSI, ASRock)", "내 메인보드 모델명으로 지원 페이지 검색", "칩셋 드라이버 최신 버전 다운로드 후 설치"],
  },
];

export function filterDriverUpdateGuide(brand: GpuBrand): DriverUpdateItem[] {
  return DRIVER_UPDATE_GUIDE.filter((item) => !item.appliesTo || item.appliesTo.includes(brand));
}
