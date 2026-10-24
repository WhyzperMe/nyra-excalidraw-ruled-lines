export function createStableId(prefix = "profile"): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return `${prefix}-${cryptoApi.randomUUID()}`;
  }

  const time = Date.now().toString(36);
  const random = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);
  return `${prefix}-${time}-${random}`;
}
