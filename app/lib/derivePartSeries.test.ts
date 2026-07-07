import { describe, expect, it } from "vitest";
import { calculateSeriesCoverage, derivePartSeries, UNKNOWN_SERIES } from "./derivePartSeries";
import { cpus } from "../database/cpu";
import { gpus } from "../database/gpu";

describe("derivePartSeries", () => {
  it("classifies representative AMD Ryzen CPU model names", () => {
    expect(derivePartSeries("Ryzen 7 7800X3D")).toBe("Ryzen 7");
    expect(derivePartSeries("Ryzen 5 5600X")).toBe("Ryzen 5");
    expect(derivePartSeries("Ryzen 9 9950X")).toBe("Ryzen 9");
    expect(derivePartSeries("Ryzen 3 3100")).toBe("Ryzen 3");
  });

  it("classifies representative Intel Core CPU model names", () => {
    expect(derivePartSeries("Core i5-13600K")).toBe("Core i5");
    expect(derivePartSeries("Core i9-14900K")).toBe("Core i9");
    expect(derivePartSeries("Core i3-12100")).toBe("Core i3");
    expect(derivePartSeries("Core Ultra 9 285K")).toBe("Core Ultra 9");
  });

  it("classifies representative NVIDIA GPU model names by generation", () => {
    expect(derivePartSeries("GeForce RTX 4070 SUPER")).toBe("RTX 40");
    expect(derivePartSeries("GeForce RTX 3060 Ti")).toBe("RTX 30");
    expect(derivePartSeries("GeForce RTX 5090")).toBe("RTX 50");
    expect(derivePartSeries("GeForce GTX 1660")).toBe("GTX 10");
  });

  it("classifies representative AMD Radeon GPU model names by generation", () => {
    expect(derivePartSeries("Radeon RX 6600 XT")).toBe("RX 6000");
    expect(derivePartSeries("Radeon RX 7900 XTX")).toBe("RX 7000");
    expect(derivePartSeries("Radeon RX 580")).toBe("RX 500");
  });

  it("classifies Intel Arc GPU model names", () => {
    expect(derivePartSeries("Intel Arc A750")).toBe("Arc A");
    expect(derivePartSeries("Intel Arc B580")).toBe("Arc B");
    expect(derivePartSeries("Intel Arc Pro B60")).toBe("Arc Pro B");
  });

  it("safely falls back to the 기타 bucket for unrecognized names instead of throwing", () => {
    expect(derivePartSeries("Some Unknown Chip 9000")).toBe(UNKNOWN_SERIES);
    expect(() => derivePartSeries("")).not.toThrow();
    expect(derivePartSeries("")).toBe(UNKNOWN_SERIES);
  });
});

describe("calculateSeriesCoverage against the real merged catalogs", () => {
  it("classifies the overwhelming majority of the real CPU catalog", () => {
    const { total, classified, ratio } = calculateSeriesCoverage(cpus.map((c) => c.name));
    console.log(`CPU series coverage: ${classified}/${total} (${(ratio * 100).toFixed(1)}%)`);
    expect(ratio).toBeGreaterThan(0.95);
  });

  it("classifies the overwhelming majority of the real GPU catalog", () => {
    const { total, classified, ratio } = calculateSeriesCoverage(gpus.map((g) => g.name));
    console.log(`GPU series coverage: ${classified}/${total} (${(ratio * 100).toFixed(1)}%)`);
    expect(ratio).toBeGreaterThan(0.85);
  });
});
