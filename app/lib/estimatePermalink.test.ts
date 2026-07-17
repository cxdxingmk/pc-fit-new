import { describe, expect, it } from "vitest";
import { buildPerformanceSpec } from "./estimatePermalink";
import { encodeSpec, decodeSpec } from "./specPermalink";

describe("buildPerformanceSpec", () => {
  const item = {
    partIds: {
      cpu: "i5-14600kf",
      gpu: "rx7600",
      ram: "64-ddr5-6400",
      ssd: "sn770-1tb",
      motherboard: "z790-tuf-gaming",
      psuWattage: 750,
    },
  };

  it("견적의 partIds를 /my-pc?spec= 퍼머링크 payload로 그대로 옮긴다", () => {
    const spec = buildPerformanceSpec(item);

    expect(spec.c).toBe("i5-14600kf");
    expect(spec.g).toBe("rx7600");
    expect(spec.r).toBe("64-ddr5-6400");
    expect(spec.s).toBe("sn770-1tb");
    expect(spec.m).toBe("z790-tuf-gaming");
    expect(spec.p).toBe("750W");
  });

  it("/my-pc가 읽는 방식대로 encodeSpec → decodeSpec 왕복해도 부품 id가 그대로 보존된다", () => {
    const spec = buildPerformanceSpec(item);
    const decoded = decodeSpec(encodeSpec(spec));

    expect(decoded).not.toBeNull();
    expect(decoded).toEqual(spec);
  });
});
