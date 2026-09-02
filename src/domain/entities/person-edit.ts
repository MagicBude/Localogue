import type { Person } from "@/domain/entities/person";

/**
 * 人物资料手工编辑的审计记录。
 *
 * V1 还没有通用的 Person Provenance，所以先保存完整 before/after image。
 * 这样至少不会出现“人物资料改过了，但完全不知道以前是什么”的情况。
 */
export interface PersonEditReceipt {
  schemaVersion: 1;
  id: string;
  personId: string;
  editedAt: string;
  changedFields: string[];
  before: Person;
  after: Person;
}
