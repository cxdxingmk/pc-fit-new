/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import fs from "fs/promises";
import path from "path";

const inputDir = path.resolve(process.cwd(), "data/benchmarks-input");
const outDir = path.resolve(process.cwd(), "database/benchmarks");

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

function toExportName(base: string) {
  // cpu -> cpuBench
  return `${base}Bench`;
}

function tsSerialize(obj: any) {
  return JSON.stringify(obj, null, 2).replace(/"([a-zA-Z0-9_-]+)":/g, "$1:");
}

async function parseCsv(content: string) {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return {};
  const header = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1);
  const result: Record<string, any> = {};
  for (const row of rows) {
    const cols = row.split(",").map(c => c.trim());
    const id = cols[0];
    if (!id) continue;
    const obj: Record<string, any> = {};
    for (let i = 1; i < header.length; i++) {
      const key = header[i];
      const val = cols[i] ?? "";
      const num = Number(val);
      obj[key] = Number.isNaN(num) ? val : num;
    }
    result[id] = obj;
  }
  return result;
}

async function processFile(file: string) {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file, ext);
  const outName = toExportName(base);
  const inputPath = path.join(inputDir, file);
  const content = await fs.readFile(inputPath, "utf8");

  let parsed: Record<string, any> = {};
  if (ext === ".json") {
    parsed = await normalizeJson(JSON.parse(content), base);
  } else if (ext === ".csv") {
    parsed = await parseCsv(content);
  } else {
    console.warn("Skipping unsupported file:", file);
    return;
  }

  const outPath = path.join(outDir, `${outName}.ts`);
  const exportType = getExportType(base);
  const tsContent = `export const ${outName}: ${exportType} = ${JSON.stringify(parsed, null, 2)};\n`;
  await fs.writeFile(outPath, tsContent, "utf8");
  console.log("Wrote", outPath);
}

async function normalizeJson(raw: any, base: string) {
  if (Array.isArray(raw)) {
    const result: Record<string, any> = {};
    for (const entry of raw) {
      if (entry && typeof entry === "object") {
        const id = String(entry.id ?? entry.name ?? entry.model ?? entry.key ?? "").trim();
        if (!id) continue;
        result[id] = normalizeEntry(entry, base);
      }
    }
    return result;
  }

  if (typeof raw === "object" && raw !== null) {
    // Already keyed by id
    const values = Object.values(raw);
    if (values.every((item) => item && typeof item === "object")) {
      return Object.fromEntries(
        Object.entries(raw as Record<string, any>).map(([key, value]) => [
          key,
          normalizeEntry(value as Record<string, any>, base),
        ])
      );
    }
  }

  return raw;
}

function normalizeEntry(entry: Record<string, any>, base: string) {
  const scoreKeys = getScoreKeysForBase(base);
  if (!scoreKeys) return entry;

  const normalized: Record<string, any> = {};
  for (const key of scoreKeys) {
    const value = entry[key] ?? entry[key.toLowerCase()] ?? entry[key.toUpperCase()];
    normalized[key] = typeof value === "number" ? value : value ? Number(value) || 0 : 0;
  }
  return normalized;
}

function getScoreKeysForBase(base: string) {
  if (["cpu", "gpu", "ram", "ssd"].includes(base)) return ["game", "work", "ai"];
  if (["game", "work", "ai"].includes(base)) return ["score"];
  return null;
}

function getExportType(base: string) {
  if (["cpu", "gpu", "ram", "ssd"].includes(base)) {
    return "Record<string, { game: number; work: number; ai: number }>";
  }
  if (["game", "work", "ai"].includes(base)) {
    return "Record<string, number>";
  }
  return "Record<string, any>";
}

async function main() {
  await ensureDir(inputDir);
  await ensureDir(outDir);

  const files = await fs.readdir(inputDir);
  if (files.length === 0) {
    console.log("No input files found in", inputDir);
    console.log("Create JSON or CSV files (e.g. cpu.json, gpu.csv) and re-run the script.");
    return;
  }

  for (const f of files) {
    try {
      await processFile(f);
    } catch (err) {
      console.error("Failed to process", f, err);
    }
  }
  console.log("Sync complete.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
