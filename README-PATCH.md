# Localogue V1-04 Turbopack 警告修复补丁

此补丁仅修复 `next build` 中关于动态文件系统路径追踪的两个 Turbopack 警告。

`LOCALOGUE_LIBRARY_PATH` 支持指向仓库外的私人资料目录是 Localogue 的有意设计，因此不应把路径改成固定目录。补丁在两个动态 `path.resolve()` 调用中加入 `turbopackIgnore` 指示，告诉 Turbopack 不要尝试把该运行时路径静态追踪进构建产物。

覆盖仓库根目录后重新执行：

```bash
pnpm check
```

注意：如果 Next.js 已自动更新你的 `tsconfig.json`（例如将 `jsx` 调整为 `react-jsx`，并加入 `.next/dev/types/**/*.ts`），请保留本地修改并一并提交。本补丁不包含 `tsconfig.json`，不会覆盖它。
