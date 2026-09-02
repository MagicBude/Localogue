import type { DuplicateCandidate } from "@/domain/entities/duplicate-candidate";
import type { Person } from "@/domain/entities/person";
import type { Work } from "@/domain/entities/work";

/**
 * V1-08 的重复检测只做“候选发现”，不做自动合并。
 *
 * 规则刻意保持可解释：精确番号、精确规范化姓名、相同标题/年份等。
 * 后续即使加入更复杂算法，也应该把“为什么认为它们可疑”展示给用户。
 */
export function findDuplicateWorkCandidates(works: Work[]): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];

  forEachPair(works, (left, right) => {
    const reasons: string[] = [];
    let confidence: DuplicateCandidate["confidence"] = "low";

    if (normalizeCode(left.code) === normalizeCode(right.code)) {
      reasons.push("same_code");
      confidence = "high";
    } else {
      const leftTitle = normalizeText(getOriginalTitle(left));
      const rightTitle = normalizeText(getOriginalTitle(right));
      const sameTitle = Boolean(leftTitle && rightTitle && leftTitle === rightTitle);
      const sameYear =
        left.releaseDate?.value.slice(0, 4) &&
        left.releaseDate.value.slice(0, 4) === right.releaseDate?.value.slice(0, 4);
      const sharedPerformer = hasSharedPerformer(left, right);

      if (sameTitle && sameYear) {
        reasons.push("same_title", "same_release_year");
        confidence = sharedPerformer ? "high" : "medium";
        if (sharedPerformer) reasons.push("shared_performer");
      } else if (sameTitle && sharedPerformer) {
        reasons.push("same_title", "shared_performer");
        confidence = "medium";
      }
    }

    if (reasons.length) {
      candidates.push({
        id: pairId("work", left.id, right.id),
        kind: "work",
        leftId: left.id,
        rightId: right.id,
        confidence,
        reasonIds: reasons,
      });
    }
  });

  return sortCandidates(candidates);
}

export function findDuplicatePersonCandidates(people: Person[]): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];

  forEachPair(people, (left, right) => {
    const leftNames = normalizedPersonNames(left);
    const rightNames = normalizedPersonNames(right);
    const sharedNames = [...leftNames].filter((name) => rightNames.has(name));

    if (!sharedNames.length) return;

    const sameBirthDate = Boolean(
      left.birthDate?.value && left.birthDate.value === right.birthDate?.value,
    );
    const reasons = ["shared_exact_name"];
    if (sameBirthDate) reasons.push("same_birth_date");

    candidates.push({
      id: pairId("person", left.id, right.id),
      kind: "person",
      leftId: left.id,
      rightId: right.id,
      confidence: sameBirthDate ? "high" : "medium",
      reasonIds: reasons,
    });
  });

  return sortCandidates(candidates);
}

function forEachPair<T>(items: T[], callback: (left: T, right: T) => void): void {
  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      callback(items[leftIndex]!, items[rightIndex]!);
    }
  }
}

function getOriginalTitle(work: Work): string {
  return work.titles[work.originalLanguage] ?? "";
}

function normalizeCode(value: string): string {
  return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function normalizedPersonNames(person: Person): Set<string> {
  return new Set(person.names.map((name) => normalizeText(name.value)).filter(Boolean));
}

function hasSharedPerformer(left: Work, right: Work): boolean {
  const leftIds = new Set(
    left.personRelations
      .filter((relation) => relation.role === "performer")
      .map((relation) => relation.personId),
  );
  return right.personRelations.some(
    (relation) => relation.role === "performer" && leftIds.has(relation.personId),
  );
}

function pairId(kind: "work" | "person", leftId: string, rightId: string): string {
  return `${kind}:${[leftId, rightId].sort().join(":")}`;
}

function sortCandidates(candidates: DuplicateCandidate[]): DuplicateCandidate[] {
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return candidates.sort(
    (a, b) => rank[a.confidence] - rank[b.confidence] || a.id.localeCompare(b.id),
  );
}
