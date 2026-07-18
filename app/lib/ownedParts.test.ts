import { describe, expect, it } from "vitest";
import {
  resolveOwnedCpu,
  resolveOwnedGpu,
  resolveOwnedRam,
  resolveOwnedSsd,
  resolveOwnedMotherboard,
  resolveOwnedPsuWattage,
  resolveOwnedParts,
  buildOwnedPsuRepresentative,
} from "./ownedParts";
import { cpus } from "../database/cpu";
import { gpus } from "../database/gpu";
import { rams } from "../database/ram";
import { ssds } from "../database/ssd";
import { motherboards } from "../database/motherboard";
import { psus } from "../database/psu";
import type { ExistingPartsState } from "../types/build";

function baseExistingParts(): ExistingPartsState {
  return {
    CPU: { enabled: false, brand: "", model: "" },
    GPU: { enabled: false, brand: "", manufacturer: "", model: "" },
    RAM: { enabled: false, ddr: "", capacity: "", brand: "", model: "" },
    SSD: { enabled: false, capacity: "", brand: "", model: "" },
    HDD: { enabled: false, capacity: "" },
    Motherboard: { enabled: false, series: "", manufacturer: "", model: "" },
    Power: { enabled: false, wattage: "" },
  };
}

describe("resolveOwnedCpu", () => {
  it("체크 + 모델명이 카탈로그와 정확히 일치하면 그 CPU를 반환한다", () => {
    const resolved = resolveOwnedCpu({ enabled: true, brand: "AMD", model: "Ryzen 5 5600" }, cpus);
    expect(resolved?.id).toBe("r5-5600");
  });

  it("체크하지 않았으면(enabled=false) null이다 — 모델을 지정해놨어도 무시한다", () => {
    const resolved = resolveOwnedCpu({ enabled: false, brand: "AMD", model: "Ryzen 5 5600" }, cpus);
    expect(resolved).toBeNull();
  });

  it("모델을 아직 고르지 않았으면(model='') null이다", () => {
    const resolved = resolveOwnedCpu({ enabled: true, brand: "AMD", model: "" }, cpus);
    expect(resolved).toBeNull();
  });

  it("카탈로그에 없는 모델명이면 null이다", () => {
    const resolved = resolveOwnedCpu({ enabled: true, brand: "AMD", model: "존재하지않는CPU" }, cpus);
    expect(resolved).toBeNull();
  });
});

describe("resolveOwnedGpu", () => {
  it("체크 + 모델명이 일치하면 그 GPU를 반환한다", () => {
    const resolved = resolveOwnedGpu({ enabled: true, brand: "NVIDIA", manufacturer: "", model: "GeForce RTX 4070" }, gpus);
    expect(resolved?.name).toBe("GeForce RTX 4070");
  });
});

describe("resolveOwnedRam", () => {
  it("ddr+용량이 일치하는 카탈로그 항목을 찾는다", () => {
    const resolved = resolveOwnedRam({ enabled: true, ddr: "DDR5", capacity: "32GB", brand: "", model: "" }, rams);
    expect(resolved?.ddr).toBe("DDR5");
    expect(resolved?.capacity).toBe(32);
  });

  it("ddr 또는 용량이 비어 있으면 null이다", () => {
    expect(resolveOwnedRam({ enabled: true, ddr: "", capacity: "32GB", brand: "", model: "" }, rams)).toBeNull();
    expect(resolveOwnedRam({ enabled: true, ddr: "DDR5", capacity: "", brand: "", model: "" }, rams)).toBeNull();
  });
});

describe("resolveOwnedSsd", () => {
  it("정확히 일치하는 용량 항목을 찾는다", () => {
    const resolved = resolveOwnedSsd({ enabled: true, capacity: "1TB", brand: "", model: "" }, ssds);
    expect(resolved?.capacity).toBe(1000);
  });

  it("512GB는 이제 카탈로그에 정확히 있다 — recommender.ts의 SSD 512GB 고정 정책용 항목과 동일하다", () => {
    const resolved = resolveOwnedSsd({ enabled: true, capacity: "512GB", brand: "", model: "" }, ssds);
    expect(resolved?.capacity).toBe(512);
  });

  it("카탈로그에 정확한 용량이 없으면 그 이상인 가장 작은 항목으로 근사한다(합성 카탈로그로 검증)", () => {
    const sparseCatalog = ssds.filter((ssd) => ssd.capacity !== 512);
    const resolved = resolveOwnedSsd({ enabled: true, capacity: "512GB", brand: "", model: "" }, sparseCatalog);
    expect(resolved?.capacity).toBe(1000);
  });

  it("카탈로그 최대 용량을 넘는 요청(4TB 이상)은 카탈로그에서 가장 큰 항목으로 근사한다", () => {
    const resolved = resolveOwnedSsd({ enabled: true, capacity: "4TB 이상", brand: "", model: "" }, ssds);
    expect(resolved?.capacity).toBe(2000);
  });
});

describe("resolveOwnedMotherboard", () => {
  it("브랜드 시리즈('AMD B') + 세부 모델('650')을 합쳐 칩셋(B650)으로 매칭한다", () => {
    const resolved = resolveOwnedMotherboard({ enabled: true, series: "AMD B", manufacturer: "GIGABYTE", model: "650" }, motherboards);
    expect(resolved?.chipset).toBe("B650");
  });

  it("세부 모델을 아직 안 적었으면 null이다", () => {
    const resolved = resolveOwnedMotherboard({ enabled: true, series: "AMD B", manufacturer: "GIGABYTE", model: "" }, motherboards);
    expect(resolved).toBeNull();
  });
});

describe("resolveOwnedPsuWattage", () => {
  it("와트 표기에서 숫자만 뽑는다", () => {
    expect(resolveOwnedPsuWattage({ enabled: true, wattage: "750W" })).toBe(750);
    expect(resolveOwnedPsuWattage({ enabled: true, wattage: "1000W 이상" })).toBe(1000);
  });

  it("체크하지 않았으면 null이다", () => {
    expect(resolveOwnedPsuWattage({ enabled: false, wattage: "750W" })).toBeNull();
  });
});

describe("resolveOwnedParts — 통합", () => {
  it("아무것도 체크하지 않았으면 전부 null이다(기존 동작과 동일)", () => {
    const owned = resolveOwnedParts(baseExistingParts(), { cpus, gpus, rams, ssds, motherboards });
    expect(owned).toEqual({ cpu: null, gpu: null, ram: null, ssd: null, motherboard: null, psuWattage: null });
  });

  it("여러 부품을 동시에 체크하면 전부 함께 해석된다", () => {
    const existingParts = baseExistingParts();
    existingParts.CPU = { enabled: true, brand: "AMD", model: "Ryzen 5 5600" };
    existingParts.RAM = { enabled: true, ddr: "DDR4", capacity: "16GB", brand: "", model: "" };
    existingParts.Power = { enabled: true, wattage: "650W" };

    const owned = resolveOwnedParts(existingParts, { cpus, gpus, rams, ssds, motherboards });
    expect(owned.cpu?.id).toBe("r5-5600");
    expect(owned.ram?.ddr).toBe("DDR4");
    expect(owned.gpu).toBeNull();
    expect(owned.psuWattage).toBe(650);
  });
});

describe("buildOwnedPsuRepresentative", () => {
  it("지정한 와트수를 그대로 갖고, 가격은 0(이미 보유 중)이다", () => {
    const rep = buildOwnedPsuRepresentative(750, psus);
    expect(rep.wattage).toBe(750);
    expect(rep.price).toBe(0);
  });
});
