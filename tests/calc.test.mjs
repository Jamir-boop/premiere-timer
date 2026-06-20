import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeExpiry,
  formatDuration,
  getActiveDurationDays,
  getBadgeInfo,
  getPremierRankInfo,
  normalizeRating
} from "../src/lib/calc.js";

describe("rating tiers", () => {
  it("maps known boundaries", () => {
    assert.equal(getActiveDurationDays(0), 30);
    assert.equal(getActiveDurationDays(2199), 30);
    assert.equal(getActiveDurationDays(2200), 29);
    assert.equal(getActiveDurationDays(11200), 21);
    assert.equal(getActiveDurationDays(11201), 20);
    assert.equal(getActiveDurationDays(23298), 9);
    assert.equal(getActiveDurationDays(23299), 8);
  });

  it("normalizes formatted ratings", () => {
    assert.equal(normalizeRating("14,250"), 14250);
  });

  it("maps Premier rank backgrounds", () => {
    assert.equal(getPremierRankInfo(0).key, "common");
    assert.equal(getPremierRankInfo(5000).key, "uncommon");
    assert.equal(getPremierRankInfo(10000).key, "rare");
    assert.equal(getPremierRankInfo(15000).key, "mythical");
    assert.equal(getPremierRankInfo(24575).key, "ancient");
    assert.equal(getPremierRankInfo(30000).key, "unusual");
    assert.equal(getPremierRankInfo(null), null);
  });
});

describe("expiry calculation", () => {
  it("subtracts 25h safety window from estimated expiry", () => {
    const result = computeExpiry(
      "2026-05-01T00:00:00.000Z",
      23299,
      new Date("2026-05-01T00:00:00.000Z")
    );

    assert.equal(result.activeDays, 8);
    assert.equal(result.expirationAtEstimate, "2026-05-09T00:00:00.000Z");
    assert.equal(result.playBeforeAt, "2026-05-07T23:00:00.000Z");
  });
});

describe("formatting and badge", () => {
  it("formats small durations for badges", () => {
    assert.equal(formatDuration(59 * 60 * 1000), "59m");
    assert.equal(formatDuration(23 * 60 * 60 * 1000), "23h");
    assert.equal(formatDuration(24 * 60 * 60 * 1000), "1d");
    assert.equal(formatDuration(3 * 24 * 60 * 60 * 1000), "3d");
  });

  it("shows RATE when latest match needs rating update", () => {
    const badge = getBadgeInfo({
      latestPremierMatchAt: "2026-05-01T00:00:00.000Z",
      currentRating: 10000,
      ratingNeedsUpdate: true
    });
    assert.equal(badge.text, "RATE");
  });
});
