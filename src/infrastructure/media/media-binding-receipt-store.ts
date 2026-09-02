import { randomUUID } from "node:crypto";

import type { MediaBindingReceipt } from "@/domain/entities/media-binding";
import { JsonFileStore } from "@/infrastructure/repositories/json-file-store";
import { getConfiguredPrivateLibraryPath } from "@/infrastructure/repositories/library-path";

export async function saveMediaBindingReceipt(
  input: Omit<MediaBindingReceipt, "schemaVersion" | "id" | "changedAt">,
): Promise<MediaBindingReceipt> {
  const root = getConfiguredPrivateLibraryPath();
  if (!root) throw new Error("当前没有配置 Private Library，不能保存 MediaFile 绑定审计记录。");
  const receipt: MediaBindingReceipt = {
    schemaVersion: 1,
    id: `media_binding_${Date.now()}_${randomUUID().slice(0, 8)}`,
    ...input,
    changedAt: new Date().toISOString(),
  };
  await new JsonFileStore(root).writeEntity("media-binding-receipts", receipt);
  return receipt;
}
