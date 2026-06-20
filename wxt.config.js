import { defineConfig } from "wxt";

const GOOGLE_FONTS_CSP =
  "script-src 'self'; object-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;";

const ICONS = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  64: "icons/icon-64.png",
  96: "icons/icon-96.png",
  128: "icons/icon-128.png"
};

export default defineConfig({
  imports: false,
  manifest: ({ browser }) => ({
    browser_specific_settings: browser === "firefox"
      ? {
          gecko: {
            id: "premiere-reminder@superuser.example.com",
            data_collection_permissions: {
              required: ["none"]
            }
          }
        }
      : undefined,
    commands: {
      _execute_action: {
        description: "__MSG_commandOpenPopup__"
      },
      "open-sidebar": {
        description: "__MSG_commandOpenSidebar__"
      }
    },
    content_security_policy: {
      extension_pages: GOOGLE_FONTS_CSP
    },
    default_locale: "en",
    description: "__MSG_extDescription__",
    host_permissions: ["https://steamcommunity.com/*"],
    icons: ICONS,
    minimum_chrome_version: browser === "chrome" ? "121" : undefined,
    name: "__MSG_extName__",
    optional_permissions: ["notifications"],
    permissions: browser === "chrome"
      ? ["activeTab", "alarms", "scripting", "storage", "sidePanel"]
      : ["activeTab", "alarms", "scripting", "storage"]
  }),
  manifestVersion: 3,
  publicDir: "public",
  srcDir: "src",
  targetBrowsers: ["chrome", "firefox"]
});
