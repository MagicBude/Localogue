import path from "node:path";

import { JsonLibraryRepository } from "@/infrastructure/repositories/json-library-repository";

/**
 * 决定当前运行实例从哪个目录读取 Canonical Library。
 *
 * 默认读取仓库内可公开提交的虚构 Demo 数据；用户开始导入真实收藏后，
 * 应通过 LOCALOGUE_LIBRARY_PATH 指向一个被 Git 忽略的本地目录。
 * 这样“项目源码”和“私人资料”从第一天起就不会混在一起。
 */
function resolveLibraryRoot(): string {
  const configured = process.env.LOCALOGUE_LIBRARY_PATH?.trim();
  if (configured) {
    return path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
  }

  return path.join(process.cwd(), "data", "demo-library");
}

export const libraryRepository = new JsonLibraryRepository(resolveLibraryRoot());
