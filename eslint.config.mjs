import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * 使用 Next.js 官方 Flat Config。
 *
 * 这里没有额外堆叠很多规则，原因是 V1 更重视：
 * 1. 先建立稳定、能理解的代码结构；
 * 2. 使用 TypeScript 严格模式保证类型安全；
 * 3. 避免“为了 lint 而 lint”增加学习负担。
 */
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "data/library/**", "apps/desktop/**"]),
]);
