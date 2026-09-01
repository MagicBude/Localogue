import type { Person, PersonName } from "@/domain/entities/person";
import type {
  LocalizedText,
  SupportedLanguage,
} from "@/domain/value-objects/localized-text";

/**
 * 根据用户偏好返回语言回退顺序。
 *
 * 关键原则：日文原文不会因为存在中文/英文映射而被覆盖或删除。
 * 这里做的只是“显示时优先取哪一个”。
 */
export function getLanguageFallback(
  preferred: SupportedLanguage,
): SupportedLanguage[] {
  if (preferred === "zh-CN") {
    return ["zh-CN", "ja", "en"];
  }

  if (preferred === "en") {
    return ["en", "ja", "zh-CN"];
  }

  return ["ja", "zh-CN", "en"];
}

export function localizeText(
  value: LocalizedText | undefined,
  preferred: SupportedLanguage,
  fallback = "—",
): string {
  if (!value) {
    return fallback;
  }

  for (const language of getLanguageFallback(preferred)) {
    const candidate = value[language]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  return fallback;
}

/**
 * 人物姓名比普通 LocalizedText 更复杂，因为姓名还带有语义：
 * primary / localized / romanized / former_name / alias 等。
 */
export function getPreferredPersonName(
  person: Person,
  preferred: SupportedLanguage,
): string {
  const displayCandidates = person.names.filter((name) =>
    ["primary", "localized", "romanized"].includes(name.type),
  );

  for (const language of getLanguageFallback(preferred)) {
    const candidate = displayCandidates.find(
      (name) => name.language === language,
    );

    if (candidate) {
      return candidate.value;
    }
  }

  return person.names[0]?.value ?? person.id;
}

export function getNamesByType(
  person: Person,
  types: PersonName["type"][],
): PersonName[] {
  return person.names.filter((name) => types.includes(name.type));
}
