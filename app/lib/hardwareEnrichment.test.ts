import { describe, expect, it } from "vitest";
import { inferCpuCompatFields, inferGpuCompatFields, slugifyHardwareModel } from "./hardwareEnrichment";

describe("inferCpuCompatFields", () => {
  it("infers AM4/DDR4 for Zen2/Zen3-era Ryzen (3000/5000 series)", () => {
    const zen2 = inferCpuCompatFields("AMD Ryzen 5 3600X", 6);
    expect(zen2.socket).toBe("AM4");
    expect(zen2.ddr).toBe("DDR4");
    expect(zen2.unsupportedSocket).toBe(false);

    const zen3 = inferCpuCompatFields("AMD Ryzen 5 5600X", 6);
    expect(zen3.socket).toBe("AM4");
    expect(zen3.ddr).toBe("DDR4");
  });

  it("infers AM5/DDR5/PCIe5.0 for Zen4/Zen5 Ryzen (7000/9000 series)", () => {
    const zen4 = inferCpuCompatFields("AMD Ryzen 7 7700X", 8);
    expect(zen4.socket).toBe("AM5");
    expect(zen4.ddr).toBe("DDR5");
    expect(zen4.pcie).toBe("5.0");
    expect(zen4.igpu).toBe(true);
  });

  it("flags Threadripper as an unsupported socket (no matching motherboard catalog entry exists)", () => {
    const tr = inferCpuCompatFields("AMD Ryzen Threadripper 3970X", 32);
    expect(tr.unsupportedSocket).toBe(true);

    const trPro = inferCpuCompatFields("AMD Ryzen Threadripper PRO 5975WX", 32);
    expect(trPro.unsupportedSocket).toBe(true);
    expect(trPro.socket).toBe("sWRX8");
  });

  it("infers LGA1700/DDR5/PCIe5.0 for 12th-14th gen Intel desktop CPUs", () => {
    const result = inferCpuCompatFields("Intel Core i5-13400", 10);
    expect(result.socket).toBe("LGA1700");
    expect(result.ddr).toBe("DDR5");
    expect(result.pcie).toBe("5.0");
  });

  it("marks F-suffix Intel CPUs as having no integrated GPU", () => {
    const withIgpu = inferCpuCompatFields("Intel Core i5-13400", 10);
    const noIgpu = inferCpuCompatFields("Intel Core i5-13400F", 10);
    expect(withIgpu.igpu).toBe(true);
    expect(noIgpu.igpu).toBe(false);
  });

  it("infers LGA1851/DDR5 for Core Ultra CPUs", () => {
    const result = inferCpuCompatFields("Intel Core Ultra 7 265K", 20);
    expect(result.socket).toBe("LGA1851");
    expect(result.ddr).toBe("DDR5");
  });
});

describe("inferGpuCompatFields", () => {
  it("does not misclassify 3-digit legacy RX 500-series cards as RX 5000-series (regex-prefix regression)", () => {
    const legacy = inferGpuCompatFields("AMD Radeon RX 550", "AMD", 512, 2);
    const rdna1 = inferGpuCompatFields("AMD Radeon RX 5600 XT", "AMD", 2304, 6);

    expect(legacy.pcie).toBe("3.0");
    expect(legacy.memoryType).toBe("GDDR5");
    expect(rdna1.pcie).toBe("4.0");
    expect(rdna1.memoryType).toBe("GDDR6");
  });

  it("gives the RX 7900 tier PCIe 5.0 while the rest of RX 7000 stays at PCIe 4.0", () => {
    const rx7600 = inferGpuCompatFields("AMD Radeon RX 7600", "AMD", 2048, 8);
    const rx7900 = inferGpuCompatFields("AMD Radeon RX 7900 XTX", "AMD", 6144, 24);

    expect(rx7600.pcie).toBe("4.0");
    expect(rx7900.pcie).toBe("5.0");
  });

  it("marks NVIDIA RTX 20-series and up as ray-tracing/DLSS capable, GTX as not", () => {
    const gtx = inferGpuCompatFields("NVIDIA GeForce GTX 1660", "NVIDIA", 1408, 6);
    const rtx = inferGpuCompatFields("NVIDIA GeForce RTX 3070", "NVIDIA", 5888, 8);

    expect(gtx.dlss).toBe(false);
    expect(gtx.rayTracing).toBe(false);
    expect(rtx.dlss).toBe(true);
    expect(rtx.rayTracing).toBe(true);
  });

  it("marks Intel Arc GPUs as XeSS-capable", () => {
    const arc = inferGpuCompatFields("Intel Arc A750", "Intel", 3584, 8);
    expect(arc.xess).toBe(true);
  });
});

describe("slugifyHardwareModel", () => {
  it("produces stable, collision-free ids for known brand/lineup prefixes", () => {
    expect(slugifyHardwareModel("AMD Ryzen 5 3600X")).toBe("r5-3600x");
    expect(slugifyHardwareModel("Intel Core i5-13400")).toBe("i5-13400");
    expect(slugifyHardwareModel("NVIDIA GeForce RTX 4070 SUPER")).toBe("rtx-4070-super");
    expect(slugifyHardwareModel("AMD Radeon RX 6600 XT")).toBe("rx-6600-xt");
  });
});
