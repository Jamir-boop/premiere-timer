import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const GOOGLE_FONTS_CSP = "script-src 'self'; object-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;";
const wxtCli = path.join(process.cwd(), "node_modules", "wxt", "bin", "wxt.mjs");
const outputDir = ".output";
const chromeOutputDir = path.join(outputDir, "chrome-mv3");
const firefoxOutputDir = path.join(outputDir, "firefox-mv3");
const packageVersion = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const ICONS = {
  "16": "icons/icon-16.png",
  "32": "icons/icon-32.png",
  "48": "icons/icon-48.png",
  "64": "icons/icon-64.png",
  "96": "icons/icon-96.png",
  "128": "icons/icon-128.png"
};
const ACTION_ICONS = {
  "16": "icons/icon-16.png",
  "32": "icons/icon-32.png",
  "48": "icons/icon-48.png",
  "128": "icons/icon-128.png"
};

let builtOutputs = null;

function buildOutputs() {
  if (builtOutputs) {
    return builtOutputs;
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  execFileSync(process.execPath, [wxtCli, "build", "--browser", "chrome"], { stdio: "pipe" });
  execFileSync(process.execPath, [wxtCli, "build", "--browser", "firefox"], { stdio: "pipe" });

  builtOutputs = {
    chromeManifest: JSON.parse(fs.readFileSync(path.join(chromeOutputDir, "manifest.json"), "utf8")),
    firefoxManifest: JSON.parse(fs.readFileSync(path.join(firefoxOutputDir, "manifest.json"), "utf8"))
  };
  return builtOutputs;
}

after(() => {
  fs.rmSync(outputDir, { recursive: true, force: true });
});

function assertCommonManifest(manifest) {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.default_locale, "en");
  assert.equal(manifest.name, "__MSG_extName__");
  assert.equal(manifest.version, packageVersion);
  assert.equal(manifest.description, "__MSG_extDescription__");
  assert.deepEqual(manifest.icons, ICONS);
  assert.deepEqual(manifest.optional_permissions, ["notifications"]);
  assert.deepEqual(manifest.host_permissions, ["https://steamcommunity.com/*"]);
  assert.equal(manifest.content_security_policy.extension_pages, GOOGLE_FONTS_CSP);
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.equal(manifest.action.default_title, "__MSG_actionDefaultTitle__");
  assert.deepEqual(manifest.action.default_icon, ACTION_ICONS);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.commands._execute_action.description, "__MSG_commandOpenPopup__");
  assert.equal(manifest.commands["open-sidebar"].description, "__MSG_commandOpenSidebar__");
  assert.equal(manifest.commands._execute_action.suggested_key, undefined);
  assert.equal(manifest.commands["open-sidebar"].suggested_key, undefined);
}

describe("manifest", () => {
  it("builds Chrome MV3 manifest with popup and side panel", () => {
    const { chromeManifest: manifest } = buildOutputs();

    assertCommonManifest(manifest);
    assert.deepEqual(manifest.permissions.sort(), ["activeTab", "alarms", "scripting", "sidePanel", "storage"]);
    assert.equal(manifest.optional_host_permissions, undefined);
    assert.equal(manifest.minimum_chrome_version, "121");
    assert.equal(manifest.side_panel.default_path, "popup.html");
    assert.equal(manifest.background.service_worker, "background.js");
    assert.equal(manifest.background.type, "module");
    assert.equal(manifest.background.scripts, undefined);
    assert.equal(manifest.sidebar_action, undefined);
  });

  it("builds Firefox MV3 manifest with sidebar_action", () => {
    const { firefoxManifest: manifest } = buildOutputs();

    assertCommonManifest(manifest);
    assert.deepEqual(manifest.permissions.sort(), ["activeTab", "alarms", "scripting", "storage"]);
    assert.equal(manifest.permissions.includes("sidePanel"), false);
    assert.equal(manifest.sidebar_action.default_panel, "popup.html");
    assert.equal(manifest.sidebar_action.default_title, "__MSG_actionDefaultTitle__");
    assert.deepEqual(manifest.sidebar_action.default_icon, ACTION_ICONS);
    assert.equal(manifest.side_panel, undefined);
    assert.deepEqual(manifest.background.scripts, ["background.js"]);
    assert.equal(manifest.background.type, "module");
    assert.equal(manifest.background.service_worker, undefined);
    assert.deepEqual(manifest.browser_specific_settings, {
      gecko: {
        id: "premiere-reminder@superuser.example.com",
        data_collection_permissions: {
          required: ["none"]
        }
      }
    });
  });

  it("emits required built files without static content_scripts", () => {
    const { chromeManifest, firefoxManifest } = buildOutputs();
    const expectedFiles = [
      path.join(chromeOutputDir, "popup.html"),
      path.join(chromeOutputDir, "background.js"),
      path.join(chromeOutputDir, "content-gcpd.js"),
      path.join(chromeOutputDir, "icons", "icon-128.png"),
      path.join(chromeOutputDir, "_locales", "en", "messages.json"),
      path.join(chromeOutputDir, "_locales", "es", "messages.json"),
      path.join(firefoxOutputDir, "popup.html"),
      path.join(firefoxOutputDir, "background.js"),
      path.join(firefoxOutputDir, "content-gcpd.js"),
      path.join(firefoxOutputDir, "icons", "icon-128.png"),
      path.join(firefoxOutputDir, "_locales", "en", "messages.json"),
      path.join(firefoxOutputDir, "_locales", "es", "messages.json")
    ];

    for (const file of expectedFiles) {
      assert.equal(fs.existsSync(file), true, `Missing build file: ${file}`);
    }

    assert.equal(path.basename(chromeManifest.background.service_worker), "background.js");
    assert.deepEqual(firefoxManifest.background.scripts, ["background.js"]);
  });
});
