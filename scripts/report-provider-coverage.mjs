import { readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const catalogRoot = path.join(root, "resources", "vocabularies", "provider-genre-catalogs");
const coverageScript = path.join(root, "scripts", "report-vocabulary-coverage.mjs");
const showDetails = process.argv.includes("--details");
const check = process.argv.includes("--check");

const files = readdirSync(catalogRoot)
  .filter((name) => name.endsWith(".json"))
  .sort((a, b) => a.localeCompare(b, "en"));

if (!files.length) {
  console.error("没有找到 Provider Genre Catalog。\n");
  process.exit(1);
}

const results = [];
let failed = false;
for (const file of files) {
  const fullPath = path.join(catalogRoot, file);
  const run = spawnSync(process.execPath, [coverageScript, fullPath, "--fail-on-unmapped", "--json"], {
    cwd: root,
    encoding: "utf8",
  });

  const provider = path.basename(file, ".json");
  let summary;
  try {
    summary = JSON.parse(String(run.stdout ?? "").trim());
  } catch {
    failed = true;
    console.error(`\n## ${provider} failed`);
    console.error("Provider Coverage 子进程没有返回有效 JSON。请确认 report-vocabulary-coverage.mjs 与 report-provider-coverage.mjs 来自同一版本。");
    if (run.stdout) console.error(`stdout:\n${run.stdout}`);
    if (run.stderr) console.error(`stderr:\n${run.stderr}`);
    continue;
  }

  const row = {
    provider,
    input: summary.input,
    genre: summary.genre,
    workType: summary.workType,
    sourceOnly: summary.sourceOnly,
    review: summary.review,
    ambiguous: summary.ambiguous,
    unmapped: summary.unmapped,
    automatic: summary.automaticCoverage,
    recognized: summary.recognizedCoverage,
  };
  results.push(row);

  const hasBlockingCoverageGap = Number(summary.unmapped) > 0 || Number(summary.ambiguous) > 0;
  if (run.status !== 0 || hasBlockingCoverageGap) {
    failed = true;
    console.error(`\n## ${provider} failed`);
    printDetails(summary);
    if (run.stderr) console.error(run.stderr);
  } else if (showDetails) {
    console.log(`\n## ${provider}`);
    printDetails(summary);
  }
}

console.log("# Provider Vocabulary Coverage");
console.log("| Provider | Terms | Genre | Work Type | Source-only | Review | Ambiguous | Unmapped | Auto | Recognized |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
for (const row of results) {
  console.log(`| ${row.provider} | ${row.input} | ${row.genre} | ${row.workType} | ${row.sourceOnly} | ${row.review} | ${row.ambiguous} | ${row.unmapped} | ${row.automatic} | ${row.recognized} |`);
}

if (failed) process.exit(2);
if (check) console.log("\n✓ Provider coverage check passed: all collected terms are recognized or explicitly review-required.");

function printDetails(summary) {
  console.log(`- 输入词条：${summary.input}`);
  console.log(`- 自动 Genre：${summary.genre}`);
  console.log(`- 自动 Work Type：${summary.workType}`);
  console.log(`- 已识别 Source-only：${summary.sourceOnly}`);
  console.log(`- 需要审核：${summary.review}`);
  console.log(`- 运行时歧义：${summary.ambiguous}`);
  console.log(`- 未识别：${summary.unmapped}`);
  console.log(`- 自动覆盖率：${summary.automaticCoverage}`);
  console.log(`- 已识别覆盖率（含 Review）：${summary.recognizedCoverage}`);
  if (summary.details?.review?.length) {
    console.log("Review Required:");
    for (const item of summary.details.review) console.log(`  - ${item.term} -> ${(item.candidates ?? []).join(" | ")}`);
  }
  if (summary.details?.ambiguous?.length) {
    console.log("Runtime Ambiguous:");
    for (const term of summary.details.ambiguous) console.log(`  - ${term}`);
  }
  if (summary.details?.unmapped?.length) {
    console.log("Unmapped:");
    for (const term of summary.details.unmapped) console.log(`  - ${term}`);
  }
}
