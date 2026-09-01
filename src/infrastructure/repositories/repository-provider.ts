import { JsonLibraryRepository } from "@/infrastructure/repositories/json-library-repository";
import {
  getReadableLibraryPath,
  isPrivateLibraryConfigured,
} from "@/infrastructure/repositories/library-path";

/**
 * 页面和业务服务统一使用当前 Canonical Library。
 *
 * - 未配置 LOCALOGUE_LIBRARY_PATH：读取公开 Demo Library，且视为只读；
 * - 已配置：读取/写入用户明确指定的私人资料库。
 */
export const libraryRepository = new JsonLibraryRepository(getReadableLibraryPath());

export { isPrivateLibraryConfigured };
