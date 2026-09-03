import { TauriLibraryRepository } from "./tauri-library-repository";

/**
 * V1-14 名称的兼容适配器。
 *
 * V1-15 的正式 Desktop App 已直接使用 TauriLibraryRepository，从而让 Shared Pack
 * 中的 Work 也参与媒体匹配。保留这个薄包装是为了让旧文档/局部调用点覆盖升级时
 * 不会突然失效；它不再维护第二套 Repository 实现。
 */
export class TauriScanRepository extends TauriLibraryRepository {
  constructor(libraryPath: string) {
    super([libraryPath], libraryPath);
  }
}
