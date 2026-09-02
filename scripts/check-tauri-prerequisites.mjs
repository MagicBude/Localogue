import { execFileSync } from "node:child_process";

function readPnpmFromCurrentProcess() {
  const userAgent = process.env.npm_config_user_agent ?? "";
  const match = userAgent.match(/(?:^|\s)pnpm\/([^\s]+)/i);
  return match?.[1] ? `v${match[1]}` : undefined;
}

function resolveCommand(command) {
  if (process.platform !== "win32") return command;

  // Node 的 execFile 不经过 Shell。Windows 上 pnpm/Corepack 通常暴露为 pnpm.cmd，
  // 直接执行 "pnpm" 会得到 ENOENT，即使当前脚本本身就是由 pnpm 启动的。
  if (command === "pnpm") return "pnpm.cmd";
  return command;
}

function runVersionCheck(label, command, args = ["--version"]) {
  if (label === "pnpm") {
    const inheritedVersion = readPnpmFromCurrentProcess();
    if (inheritedVersion) {
      console.log(`✓ pnpm: ${inheritedVersion}（由当前 pnpm 进程确认）`);
      return true;
    }
  }

  const resolvedCommand = resolveCommand(command);
  try {
    const output = execFileSync(resolvedCommand, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    console.log(`✓ ${label}: ${output}`);
    return true;
  } catch {
    console.error(`✗ ${label}: 未找到 ${command}`);
    return false;
  }
}

const checks = [
  ["Node", "node"],
  ["pnpm", "pnpm"],
  ["rustc", "rustc"],
  ["cargo", "cargo"],
];

let failed = false;
for (const [label, command] of checks) {
  if (!runVersionCheck(label, command)) failed = true;
}

if (process.platform === "win32") {
  console.log("Windows 还需要：Microsoft C++ Build Tools（Desktop development with C++）与 WebView2 Runtime。");
}

if (failed) {
  console.error("Tauri 开发环境尚未完整安装。请先阅读 docs/desktop/tauri-prerequisites.md。");
  process.exitCode = 1;
} else {
  console.log("基础命令行前置检查通过。系统级 C++/WebView 依赖仍以 Tauri 官方前置要求为准。");
}
