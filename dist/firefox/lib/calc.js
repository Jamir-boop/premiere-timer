export const SAFETY_MARGIN_HOURS = 25;

export const RATING_TIERS = [
  { min: 0, max: 2199, days: 30 },
  { min: 2200, max: 3199, days: 29 },
  { min: 3200, max: 4199, days: 28 },
  { min: 4200, max: 5199, days: 27 },
  { min: 5200, max: 6199, days: 26 },
  { min: 6200, max: 7199, days: 25 },
  { min: 7200, max: 8199, days: 24 },
  { min: 8200, max: 9199, days: 23 },
  { min: 9200, max: 10199, days: 22 },
  { min: 10200, max: 11200, days: 21 },
  { min: 11201, max: 12199, days: 20 },
  { min: 12200, max: 13199, days: 19 },
  { min: 13200, max: 14298, days: 18 },
  { min: 14299, max: 15298, days: 17 },
  { min: 15299, max: 16298, days: 16 },
  { min: 16299, max: 17298, days: 15 },
  { min: 17299, max: 18298, days: 14 },
  { min: 18299, max: 19298, days: 13 },
  { min: 19299, max: 20298, days: 12 },
  { min: 20299, max: 21298, days: 11 },
  { min: 21299, max: 22298, days: 10 },
  { min: 22299, max: 23298, days: 9 },
  { min: 23299, max: Number.POSITIVE_INFINITY, days: 8 }
];

export function normalizeRating(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const rating = Number.parseInt(String(value).replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(rating) || rating < 0 || rating > 99999) {
    throw new Error("CS Rating must be a number from 0 to 99999.");
  }
  return rating;
}

export function getActiveDurationDays(ratingValue) {
  const rating = normalizeRating(ratingValue);
  if (rating === null) {
    return null;
  }

  const tier = RATING_TIERS.find((entry) => rating >= entry.min && rating <= entry.max);
  return tier ? tier.days : 8;
}

export function computeExpiry(latestPremierMatchAt, ratingValue, now = new Date()) {
  const activeDays = getActiveDurationDays(ratingValue);
  if (!latestPremierMatchAt || activeDays === null) {
    return null;
  }

  const latest = new Date(latestPremierMatchAt);
  if (Number.isNaN(latest.getTime())) {
    throw new Error("Latest Premier match time is invalid.");
  }

  const expirationAt = new Date(latest.getTime() + activeDays * 24 * 60 * 60 * 1000);
  const playBeforeAt = new Date(expirationAt.getTime() - SAFETY_MARGIN_HOURS * 60 * 60 * 1000);
  const msUntilPlayBefore = playBeforeAt.getTime() - now.getTime();

  return {
    activeDays,
    expirationAtEstimate: expirationAt.toISOString(),
    playBeforeAt: playBeforeAt.toISOString(),
    msUntilPlayBefore
  };
}

export function getTimerState(state, now = new Date()) {
  if (!state?.latestPremierMatchAt || state.currentRating === null || state.currentRating === undefined) {
    return { level: "unknown", label: "Missing data" };
  }

  if (state.ratingNeedsUpdate) {
    return { level: "stale_rating", label: "Update rating" };
  }

  const expiry = computeExpiry(state.latestPremierMatchAt, state.currentRating, now);
  if (!expiry) {
    return { level: "unknown", label: "Missing data" };
  }

  const hours = expiry.msUntilPlayBefore / (60 * 60 * 1000);
  if (hours <= 0) {
    return { level: "expired", label: "Past safe play window", expiry };
  }
  if (hours <= 24) {
    return { level: "urgent", label: "Under 24h", expiry };
  }
  if (hours <= 72) {
    return { level: "warning", label: "Under 72h", expiry };
  }
  return { level: "ok", label: "On track", expiry };
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms)) {
    return "unknown";
  }
  if (ms <= 0) {
    return "expired";
  }

  const minutes = Math.ceil(ms / (60 * 1000));
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.ceil(minutes / 60);
  if (hours < 48) {
    return `${hours}h`;
  }

  const days = Math.ceil(hours / 24);
  return `${days}d`;
}

export function getBadgeInfo(state, now = new Date()) {
  const timer = getTimerState(state, now);
  if (timer.level === "unknown") {
    return { text: "?", color: "#6b7280", title: "Missing data" };
  }
  if (timer.level === "stale_rating") {
    return { text: "RATE", color: "#f59e0b", title: "Update CS Rating after latest match" };
  }
  if (timer.level === "expired") {
    return { text: "EXP", color: "#dc2626", title: "Past safe play window" };
  }

  const text = formatDuration(timer.expiry.msUntilPlayBefore).slice(0, 4);
  const colors = {
    ok: "#15803d",
    warning: "#f59e0b",
    urgent: "#dc2626"
  };
  return {
    text,
    color: colors[timer.level] ?? "#6b7280",
    title: timer.label
  };
}

export function withDerivedExpiry(state, now = new Date()) {
  const expiry = computeExpiry(state.latestPremierMatchAt, state.currentRating, now);
  if (!expiry) {
    return {
      ...state,
      activeDays: null,
      expirationAtEstimate: null,
      playBeforeAt: null
    };
  }

  return {
    ...state,
    activeDays: expiry.activeDays,
    expirationAtEstimate: expiry.expirationAtEstimate,
    playBeforeAt: expiry.playBeforeAt
  };
}
