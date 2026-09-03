/**
 * Platform-neutral SHA-256 helper.
 *
 * Node 22+ and modern WebViews both expose Web Crypto on globalThis.crypto,
 * which lets Review / Commit Plan code stay outside Node-only infrastructure.
 */
export async function sha256Text(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("当前 Runtime 不支持 Web Crypto SHA-256。");
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}
