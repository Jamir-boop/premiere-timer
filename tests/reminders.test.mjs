import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getReminderKey,
  getReminderPlan,
  REMINDER_OFFSET_MS
} from "../src/lib/reminders.js";

const BASE_STATE = {
  remindersEnabled: true,
  latestPremierMatchAt: "2026-05-01T00:00:00.000Z",
  currentRating: 12000,
  playBeforeAt: "2026-05-07T23:00:00.000Z",
  expirationAtEstimate: "2026-05-09T00:00:00.000Z",
  safeReminderSentFor: null,
  expiryReminderSentFor: null
};

describe("reminders", () => {
  it("does nothing when reminders are disabled", () => {
    const plan = getReminderPlan({ ...BASE_STATE, remindersEnabled: false }, "safe");
    assert.equal(plan.action, "none");
    assert.equal(plan.reason, "disabled");
  });

  it("schedules safe reminder 24h before playBeforeAt", () => {
    const plan = getReminderPlan(BASE_STATE, "safe", new Date("2026-05-06T22:59:00.000Z"));
    assert.equal(plan.action, "schedule");
    assert.equal(plan.reminderAtMs, new Date(BASE_STATE.playBeforeAt).getTime() - REMINDER_OFFSET_MS);
  });

  it("notifies when safe reminder window is reached", () => {
    const plan = getReminderPlan(BASE_STATE, "safe", new Date("2026-05-06T23:00:00.000Z"));
    assert.equal(plan.action, "notify");
    assert.equal(plan.deadlineAt, BASE_STATE.playBeforeAt);
  });

  it("notifies when expiry reminder window is reached", () => {
    const plan = getReminderPlan(BASE_STATE, "expiry", new Date("2026-05-08T00:00:00.000Z"));
    assert.equal(plan.action, "notify");
    assert.equal(plan.deadlineAt, BASE_STATE.expirationAtEstimate);
  });

  it("does not notify when current key was already sent", () => {
    const key = getReminderKey(BASE_STATE, "safe");
    const plan = getReminderPlan(
      { ...BASE_STATE, safeReminderSentFor: key },
      "safe",
      new Date("2026-05-06T23:00:00.000Z")
    );

    assert.equal(plan.action, "none");
    assert.equal(plan.reason, "sent");
  });

  it("does not notify after deadline passed", () => {
    const plan = getReminderPlan(BASE_STATE, "safe", new Date("2026-05-08T00:00:00.000Z"));
    assert.equal(plan.action, "none");
    assert.equal(plan.reason, "deadline_passed");
  });

  it("changes reminder key when rating changes", () => {
    assert.notEqual(
      getReminderKey(BASE_STATE, "safe"),
      getReminderKey({ ...BASE_STATE, currentRating: 13000 }, "safe")
    );
  });
});
