import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), "utf8"));

const organizations = readJson("resources/registries/organization-source-evidence.json").items ?? [];
const series = readJson("resources/registries/series-source-evidence.json").items ?? [];
const evidence = [...organizations, ...series];

const providers = [...new Set(evidence.map((item) => item.provider))].sort();
const kinds = ["maker", "label", "series"];

console.log("# Entity Registry Coverage\n");
console.log("| Provider | Maker | Label | Series | Verified | Name-only | Canonical mapped |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");

for (const provider of providers) {
  const items = evidence.filter((item) => item.provider === provider);
  const counts = Object.fromEntries(kinds.map((kind) => [kind, items.filter((item) => item.entityKind === kind).length]));
  const verified = items.filter((item) => item.idStatus === "verified").length;
  const nameOnly = items.filter((item) => item.idStatus === "name-only").length;
  const mapped = items.filter((item) => Boolean(item.canonicalId)).length;
  console.log(`| ${provider} | ${counts.maker} | ${counts.label} | ${counts.series} | ${verified} | ${nameOnly} | ${mapped} |`);
}

const verified = evidence.filter((item) => item.idStatus === "verified").length;
const nameOnly = evidence.filter((item) => item.idStatus === "name-only").length;
const mapped = evidence.filter((item) => Boolean(item.canonicalId)).length;
console.log(`\nTotal evidence: ${evidence.length} · verified Provider IDs: ${verified} · name-only: ${nameOnly} · canonical mapped: ${mapped}`);
