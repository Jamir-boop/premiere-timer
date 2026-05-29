export const ext = globalThis.browser ?? globalThis.chrome;

if (!ext) {
  throw new Error("WebExtension API not available.");
}

export async function getStorage(defaults) {
  return ext.storage.local.get(defaults);
}

export async function setStorage(value) {
  await ext.storage.local.set(value);
}

export async function hasPermission(origin) {
  return ext.permissions.contains({ origins: [origin] });
}

export async function requestPermission(origin) {
  return ext.permissions.request({ origins: [origin] });
}

export async function hasApiPermission(permission) {
  return ext.permissions.contains({ permissions: [permission] });
}

export async function requestApiPermission(permission) {
  return ext.permissions.request({ permissions: [permission] });
}

export async function sendMessage(type, payload = {}) {
  const response = await ext.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) {
    throw new Error(response?.error || "Extension request failed.");
  }
  return response.data;
}
