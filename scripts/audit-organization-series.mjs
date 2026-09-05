import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const libraryIndex = args.indexOf("--library");
const libraryRoot = libraryIndex >= 0 && args[libraryIndex + 1]
  ? path.resolve(args[libraryIndex + 1])
  : null;
const readDir = (root, name) => {
  const directory = path.join(root, name);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(path.join(directory, file), "utf8")));
};

const readCatalog = (name) => JSON.parse(readFileSync(path.resolve("resources/catalogs", name), "utf8")).items ?? [];
const organizations = libraryRoot ? readDir(libraryRoot, "organizations") : readCatalog("community-organizations.json");
const series = libraryRoot ? readDir(libraryRoot, "series") : readCatalog("community-series.json");
const works = libraryRoot ? readDir(libraryRoot, "works") : [];
const organizationById = new Map(organizations.map((item) => [item.id, item]));
const errors = [];
const warnings = [];

for (const organization of organizations) {
  if (!organization.parentOrganizationId) {
    if (organization.kind === "label") warnings.push(`Label 尚未记录归属 Maker：${organization.id}`);
    continue;
  }
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
console.log(libraryRoot ? `Scope: Library (${libraryRoot})` : "Scope: Community Catalog");
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
