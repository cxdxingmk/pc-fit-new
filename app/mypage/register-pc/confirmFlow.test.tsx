import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { AuthUser } from "../../context/AuthContext";
import { BuildProvider } from "../../context/BuildContext";
import RegisterPcPage from "./page";

/**
 * E: CMD 자동 등록의 "이 사양으로 등록할까요?" 확인 플로우 회귀 테스트.
 * (6) 예 + 로그인 상태 → pc_specs 저장, (7) 예 + 비로그인 상태 → 로그인 유도 + 값 보존,
 * (8) 아니요 → DB 미저장 + 화면 상태만 반영 + 안내 문구 노출을 검증한다.
 * GpuAutoDetect(WebGL 의존)는 jsdom에서 의미가 없어 즉시 확정 GPU를 콜백하는 스텁으로 대체한다.
 */

const routerPushMock = vi.fn();
const upsertSavedPcSpecMock = vi.fn(async (_input: unknown) => ({ error: null as string | null }));
const getSavedPcSpecMock = vi.fn(async () => null);
const savePendingScanSpecMock = vi.fn((_input: unknown) => {});
const readPendingScanSpecMock = vi.fn(() => null as unknown);
const clearPendingScanSpecMock = vi.fn();

let mockUser: AuthUser | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock, replace: vi.fn() }),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, isLoading: false, logout: vi.fn() }),
}));

vi.mock("../../lib/pcSpecs", async () => {
  const actual = await vi.importActual<typeof import("../../lib/pcSpecs")>("../../lib/pcSpecs");
  return {
    ...actual,
    getSavedPcSpec: () => getSavedPcSpecMock(),
    upsertSavedPcSpec: (input: unknown) => upsertSavedPcSpecMock(input),
  };
});

vi.mock("../../lib/pendingScanSpec", () => ({
  savePendingScanSpec: (input: unknown) => savePendingScanSpecMock(input),
  readPendingScanSpec: () => readPendingScanSpecMock(),
  clearPendingScanSpec: () => clearPendingScanSpecMock(),
}));

vi.mock("../../../components/GpuAutoDetect", () => ({
  default: ({ onGpuSelected }: { onGpuSelected: (gpuId: string, rawGpu: string | null) => void }) => {
    onGpuSelected("gtx1660super", "NVIDIA GeForce GTX 1660 SUPER");
    return null;
  },
}));

const CPU_RAM_SSD_SAMPLE =
  "CPU:\nAMD Ryzen 5 5600 6-Core Processor\n\nSSD:\nSamsung SSD 970 EVO Plus 500GB\n\nRAM:\nTotal 32 GB (16GB x 2ea / DDR4 3200MHz / Samsung)";

function renderPage() {
  return render(
    <BuildProvider>
      <RegisterPcPage />
    </BuildProvider>
  );
}

async function pasteAndParse() {
  const textarea = screen.getByLabelText("PowerShell/CMD 결과 붙여넣기") as HTMLTextAreaElement;
  fireEvent.change(textarea, { target: { value: CPU_RAM_SSD_SAMPLE } });
  fireEvent.click(screen.getByRole("button", { name: "사양 확인하기" }));
  await waitFor(() => expect(screen.getByText("이 사양으로 내 PC 등록할까요?")).toBeTruthy());
}

describe("register-pc 확인 플로우", () => {
  beforeEach(() => {
    mockUser = null;
    routerPushMock.mockClear();
    upsertSavedPcSpecMock.mockClear();
    getSavedPcSpecMock.mockClear();
    savePendingScanSpecMock.mockClear();
    readPendingScanSpecMock.mockReturnValue(null);
    clearPendingScanSpecMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("(6) 예 선택 + 로그인 상태 → pc_specs에 upsert되고 저장 완료 메시지가 뜬다", async () => {
    mockUser = { id: "user-1", email: "test@example.com", name: "테스트유저", isAdmin: false };
    renderPage();
    await pasteAndParse();

    fireEvent.click(screen.getByRole("button", { name: "예, 등록할게요" }));

    await waitFor(() => expect(upsertSavedPcSpecMock).toHaveBeenCalledTimes(1));
    const savedInput = upsertSavedPcSpecMock.mock.calls[0][0] as { cpuId: string; ssdCapacity: string };
    expect(savedInput.cpuId).toBe("r5-5600");
    expect(savedInput.ssdCapacity).toBe("512GB");
    expect(await screen.findByText("내 PC로 등록됐어요.")).toBeTruthy();
    expect(routerPushMock).not.toHaveBeenCalledWith("/login");
  });

  it("(7) 예 선택 + 비로그인 상태 → DB에는 저장하지 않고, 값을 세션에 보관한 뒤 로그인으로 이동한다", async () => {
    mockUser = null;
    renderPage();
    await pasteAndParse();

    fireEvent.click(screen.getByRole("button", { name: "예, 등록할게요" }));

    await waitFor(() => expect(routerPushMock).toHaveBeenCalledWith("/login"));
    expect(upsertSavedPcSpecMock).not.toHaveBeenCalled();
    expect(savePendingScanSpecMock).toHaveBeenCalledTimes(1);
    const preserved = savePendingScanSpecMock.mock.calls[0][0] as { cpuId: string };
    expect(preserved.cpuId).toBe("r5-5600");
  });

  it("(8) 아니요 선택 → DB에는 저장하지 않고, 화면에만 반영되며 미저장 안내 문구가 뜬다", async () => {
    mockUser = { id: "user-1", email: "test@example.com", name: "테스트유저", isAdmin: false };
    renderPage();
    await pasteAndParse();

    fireEvent.click(screen.getByRole("button", { name: "아니요, 이번만 볼게요" }));

    expect(upsertSavedPcSpecMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("이번 사양은 저장되지 않아요. 지금 화면에서만 확인할 수 있어요 — 새로고침하거나 페이지를 벗어나면 사라져요.")
    ).toBeTruthy();
  });

  it("로그인 후 대기 중이던 값이 있으면 마운트 시 자동으로 이어서 저장한다", async () => {
    mockUser = { id: "user-1", email: "test@example.com", name: "테스트유저", isAdmin: false };
    readPendingScanSpecMock.mockReturnValue({
      cpuId: "r5-5600",
      gpuId: "gtx1660super",
      ramCapacity: "32GB",
      ramCount: 2,
      ramDetailedInputEnabled: false,
      ramProductName: "",
      ssdCapacity: "512GB",
      ssdDetailedInputEnabled: false,
      ssdProductName: "",
      mbSeries: "",
      mbDetail: "",
      mbBrand: "",
      psuWatt: "",
      hasCase: true,
      monitorResolution: "QHD",
      monitorRefreshRate: 144,
      monitorCount: 1,
      commandScanRawText: "",
    });

    renderPage();

    await waitFor(() => expect(upsertSavedPcSpecMock).toHaveBeenCalledTimes(1));
    expect(clearPendingScanSpecMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("로그인 완료! 이전에 스캔한 사양이 자동으로 등록됐어요.")).toBeTruthy();
  });
});

describe("모니터 주사율 선택 UI", () => {
  beforeEach(() => {
    mockUser = { id: "user-1", email: "test@example.com", name: "테스트유저", isAdmin: false };
    readPendingScanSpecMock.mockReturnValue(null);
    upsertSavedPcSpecMock.mockClear();
  });
  afterEach(() => cleanup());

  it("1씩 증감하던 number 입력이 아니라 select로 렌더된다", () => {
    renderPage();
    const field = screen.getByLabelText("모니터 주사율(Hz)");
    expect(field.tagName).toBe("SELECT");
    // 예전 스피너 속성이 남아있지 않아야 한다.
    expect(field.getAttribute("step")).toBeNull();
    expect(field.getAttribute("type")).toBeNull();
  });

  it("표준 규격 단계 11개만, Hz 단위를 붙여 순서대로 노출한다", () => {
    renderPage();
    const select = screen.getByLabelText("모니터 주사율(Hz)") as HTMLSelectElement;
    const labels = Array.from(select.options).map((option) => option.textContent);

    expect(labels).toEqual(["60Hz", "75Hz", "100Hz", "120Hz", "144Hz", "165Hz", "180Hz", "240Hz", "360Hz", "480Hz", "540Hz"]);
  });

  it("144에서 다음 단계를 고르면 145가 아니라 165가 선택된다", () => {
    renderPage();
    const select = screen.getByLabelText("모니터 주사율(Hz)") as HTMLSelectElement;
    expect(select.value).toBe("144"); // 기본값

    const values = Array.from(select.options).map((option) => option.value);
    const next = values[values.indexOf("144") + 1];
    fireEvent.change(select, { target: { value: next } });

    expect(select.value).toBe("165");
  });

  it("예전 자유 입력으로 저장된 비표준 값(200Hz)을 불러와도 빈칸이 아니라 가장 가까운 단계(180Hz)로 표시된다", async () => {
    getSavedPcSpecMock.mockResolvedValueOnce({
      id: "pc_spec",
      cpuId: "r5-5600",
      gpuId: "gtx1660super",
      ramCapacity: "16GB",
      ramCount: 2,
      ramDetailedInputEnabled: false,
      ramProductName: "",
      ssdCapacity: "1TB",
      ssdDetailedInputEnabled: false,
      ssdProductName: "",
      mbBrand: "",
      mbSeries: "",
      mbDetail: "",
      psuWatt: "",
      hasCase: true,
      monitorResolution: "QHD",
      monitorRefreshRate: 200, // 표준 단계가 아님
      monitorCount: 1,
      commandScanRawText: "",
    } as never);

    renderPage();

    const select = screen.getByLabelText("모니터 주사율(Hz)") as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe("180"));
  });
});
