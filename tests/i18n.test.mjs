import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createTranslator,
  MESSAGES,
  normalizeLanguagePreference,
  resolveLanguage
} from "../extension/lib/i18n.js";

describe("i18n", () => {
  it("detects Spanish browser languages", () => {
    assert.equal(resolveLanguage("auto", ["es-CO"]), "es");
    assert.equal(resolveLanguage("auto", ["es-ES"]), "es");
  });

  it("falls back to English for unsupported browser languages", () => {
    assert.equal(resolveLanguage("auto", ["fr-FR"]), "en");
  });

  it("uses manual language override before browser language", () => {
    assert.equal(resolveLanguage("en", ["es-CO"]), "en");
    assert.equal(resolveLanguage("es", ["en-US"]), "es");
  });

  it("normalizes invalid language preference to auto", () => {
    assert.equal(normalizeLanguagePreference("fr"), "auto");
    assert.equal(normalizeLanguagePreference(null), "auto");
  });

  it("keeps English and Spanish runtime dictionaries in sync", () => {
    assert.deepEqual(Object.keys(MESSAGES.es).sort(), Object.keys(MESSAGES.en).sort());
  });

  it("formats translated messages with values", () => {
    const translator = createTranslator("es", ["en-US"]);
    assert.equal(translator.t("playBefore", { value: "1:00" }), "Juega Premier antes de 1:00");
  });

  it("defines keys referenced by UI markup and controller", () => {
    const files = [
      "extension/popup.html",
      "extension/sidebar.html",
      "extension/popup.js",
      "extension/background.js"
    ];

    const keys = new Set();
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const match of content.matchAll(/data-i18n(?:-aria-label|-title)?="([^"]+)"/g)) {
        keys.add(match[1]);
      }
      for (const match of content.matchAll(/(?:\bt|translator\.t)\("([^"]+)"/g)) {
        keys.add(match[1]);
      }
    }

    for (const key of keys) {
      assert.equal(typeof MESSAGES.en[key], "string", `Missing en key: ${key}`);
      assert.equal(typeof MESSAGES.es[key], "string", `Missing es key: ${key}`);
    }
  });
});
