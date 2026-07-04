const fs = require("fs").promises;
const path = require("path");

const configPath = path.resolve(process.cwd(), "data/benchmark-sources.json");
const examplePath = path.resolve(process.cwd(), "data/benchmark-sources.example.json");
const outputDir = path.resolve(process.cwd(), "data/benchmarks-input");

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // ignore
  }
}

function getExtension(source) {
  if (source.type) return `.${source.type}`;
  const ext = path.extname(source.url).split("?")[0].toLowerCase();
  return ext || ".json";
}

async function fetchSource(source) {
  console.log(`Fetching ${source.id} from ${source.url}`);
  const response = await fetch(source.url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();

  const ext = getExtension(source);
  const filename = `${source.id}${ext}`;
  const targetPath = path.join(outputDir, filename);

  await fs.writeFile(targetPath, text, "utf8");
  console.log(`Saved ${targetPath}`);
}

async function loadConfig() {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`Missing config file: ${configPath}`);
      console.error(`Copy ${examplePath} to ${configPath} and update the URLs.`);
      process.exit(1);
    }
    throw error;
  }
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
      console.error(`Error fetching source ${source.id}:`, error.message || error);
    }
  }

  console.log("Fetch complete. Run npm run sync:bench:js to convert downloaded benchmark files.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});