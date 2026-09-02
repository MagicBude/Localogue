import { JsonLibraryRepository } from "@/infrastructure/repositories/json-library-repository";
import {
  getConfiguredPrivateLibraryPath,
  getReadableLibraryRoots,
  isPrivateLibraryConfigured,
} from "@/infrastructure/repositories/library-path";

/**
 * Repository 本身可以是单例，但“资料根路径”必须在每次读写时动态解析。
 *
 * 这样 /settings 保存新路径后，不需要重启 Node 进程就能让后续请求使用新配置。
 * 同时所有旧页面仍然只依赖 LibraryRepository，不需要知道 Shared Pack 的存在。
 */
export const libraryRepository = new JsonLibraryRepository(
  getReadableLibraryRoots,
  getConfiguredPrivateLibraryPath,
);

export { isPrivateLibraryConfigured };
