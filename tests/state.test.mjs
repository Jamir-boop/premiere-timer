import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STATE, mergeState } from "../extension/lib/state.js";

describe("state config", () => {
  it("enables badge counter by default", () => {
    assert.equal(DEFAULT_STATE.badgeCounterEnabled, true);
    assert.equal(DEFAULT_STATE.remindersEnabled, false);
    assert.equal(DEFAULT_STATE.safeReminderSentFor, null);
    assert.equal(DEFAULT_STATE.expiryReminderSentFor, null);
    assert.equal(DEFAULT_STATE.languagePreference, "auto");
    assert.equal(mergeState({}).badgeCounterEnabled, true);
    assert.equal(mergeState({}).remindersEnabled, false);
    assert.equal(mergeState({}).languagePreference, "auto");
  });

  it("preserves disabled badge counter config", () => {
    assert.equal(mergeState({ badgeCounterEnabled: false }).badgeCounterEnabled, false);
  });

  it("preserves selected language config", () => {
    assert.equal(mergeState({ languagePreference: "es" }).languagePreference, "es");
  });
});
