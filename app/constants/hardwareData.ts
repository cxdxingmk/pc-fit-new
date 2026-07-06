type BrandKeywordMapping = {
  brand: string;
  keywords: readonly string[];
};

const ramBrandKeywordMappings: readonly BrandKeywordMapping[] = [
  { brand: "Samsung", keywords: ["시금치", "samsung", "삼성", "ddr5", "ddr4"] },
  { brand: "SK hynix", keywords: ["하이닉스", "hynix", "sk", "a-die", "m-die"] },
  { brand: "Micron", keywords: ["micron", "마이크론", "crucial", "크루셜", "ballistix"] },
  { brand: "Corsair", keywords: ["corsair", "커세어", "vengeance", "dominator"] },
  { brand: "Kingston", keywords: ["kingston", "킹스톤", "fury"] },
];

const ssdBrandKeywordMappings: readonly BrandKeywordMapping[] = [
  { brand: "Samsung", keywords: ["970 evo", "980 pro", "990 pro", "samsung", "삼성"] },
  { brand: "Seagate", keywords: ["firecuda", "씨게이트", "seagate", "barraCuda", "바라쿠다"] },
  { brand: "WD", keywords: ["wd", "western digital", "sn850", "black sn", "블루 sn"] },
  { brand: "SK hynix", keywords: ["p31", "p41", "hynix", "하이닉스"] },
  { brand: "Crucial", keywords: ["crucial", "크루셜", "mx500", "p3", "p5"] },
];

function inferBrandByModelName(modelName: string, mappings: readonly BrandKeywordMapping[]): string {
  const normalized = modelName.trim().toLowerCase();
  if (!normalized) return "";

  const hit = mappings.find((mapping) =>
    mapping.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  );

  return hit?.brand ?? "";
}

export function inferRamBrandFromModelName(modelName: string): string {
  return inferBrandByModelName(modelName, ramBrandKeywordMappings);
}

export function inferSsdBrandFromModelName(modelName: string): string {
  return inferBrandByModelName(modelName, ssdBrandKeywordMappings);
}
