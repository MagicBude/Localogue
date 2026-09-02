import {
  calculatePersonCompleteness,
  calculateWorkCompleteness,
} from "@/application/curation/completeness-service";
import {
  findDuplicatePersonCandidates,
  findDuplicateWorkCandidates,
} from "@/application/curation/duplicate-detection-service";
import type { CompletenessResult } from "@/domain/entities/completeness";
import type { Person } from "@/domain/entities/person";
import type { Work } from "@/domain/entities/work";
import type { LibraryRepository } from "@/domain/repositories/library-repository";

export interface WorkCurationItem {
  work: Work;
  completeness: CompletenessResult;
}

export interface PersonCurationItem {
  person: Person;
  completeness: CompletenessResult;
}

export async function buildCurationOverview(repository: LibraryRepository) {
  const [workResult, peopleResult, assets] = await Promise.all([
    repository.listWorks({ page: 1, pageSize: 999999 }),
    repository.listPeople({ page: 1, pageSize: 999999 }),
    repository.listAssets(),
  ]);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  const works: WorkCurationItem[] = workResult.items
    .map((work) => ({ work, completeness: calculateWorkCompleteness(work, assetsById) }))
    .sort((a, b) => a.completeness.score - b.completeness.score || a.work.code.localeCompare(b.work.code));

  const people: PersonCurationItem[] = peopleResult.items
    .map((person) => ({ person, completeness: calculatePersonCompleteness(person) }))
    .sort((a, b) => a.completeness.score - b.completeness.score || a.person.id.localeCompare(b.person.id));

  return {
    works,
    people,
    duplicateWorks: findDuplicateWorkCandidates(workResult.items),
    duplicatePeople: findDuplicatePersonCandidates(peopleResult.items),
    stats: {
      worksNeedingAttention: works.filter((item) => item.completeness.missingIds.length > 0).length,
      peopleNeedingAttention: people.filter((item) => item.completeness.missingIds.length > 0).length,
      duplicateWorks: findDuplicateWorkCandidates(workResult.items).length,
      duplicatePeople: findDuplicatePersonCandidates(peopleResult.items).length,
    },
  };
}
