import { readFile } from "node:fs/promises";

/**
 * V1-12 的 Platform Abstraction 不是一次性把全部 Node 代码重写掉，
 * 而是先冻结“媒体扫描业务层不得重新依赖 Node 内建模块”的架构边界。
 *
 * 以后 Tauri Adapter 可以实现同一组 Ports；如果有人又在这些核心文件里
 * import node:fs / node:path / child_process，CI 会立即失败。
 */
const platformNeutralFiles = [
  "src/application/media/media-scan-service.ts",
  "src/application/media/media-scan-coordinator.ts",
  "src/application/platform/platform-ports.ts",
];

const violations = [];
for (const filePath of platformNeutralFiles) {
  const source = await readFile(filePath, "utf8");
  const matches = [...source.matchAll(/(?:from\s+|import\s*\(|require\s*\()(["'])node:[^"']+\1/g)];
  for (const match of matches) violations.push(`${filePath}: ${match[0]}`);
}

if (violations.length) {
  console.error("Localogue Platform Boundary 校验失败：\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("Localogue Platform Boundary 校验通过：Media Scan Application Core 未直接依赖 Node 内建模块。");
}
