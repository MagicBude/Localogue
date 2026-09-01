/**
 * Localogue 首批支持的语言。
 *
 * 注意：这些语言代码既用于 UI，也用于元数据，但两者是独立偏好。
 */
export const supportedLanguages = ["ja", "zh-CN", "en"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

/**
 * 可本地化文本。
 *
 * 使用语言键对象，而不是 titleJa/titleZh/titleEn 这类字段，
 * 是为了让 Domain Model 不被固定的三种语言永久绑死。
 */
export type LocalizedText = Partial<Record<SupportedLanguage, string>>;
