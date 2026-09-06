import type { Work } from "@/domain/entities/work";
import type { LibraryRepository } from "@/domain/repositories/library-repository";

/**
 * 为批量导入建立一次性番号索引。
 *
 * 逐文件调用 findWorkByCode 看起来直观，但 JSON Repository 的实现需要在线性 Works 数组中
 * 查找；N 个文件乘 M 个作品会形成 O(N×M)。预览开始时读取一次 Works 并建 Map，之后每个
 * 文件只需 O(1) 查找。遇到异常重复番号时保留合并读取顺序中的第一项，即高优先级来源。
 */
export async function buildDesktopWorkCodeIndex(
  repository: LibraryRepository,
  normalizeCode: (code: string) => string,
): Promise<Map<string, Work>> {
  const result = await repository.listWorks({ page: 1, pageSize: 1_000_000 });
  const index = new Map<string, Work>();
  for (const work of result.items) {
    const key = normalizeCode(work.code);
    if (key && !index.has(key)) index.set(key, work);
  }
  return index;
}
