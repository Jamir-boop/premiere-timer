export const ext = globalThis.browser ?? globalThis.chrome;

if (!ext) {
  throw new Error("WebExtension API not available.");
}

export async function sendMessage(type, payload = {}) {
  const response = await ext.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) {
    throw new Error(response?.error || "Extension request failed.");
  }
  return response.data;
}
