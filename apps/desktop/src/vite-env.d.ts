/// <reference types="vite/client" />

/**
 * Vite 会把 PNG 等静态资源 import 转换成构建后的 URL 字符串。
 * 这条类型引用只让 TypeScript 理解该转换，不会在运行时读取文件或扩大 WebView 权限。
 */
