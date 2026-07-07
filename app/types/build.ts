export type PurposeType =
  | "gaming"
  | "work"
  | "video"
  | "stream"
  | "ai"
  | "dev"
  | "cad"
  | "etc";

export type CpuBrand = "AMD" | "Intel";
export type GpuBrand = "NVIDIA" | "AMD" | "Intel";
export type RamDdr = "DDR4" | "DDR5";
export type RamCapacityOption = "8GB" | "16GB" | "32GB" | "64GB" | "128GB";
export type SsdCapacityOption = "512GB" | "1TB" | "2TB" | "4TB 이상";
export type HddCapacityOption = "1TB" | "2TB" | "4TB" | "8TB 이상";
export type MotherboardBrand = "ASUS" | "MSI" | "GIGABYTE" | "ASRock";
export type PsuWattageOption = "500W" | "600W" | "650W" | "700W" | "750W" | "800W" | "850W" | "1000W" | "1000W 이상";
export type CaseOwnershipOption = "owned" | "none";

export type CpuPartState = {
  enabled: boolean;
  brand: CpuBrand | "";
  model: string;
};

export type GpuPartState = {
  enabled: boolean;
  brand: GpuBrand | "";
  manufacturer: string;
  model: string;
};

export type RamPartState = {
  enabled: boolean;
  ddr: RamDdr | "";
  capacity: RamCapacityOption | "";
  brand: string;
  model: string;
};

export type SsdPartState = {
  enabled: boolean;
  capacity: SsdCapacityOption | "";
  brand: string;
  model: string;
};

export type HddPartState = {
  enabled: boolean;
  capacity: HddCapacityOption | "";
};

export type MotherboardPartState = {
  enabled: boolean;
  series: string;
  manufacturer: string;
  model: string;
};

export type PowerPartState = {
  enabled: boolean;
  wattage: PsuWattageOption | "";
};

export type ExistingPartsState = {
  CPU: CpuPartState;
  GPU: GpuPartState;
  RAM: RamPartState;
  SSD: SsdPartState;
  HDD: HddPartState;
  Motherboard: MotherboardPartState;
  Power: PowerPartState;
};

export type BuildInput = {
  answers: Record<number, string[]>;
  existingParts: ExistingPartsState;
  caseOwnership: CaseOwnershipOption;
};
