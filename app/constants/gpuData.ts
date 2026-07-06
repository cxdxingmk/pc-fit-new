export type GpuBrandOption = "NVIDIA" | "AMD" | "Intel";

export type GpuModelOption = {
  id: string;
  name: string;
  releaseDate: string;
};

const gpuModelsByBrandRaw: Record<GpuBrandOption, readonly GpuModelOption[]> = {
  NVIDIA: [
    { id: "rtx-5070-ti", name: "GeForce RTX 5070 Ti", releaseDate: "2025-02-20" },
    { id: "rtx-5070", name: "GeForce RTX 5070", releaseDate: "2025-01-30" },
    { id: "rtx-4070-super", name: "GeForce RTX 4070 SUPER", releaseDate: "2024-01-17" },
    { id: "rtx-4060", name: "GeForce RTX 4060", releaseDate: "2023-06-29" },
    { id: "rtx-3060", name: "GeForce RTX 3060", releaseDate: "2021-02-25" },
  ],
  AMD: [
    { id: "rx-9070-xt", name: "Radeon RX 9070 XT", releaseDate: "2025-03-15" },
    { id: "rx-9070", name: "Radeon RX 9070", releaseDate: "2025-03-15" },
    { id: "rx-7900-gre", name: "Radeon RX 7900 GRE", releaseDate: "2024-02-27" },
    { id: "rx-7800-xt", name: "Radeon RX 7800 XT", releaseDate: "2023-09-06" },
    { id: "rx-7600", name: "Radeon RX 7600", releaseDate: "2023-05-25" },
  ],
  Intel: [
    { id: "arc-b580", name: "Intel Arc B580", releaseDate: "2024-12-10" },
    { id: "arc-a770", name: "Intel Arc A770", releaseDate: "2022-10-12" },
    { id: "arc-a750", name: "Intel Arc A750", releaseDate: "2022-10-12" },
  ],
};

export const gpuBrandOptions = Object.keys(gpuModelsByBrandRaw) as GpuBrandOption[];

export function getGpuModelsByBrand(brand: GpuBrandOption): GpuModelOption[] {
  return [...gpuModelsByBrandRaw[brand]].sort(
    (a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
  );
}
