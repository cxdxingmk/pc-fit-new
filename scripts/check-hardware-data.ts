type ReleaseYearItem = {
  releaseYear: number;
};

type HardwarePresetsShape = {
  cpus: Record<string, ReleaseYearItem>;
  gpus: Record<string, ReleaseYearItem>;
  ram: Record<string, ReleaseYearItem>;
  ssd: Record<string, ReleaseYearItem>;
};

import { HARDWARE_MASTER_PRESETS } from "../src/constants/hardwareData";

const hardwarePresets = HARDWARE_MASTER_PRESETS as HardwarePresetsShape;

function getMaxReleaseYear(values: Array<{ releaseYear: number }>): number {
  if (values.length === 0) return 0;
  return Math.max(...values.map((item) => item.releaseYear));
}

const cpuList = Object.values(hardwarePresets.cpus);
const gpuList = Object.values(hardwarePresets.gpus);
const ramList = Object.values(hardwarePresets.ram);
const ssdList = Object.values(hardwarePresets.ssd);

const cpuCount = cpuList.length;
const gpuCount = gpuList.length;
const ramCount = ramList.length;
const ssdCount = ssdList.length;
const latestCpuReleaseYear = getMaxReleaseYear(cpuList);
const latestGpuReleaseYear = getMaxReleaseYear(gpuList);
const latestRamReleaseYear = getMaxReleaseYear(ramList);
const latestSsdReleaseYear = getMaxReleaseYear(ssdList);
const latestOverallReleaseYear = Math.max(latestCpuReleaseYear, latestGpuReleaseYear, latestRamReleaseYear, latestSsdReleaseYear);

console.log("[check:hardware-data] Hardware data summary");
console.log(`CPU count: ${cpuCount}`);
console.log(`GPU count: ${gpuCount}`);
console.log(`RAM count: ${ramCount}`);
console.log(`SSD count: ${ssdCount}`);
console.log(`Latest CPU release year: ${latestCpuReleaseYear}`);
console.log(`Latest GPU release year: ${latestGpuReleaseYear}`);
console.log(`Latest RAM release year: ${latestRamReleaseYear}`);
console.log(`Latest SSD release year: ${latestSsdReleaseYear}`);
console.log(`Latest overall release year: ${latestOverallReleaseYear}`);
