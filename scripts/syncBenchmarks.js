const fs = require('fs').promises;
const path = require('path');

const inputDir = path.resolve(process.cwd(), 'data/benchmarks-input');
const outDir = path.resolve(process.cwd(), 'database/benchmarks');

async function ensureDir(dir) {
  try { await fs.mkdir(dir, { recursive: true }); } catch (e) {}
}

function toExportName(base) { return `${base}Bench`; }

async function parseCsv(content) {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return {};
  const header = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1);
  const result = {};
  for (const row of rows) {
    const cols = row.split(',').map(c => c.trim());
    const id = cols[0];
    if (!id) continue;
    const obj = {};
    for (let i = 1; i < header.length; i++) {
      const key = header[i];
      const val = cols[i] ?? '';
      const num = Number(val);
      obj[key] = Number.isNaN(num) ? val : num;
    }
    result[id] = obj;
  }
  return result;
}

async function processFile(file) {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file, ext);
  const outName = toExportName(base);
  const inputPath = path.join(inputDir, file);
  const content = await fs.readFile(inputPath, 'utf8');
  let parsed = {};
  if (ext === '.json') parsed = JSON.parse(content);
  else if (ext === '.csv') parsed = await parseCsv(content);
  else { console.warn('Skipping unsupported file:', file); return; }
  const outPath = path.join(outDir, `${outName}.ts`);
  const tsContent = `export const ${outName}: Record<string, any> = ${JSON.stringify(parsed, null, 2)};\n`;
  await fs.writeFile(outPath, tsContent, 'utf8');
  console.log('Wrote', outPath);
}

async function main(){
  await ensureDir(inputDir);
  await ensureDir(outDir);
  const files = await fs.readdir(inputDir);
  if (files.length === 0) { console.log('No input files found in', inputDir); console.log('Create JSON or CSV files (e.g. cpu.json, gpu.csv) and re-run the script.'); return; }
  for (const f of files) {
    try { await processFile(f); } catch (err) { console.error('Failed to process', f, err); }
  }
  console.log('Sync complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
