import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const GOOGLE_FONTS_CSP = "script-src 'self'; object-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;";

describe("manifest", () => {
  it("uses Chrome MV3 service worker, popup, side panel, and empty commands", () => {
    const manifest = JSON.parse(fs.readFileSync("extension/manifest.json", "utf8"));

    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.default_locale, "en");
    assert.equal(manifest.name, "__MSG_extName__");
    assert.equal(manifest.description, "__MSG_extDescription__");
    assert.deepEqual(manifest.icons, {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "64": "icons/icon-64.png",
      "96": "icons/icon-96.png",
      "128": "icons/icon-128.png"
    });
    assert.deepEqual(manifest.permissions.sort(), ["activeTab", "alarms", "scripting", "sidePanel", "storage"]);
    assert.deepEqual(manifest.optional_permissions, ["notifications"]);
    assert.deepEqual(manifest.host_permissions, ["https://steamcommunity.com/*"]);
    assert.equal(manifest.optional_host_permissions, undefined);
    assert.equal(manifest.content_security_policy.extension_pages, GOOGLE_FONTS_CSP);
    assert.equal(manifest.action.default_popup, "popup.html");
    assert.equal(manifest.action.default_title, "__MSG_actionDefaultTitle__");
    assert.deepEqual(manifest.action.default_icon, {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    });
    assert.equal(manifest.side_panel.default_path, "sidebar.html");
    assert.equal(manifest.background.service_worker, "background.js");
    assert.equal(manifest.background.scripts, undefined);
    assert.equal(manifest.commands._execute_action.description, "__MSG_commandOpenPopup__");
    assert.equal(manifest.commands["open-sidebar"].description, "__MSG_commandOpenSidebar__");
    assert.equal(manifest.commands._execute_action.suggested_key, undefined);
    assert.equal(manifest.commands["open-sidebar"].suggested_key, undefined);
  });

  it("uses Firefox background scripts without Chrome sidePanel permission", () => {
    const manifest = JSON.parse(fs.readFileSync("extension/manifest.firefox.json", "utf8"));

    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.default_locale, "en");
    assert.equal(manifest.name, "__MSG_extName__");
    assert.equal(manifest.description, "__MSG_extDescription__");
    assert.deepEqual(manifest.icons, {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "64": "icons/icon-64.png",
      "96": "icons/icon-96.png",
      "128": "icons/icon-128.png"
    });
    assert.deepEqual(manifest.permissions.sort(), ["activeTab", "alarms", "scripting", "storage"]);
    assert.deepEqual(manifest.optional_permissions, ["notifications"]);
    assert.deepEqual(manifest.host_permissions, ["https://steamcommunity.com/*"]);
    assert.equal(manifest.content_security_policy.extension_pages, GOOGLE_FONTS_CSP);
    assert.equal(manifest.permissions.includes("sidePanel"), false);
    assert.equal(manifest.action.default_popup, "popup.html");
    assert.equal(manifest.action.default_title, "__MSG_actionDefaultTitle__");
    assert.deepEqual(manifest.action.default_icon, {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    });
    assert.equal(manifest.sidebar_action.default_panel, "sidebar.html");
    assert.equal(manifest.sidebar_action.default_title, "__MSG_actionDefaultTitle__");
    assert.deepEqual(manifest.sidebar_action.default_icon, {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    });
    assert.equal(manifest.side_panel, undefined);
    assert.deepEqual(manifest.background.scripts, ["background.js"]);
    assert.equal(manifest.background.service_worker, undefined);
    assert.equal(manifest.commands._execute_action.suggested_key, undefined);
    assert.equal(manifest.commands["open-sidebar"].suggested_key, undefined);
    assert.deepEqual(manifest.browser_specific_settings, {
      gecko: {
        id: "premiere-reminder@superuser.example.com",
        data_collection_permissions: {
          required: ["none"]
        }
      }
    });
  });

  it("builds Chrome and Firefox extension outputs", () => {
    execFileSync(process.execPath, ["scripts/build-extension.mjs"], { stdio: "pipe" });

    const chromeManifest = JSON.parse(fs.readFileSync("dist/chrome/manifest.json", "utf8"));
    const firefoxManifest = JSON.parse(fs.readFileSync("dist/firefox/manifest.json", "utf8"));

    assert.equal(chromeManifest.background.service_worker, "background.js");
    assert.equal(chromeManifest.content_security_policy.extension_pages, GOOGLE_FONTS_CSP);
    assert.equal(chromeManifest.background.scripts, undefined);
    assert.equal(chromeManifest.side_panel.default_path, "sidebar.html");
    assert.deepEqual(firefoxManifest.background.scripts, ["background.js"]);
    assert.equal(firefoxManifest.content_security_policy.extension_pages, GOOGLE_FONTS_CSP);
    assert.equal(firefoxManifest.background.service_worker, undefined);
    assert.equal(firefoxManifest.sidebar_action.default_panel, "sidebar.html");
    assert.deepEqual(firefoxManifest.browser_specific_settings.gecko.data_collection_permissions.required, ["none"]);
    assert.equal(fs.existsSync("dist/chrome/popup.html"), true);
    assert.equal(fs.existsSync("dist/chrome/sidebar.html"), true);
    assert.equal(fs.existsSync("dist/chrome/icons/icon-128.png"), true);
    assert.equal(fs.existsSync("dist/chrome/_locales/en/messages.json"), true);
    assert.equal(fs.existsSync("dist/chrome/_locales/es/messages.json"), true);
    assert.equal(fs.existsSync("dist/firefox/popup.html"), true);
    assert.equal(fs.existsSync("dist/firefox/sidebar.html"), true);
    assert.equal(fs.existsSync("dist/firefox/icons/icon-128.png"), true);
    assert.equal(fs.existsSync("dist/firefox/_locales/en/messages.json"), true);
    assert.equal(fs.existsSync("dist/firefox/_locales/es/messages.json"), true);
  });
});
