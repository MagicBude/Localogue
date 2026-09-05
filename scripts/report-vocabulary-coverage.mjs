import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const [, , inputPath, ...args] = process.argv;
if (!inputPath) {
  console.error("用法: pnpm vocabulary:coverage -- <terms.txt|terms.csv|terms.json> [--column genre] [--fail-on-unmapped] [--json]");
  process.exit(1);
}

const root = process.cwd();
const vocabRoot = path.join(root, "resources", "vocabularies");
const columnArg = args.indexOf("--column");
const explicitColumn = columnArg >= 0 ? args[columnArg + 1] : undefined;
const failOnUnmapped = args.includes("--fail-on-unmapped");
const jsonOutput = args.includes("--json");

const genres = loadJson("genres.json").items ?? [];
const workTypes = loadJson("work-types.json").items ?? [];
const sourceOnly = loadJson("source-only-classifications.json").items ?? [];
const aliases = loadJson("classification-term-aliases.json").items ?? [];
const providerAliases = loadJson("genre-source-aliases.json").items ?? [];

const automatic = new Map();
const conflicts = new Set();
const review = new Map();
for (const item of aliases) {
  if (item.status === "review-required") review.set(norm(item.term), item.candidateTargets ?? []);
}

for (const item of genres) registerMany([item.id, item.ja, item["zh-CN"], item.en], `genre:${item.id}`);
for (const item of workTypes) registerMany([item.id, item.ja, item["zh-CN"], item.en], `workType:${item.id}`);
for (const item of sourceOnly) registerMany([item.id, item.ja, item["zh-CN"], item.en, ...(item.aliases ?? [])], `sourceOnly:${item.id}`);
for (const item of providerAliases) registerMany([item.ja, item["zh-CN"], item.en], `genre:${item.canonicalId}`);
for (const item of aliases) {
  if (item.status === "approved" && item.targets?.length === 1) register(item.term, item.targets[0]);
}

const terms = readTerms(inputPath, explicitColumn);
const buckets = { genre: [], workType: [], sourceOnly: [], review: [], ambiguous: [], unmapped: [] };
for (const term of terms) {
  const key = norm(term);
  if (conflicts.has(key)) {
    buckets.ambiguous.push(term);
    continue;
  }
  const target = automatic.get(key);
  if (target) {
    const kind = target.split(":", 1)[0];
    buckets[kind]?.push({ term, target });
  } else if (review.has(key)) {
    buckets.review.push({ term, candidates: review.get(key) });
  } else {
    buckets.unmapped.push(term);
  }
}

const total = terms.length;
const auto = buckets.genre.length + buckets.workType.length + buckets.sourceOnly.length;
const recognized = auto + buckets.review.length;
const summary = {
  inputFile: path.basename(inputPath),
  input: total,
  genre: buckets.genre.length,
  workType: buckets.workType.length,
  sourceOnly: buckets.sourceOnly.length,
  review: buckets.review.length,
  ambiguous: buckets.ambiguous.length,
  unmapped: buckets.unmapped.length,
  automaticCoverage: percent(auto, total),
  recognizedCoverage: percent(recognized, total),
  details: {
    review: buckets.review,
    ambiguous: buckets.ambiguous,
    unmapped: buckets.unmapped,
  },
};

if (jsonOutput) {
  process.stdout.write(`${JSON.stringify(summary)}\n`);
} else {
  console.log(`# Vocabulary Coverage: ${summary.inputFile}`);
  console.log(`- 输入词条：${summary.input}`);
  console.log(`- 自动 Genre：${summary.genre}`);
  console.log(`- 自动 Work Type：${summary.workType}`);
  console.log(`- 已识别 Source-only：${summary.sourceOnly}`);
  console.log(`- 需要审核：${summary.review}`);
  console.log(`- 运行时歧义：${summary.ambiguous}`);
  console.log(`- 未识别：${summary.unmapped}`);
  console.log(`- 自动覆盖率：${summary.automaticCoverage}`);
  console.log(`- 已识别覆盖率（含 Review）：${summary.recognizedCoverage}`);

  if (buckets.review.length) {
    console.log("\n## Review Required");
    for (const item of buckets.review) console.log(`- ${item.term} -> ${item.candidates.join(" | ")}`);
  }
  if (buckets.ambiguous.length) {
    console.log("\n## Runtime Ambiguous");
    for (const term of buckets.ambiguous) console.log(`- ${term}`);
  }
  if (buckets.unmapped.length) {
    console.log("\n## Unmapped");
    for (const term of buckets.unmapped) console.log(`- ${term}`);
  }
}

if (failOnUnmapped && (buckets.unmapped.length || buckets.ambiguous.length)) process.exit(2);

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(vocabRoot, name), "utf8"));
}

function registerMany(values, target) {
  for (const value of values) register(value, target);
}

function register(value, target) {
  const key = norm(value);
  if (!key || review.has(key) || conflicts.has(key)) return;
  const existing = automatic.get(key);
  if (existing && existing !== target) {
    automatic.delete(key);
    conflicts.add(key);
  } else automatic.set(key, target);
}

function norm(value) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/[\s_\-]+/g, " ");
}

function percent(value, denominator) {
  return denominator ? `${(value * 100 / denominator).toFixed(1)}%` : "0.0%";
}

function readTerms(fileName, column) {
  const text = readFileSync(fileName, "utf8").replace(/^\uFEFF/, "");
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".json") {
    const value = JSON.parse(text);
    if (Array.isArray(value)) {
      return unique(value.map((item) => typeof item === "string" ? item : selectObjectTerm(item, column)).filter(Boolean));
    }
    if (value && typeof value === "object") {
      const candidate = Array.isArray(value.items) ? value.items : Object.keys(value);
      return unique(candidate.map((item) => typeof item === "string" ? item : selectObjectTerm(item, column)).filter(Boolean));
    }
    return [];
  }
  if (ext === ".csv") {
    const rows = parseCsv(text);
    if (!rows.length) return [];
    const selected = column ?? ["term", "genre", "name", "ja", "sourceTerm"].find((name) => Object.hasOwn(rows[0], name)) ?? Object.keys(rows[0])[0];
    return unique(rows.map((row) => row[selected]).filter(Boolean));
  }
  return unique(text.split(/\r?\n/u).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return "";
    return trimmed.includes("=") ? trimmed.split("=", 1)[0].trim() : trimmed;
  }).filter(Boolean));
}

function selectObjectTerm(item, column) {
  if (!item || typeof item !== "object") return "";
  const selected = column ?? ["term", "genre", "name", "ja", "sourceTerm"].find((name) => typeof item[name] === "string");
  return selected ? item[selected] : "";
}

function unique(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = String(value).trim();
    const key = norm(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
  }
  return output;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift();
  return rows.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}
