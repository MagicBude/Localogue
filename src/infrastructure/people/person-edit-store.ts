import { randomUUID } from "node:crypto";

import type { Person } from "@/domain/entities/person";
import type { PersonEditReceipt } from "@/domain/entities/person-edit";
import { getConfiguredPrivateLibraryPath } from "@/infrastructure/repositories/library-path";
import { JsonFileStore } from "@/infrastructure/repositories/json-file-store";

function requirePrivateRoot(): string {
  const root = getConfiguredPrivateLibraryPath();
  if (!root) throw new Error("当前未配置私人资料库，不能编辑 Canonical Person。");
  return root;
}

export async function savePersonEditReceipt(
  before: Person,
  after: Person,
  changedFields: string[],
): Promise<PersonEditReceipt> {
  const editedAt = new Date().toISOString();
  const receipt: PersonEditReceipt = {
    schemaVersion: 1,
    id: `person_edit_${editedAt.replace(/[:.]/g, "-")}_${randomUUID().slice(0, 8)}`,
    personId: after.id,
    editedAt,
    changedFields,
    before,
    after,
  };
  await new JsonFileStore(requirePrivateRoot()).writeEntity("person-edits", receipt);
  return receipt;
}
