import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const libraryIndex = args.indexOf("--library");
const libraryRoot = path.resolve(libraryIndex >= 0 && args[libraryIndex + 1] ? args[libraryIndex + 1] : "data/demo-library");
const readDir = (name) => {
  const directory = path.join(libraryRoot, name);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(path.join(directory, file), "utf8")));
};

const organizations = readDir("organizations");
const series = readDir("series");
const works = readDir("works");
const organizationById = new Map(organizations.map((item) => [item.id, item]));
const errors = [];
const warnings = [];

for (const organization of organizations) {
  if (!organization.parentOrganizationId) continue;
  const parent = organizationById.get(organization.parentOrganizationId);
  if (!parent) {
    errors.push(`Organization parent 不存在：${organization.id} -> ${organization.parentOrganizationId}`);
    continue;
  }
  if (organization.kind === "label" && parent.kind !== "maker") {
    errors.push(`Label parent 必须是 Maker：${organization.id} -> ${parent.id} (${parent.kind})`);
  }
}

for (const item of series) {
  if (!item.parentOrganizationId) {
    warnings.push(`Series 尚未记录归属组织：${item.id}`);
    continue;
  }
  const parent = organizationById.get(item.parentOrganizationId);
  if (!parent) {
    errors.push(`Series parent 不存在：${item.id} -> ${item.parentOrganizationId}`);
    continue;
  }
  if (!["maker", "label"].includes(parent.kind)) {
    errors.push(`Series parent 必须是 Maker 或 Label：${item.id} -> ${parent.id} (${parent.kind})`);
  }
}

const counts = {
  maker: organizations.filter((item) => item.kind === "maker").length,
  label: organizations.filter((item) => item.kind === "label").length,
  agency: organizations.filter((item) => item.kind === "agency").length,
  other: organizations.filter((item) => item.kind === "other").length,
  series: series.length,
  seriesLinked: series.filter((item) => item.parentOrganizationId).length,
  seriesUnlinked: series.filter((item) => !item.parentOrganizationId).length,
  works: works.length,
};

console.log("# Organization & Series Audit");
console.table(counts);
if (warnings.length) {
  console.log("\nWarnings:");
  for (const warning of warnings) console.log(`- ${warning}`);
}
if (errors.length) {
  console.error("\nErrors:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("\n✓ Organization / Series structural audit passed");
