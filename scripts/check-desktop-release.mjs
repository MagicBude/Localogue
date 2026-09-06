/**
 * Desktop 安装包静态预检。
 *
 * Tauri 构建往往要到 Rust 编译结束后才报告资源或 Bundle 配置错误，代价很高。
 * 这个脚本先验证仓库内可以确定的条件，让缺图标、版本漂移和误配 Sidecar 尽早失败。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
const appPackage = readJson("package.json");
const desktopPackage = readJson("apps/desktop/package.json");
const tauriConfig = readJson("apps/desktop/src-tauri/tauri.conf.json");
const cargo = readFileSync(path.join(root, "apps/desktop/src-tauri/Cargo.toml"), "utf8");
const errors = [];

// 三个版本共同决定应用、前端包和 Rust 二进制的版本。保持一致可以避免安装器文件名、
// About 页面和 Windows 已安装应用列表显示不同版本。
const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
for (const [source, version] of [
  ["Desktop package", desktopPackage.version],
  ["Tauri config", tauriConfig.version],
  ["Cargo package", cargoVersion],
]) {
  if (version !== appPackage.version) errors.push(`${source} 版本 ${version ?? "缺失"} 与根 package ${appPackage.version} 不一致。`);
}

if (tauriConfig.bundle?.active !== true) errors.push("bundle.active 必须为 true，才能生成安装包。");
if (!tauriConfig.bundle?.targets?.includes("nsis")) errors.push("Windows 发布基线必须包含 NSIS target。");

for (const relativeIcon of tauriConfig.bundle?.icon ?? []) {
  const iconPath = path.join(root, "apps/desktop/src-tauri", relativeIcon);
  if (!existsSync(iconPath)) errors.push(`Bundle 图标不存在：${relativeIcon}`);
}
for (const [source, target] of Object.entries(tauriConfig.bundle?.resources ?? {})) {
  if (!existsSync(path.resolve(root, "apps/desktop/src-tauri", source))) errors.push(`Bundle 资源不存在：${source} -> ${target}`);
}

// 当前仓库没有经过版本、许可证和摘要流程审核的 ffprobe target-triple 二进制。
// 显式拒绝 externalBin，避免安装器看似自带分析器，换一台电脑后才暴露缺文件问题。
if (tauriConfig.bundle?.externalBin?.length) errors.push("当前阶段不得配置 externalBin；ffprobe 仍使用系统 PATH 或用户指定路径。");

if (errors.length) {
  console.error("Localogue Desktop 发布预检失败：\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Localogue Desktop 发布预检通过：v${appPackage.version}，NSIS current-user 安装包，${tauriConfig.bundle.icon.length} 个图标与 ${Object.keys(tauriConfig.bundle.resources).length} 组资源已确认。`);
}
