import { withDerivedExpiry } from "./calc.js";
import { LANGUAGE_AUTO } from "./i18n.js";

export const GCPD_MATCH_URL = "https://steamcommunity.com/my/gcpd/730/?tab=matchhistorypremier&l=english";
export const GCPD_MATCHMAKING_URL = "https://steamcommunity.com/my/gcpd/730/?tab=matchmaking&l=english";
export const STEAM_ORIGIN = "https://steamcommunity.com/*";
export const REFRESH_ALARM = "steam-gcpd-refresh";
export const REFRESH_PERIOD_MINUTES = 360;
export const DEFAULT_THEME = {
  themeAccentColor: "#FFB900"
};
export const DEFAULT_CONFIG = {
  badgeCounterEnabled: true,
  remindersEnabled: false,
  languagePreference: LANGUAGE_AUTO
};

export const DEFAULT_STATE = {
  currentRating: null,
  ratingSource: null,
  ratingUpdatedAt: null,
  ratingNeedsUpdate: false,
  premierWins: null,
  latestPremierMatchAt: null,
  latestPremierMatchSource: null,
  lastFetchAt: null,
  lastFetchStatus: "never",
  lastFetchError: null,
  latestMatchStatus: "never",
  ratingStatus: "never",
  activeDays: null,
  expirationAtEstimate: null,
  playBeforeAt: null,
  safeReminderSentFor: null,
  expiryReminderSentFor: null,
  ...DEFAULT_CONFIG,
  ...DEFAULT_THEME
};

export function mergeState(raw) {
  return { ...DEFAULT_STATE, ...(raw || {}) };
}

export function applyPatch(state, patch, now = new Date()) {
  return withDerivedExpiry({ ...mergeState(state), ...patch }, now);
}

export function applyLatestMatch(state, latestPremierMatchAt, source, now = new Date()) {
  const current = mergeState(state);
  const nextTime = new Date(latestPremierMatchAt).getTime();
  const oldTime = current.latestPremierMatchAt ? new Date(current.latestPremierMatchAt).getTime() : null;
  const newestMatchChanged = Number.isFinite(nextTime) && oldTime !== null && nextTime > oldTime + 60 * 1000;

  return applyPatch(
    current,
    {
      latestPremierMatchAt,
      latestPremierMatchSource: source,
      ratingNeedsUpdate: newestMatchChanged ? true : current.ratingNeedsUpdate
    },
    now
  );
}

export function applyRating(state, rating, source = "manual", now = new Date()) {
  return applyPatch(
    state,
    {
      currentRating: rating,
      ratingSource: source,
      ratingUpdatedAt: now.toISOString(),
      ratingNeedsUpdate: false,
      premierWins: null
    },
    now
  );
}
