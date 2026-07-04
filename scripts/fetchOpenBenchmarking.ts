import fs from "fs/promises";
import path from "path";

const configPath = path.resolve(process.cwd(), "data/benchmark-sources.json");
const outputDir = path.resolve(process.cwd(), "data/benchmarks-input");

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

function getExtension(source: { url: string; type?: string }) {
  if (source.type) return `.${source.type.replace(/^\./, "")}`;
  const ext = path.extname(source.url).split("?")[0].toLowerCase();
  return ext || ".json";
}

async function loadConfig() {
  const raw = await fs.readFile(configPath, "utf8");
  return JSON.parse(raw) as {
    sources: Array<{ id: string; url: string; type?: string }>;
  };
}

async function fetchSource(source: { id: string; url: string; type?: string }) {
  console.log(`Fetching ${source.id} from ${source.url}`);
  const response = await fetch(source.url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  const ext = getExtension(source);
  const targetPath = path.join(outputDir, `${source.id}${ext}`);
  await fs.writeFile(targetPath, text, "utf8");
  console.log(`Saved ${targetPath}`);
}

async function main() {
  await ensureDir(outputDir);
  const config = await loadConfig();
  if (!Array.isArray(config.sources) || config.sources.length === 0) {
    throw new Error("data/benchmark-sources.json must include a non-empty sources array.");
  }
  for (const source of config.sources) {
    if (!source.id || !source.url) {
      console.warn("Skipping invalid source entry", source);
      continue;
    }
    try {
      await fetchSource(source);
    } catch (error) {
      console.error(`Error fetching source ${source.id}:`, error instanceof Error ? error.message : error);
    }
  }
  console.log("Fetch complete. Run npm run sync:bench:js to convert downloaded benchmark files.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});