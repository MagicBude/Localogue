import { JsonLibraryRepository } from "@/infrastructure/repositories/json-library-repository";
import path from "node:path";
import { existsSync } from "node:fs";
import { SqliteLibraryRepository } from "@/infrastructure/repositories/sqlite-library-repository";
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
const sqliteCatalogPath = path.resolve(/* turbopackIgnore: true */ process.env.LOCALOGUE_CATALOG_DB ?? path.join(process.cwd(), ".localogue", "catalog.db"));
const sqliteLocalPath = path.resolve(/* turbopackIgnore: true */ process.env.LOCALOGUE_LOCAL_DB ?? path.join(process.cwd(), ".localogue", "local.db"));
const sqliteRequested = process.env.LOCALOGUE_STORAGE?.trim().toLowerCase() === "sqlite";

if (sqliteRequested && (!existsSync(/* turbopackIgnore: true */ sqliteCatalogPath) || !existsSync(/* turbopackIgnore: true */ sqliteLocalPath))) {
  throw new Error("LOCALOGUE_STORAGE=sqlite 已启用，但 catalog.db 或 local.db 不存在；请先运行对应构建命令。");
}

export const libraryRepository = sqliteRequested
  ? new SqliteLibraryRepository(sqliteCatalogPath, sqliteLocalPath)
  : new JsonLibraryRepository(getReadableLibraryRoots, getConfiguredPrivateLibraryPath);

export { isPrivateLibraryConfigured };
