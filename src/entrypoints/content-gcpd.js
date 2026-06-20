import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";

export default defineUnlistedScript(() => {
  if (globalThis.__cs2PremierExpiryContentLoaded) {
    return;
  }
  globalThis.__cs2PremierExpiryContentLoaded = true;

  const ext = globalThis.browser ?? globalThis.chrome;
  if (!ext?.runtime?.sendMessage) {
    return;
  }

  function getSupportedPageType(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== "steamcommunity.com" || !parsed.pathname.includes("/gcpd/730")) {
        return null;
      }

      const tab = parsed.searchParams.get("tab");
      if (tab === "matchhistorypremier" || tab === "matchmaking") {
        return tab;
      }
    } catch {
      return null;
    }

    return null;
  }

  function sendMessage(message) {
    const response = ext.runtime.sendMessage(message);
    if (response && typeof response.then === "function") {
      return response;
    }
    return Promise.resolve(response);
  }

  async function sendPageHtml() {
    if (!getSupportedPageType(location.href)) {
      return;
    }

    try {
      const response = await sendMessage({
        type: "steamGcpdPageHtml",
        source: "steam_gcpd_content",
        url: location.href,
        html: document.documentElement.outerHTML
      });

      if (response?.ok && response.data?.pageUpdated) {
        showToast();
      }
    } catch {
      // Content script must not disturb Steam pages.
    }
  }

  function showToast() {
    const oldToast = document.querySelector("#cs2-premier-expiry-toast");
    if (oldToast) {
      oldToast.remove();
    }

    const toast = document.createElement("div");
    toast.id = "cs2-premier-expiry-toast";
    toast.textContent = ext.i18n?.getMessage?.("toastUpdated") || "premiere-timer updated";
    Object.assign(toast.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "2147483647",
      padding: "10px 12px",
      border: "1px solid #664A00",
      borderRadius: "8px",
      background: "#000000",
      color: "#FFFFFF",
      boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
      font: "13px/1.3 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    });
    document.documentElement.append(toast);
    setTimeout(() => toast.remove(), 2400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sendPageHtml, { once: true });
  } else {
    sendPageHtml();
  }
});
