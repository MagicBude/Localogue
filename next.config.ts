import type { NextConfig } from "next";

/**
 * Next.js 配置保持最小化。
 *
 * V1 的重点是学习和验证 Domain / Repository / UI 的边界，
 * 所以暂时不引入图片远程域名、实验性缓存或复杂构建插件。
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
