import type { LibraryRepository } from "@/domain/repositories/library-repository";

export interface LibraryStats {
  works: number;
  people: number;
  makers: number;
  labels: number;
  series: number;
}

/**
 * Dashboard 统计属于 Application Service，而不是 React 组件本身。
 *
 * 这样做的好处是：以后改成 SQLite COUNT(*) 查询时，只调整数据层，
 * 页面仍然只消费一个简单的 LibraryStats 对象。
 */
export async function getLibraryStats(
  repository: LibraryRepository,
): Promise<LibraryStats> {
  const [works, people, organizations, series] = await Promise.all([
    repository.listWorks({ page: 1, pageSize: 1 }),
    repository.listPeople({ page: 1, pageSize: 1 }),
    repository.listOrganizations(),
    repository.listSeries(),
  ]);

  return {
    works: works.total,
    people: people.total,
    makers: organizations.filter((item) => item.kind === "maker").length,
    labels: organizations.filter((item) => item.kind === "label").length,
    series: series.length,
  };
}
