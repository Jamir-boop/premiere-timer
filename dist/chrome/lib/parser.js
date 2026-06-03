const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};

const MONTH_PATTERN = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

export function extractSteamGcpdLoadMoreState(html) {
  if (!html || typeof html !== "string") {
    return null;
  }

  const hasLoadMore =
    /\bid\s*=\s*["']?load_more_clickable["']?/i.test(html) ||
    /\bElementsContainerHistory_LoadMore\s*\(/.test(html);
  const continueToken = extractJsStringValue(html, "g_sGcContinueToken");
  const sessionId = extractJsStringValue(html, "g_sessionID");

  if (!hasLoadMore || !continueToken || !sessionId) {
    return null;
  }

  return { continueToken, sessionId };
}

export function parseSteamGcpdMatchHistory(html, now = new Date()) {
  if (!html || typeof html !== "string") {
    return { status: "empty", latestPremierMatchAt: null, candidates: [] };
  }

  if (looksLoggedOut(html)) {
    return { status: "needs_login", latestPremierMatchAt: null, candidates: [] };
  }

  const text = htmlToText(html);
  const candidates = extractDateCandidates(text, now)
    .filter((date) => date.getTime() <= now.getTime() + 24 * 60 * 60 * 1000)
    .sort((left, right) => right.getTime() - left.getTime());

  if (candidates.length === 0) {
    return { status: "no_premier_matches", latestPremierMatchAt: null, candidates: [] };
  }

  return {
    status: "ok",
    latestPremierMatchAt: candidates[0].toISOString(),
    candidates: candidates.map((date) => date.toISOString())
  };
}

export function parseSteamGcpdMatchmakingRating(html) {
  if (!html || typeof html !== "string") {
    return { status: "rating_not_found", currentRating: null };
  }

  if (looksLoggedOut(html)) {
    return { status: "needs_login", currentRating: null };
  }

  const tableRating = extractPremierSkillGroupFromMatchmakingTable(html);
  if (tableRating.foundTable) {
    return tableRating.currentRating === null
      ? { status: "rating_not_found", currentRating: null }
      : { status: "ok", currentRating: tableRating.currentRating };
  }

  const blocks = extractHtmlTextBlocks(html);
  if (blocks.length > 0) {
    for (const block of blocks) {
      const rating = extractRatingNearSkillGroupLabel(block);
      if (rating !== null) {
        return { status: "ok", currentRating: rating };
      }
    }
    return { status: "rating_not_found", currentRating: null };
  }

  const rating = extractRatingNearSkillGroupLabel(htmlToText(html));
  if (rating !== null) {
    return { status: "ok", currentRating: rating };
  }

  return { status: "rating_not_found", currentRating: null };
}

export function looksLoggedOut(html) {
  const lower = html.toLowerCase();
  return (
    lower.includes("steamlogin") ||
    lower.includes("global_action_link") && lower.includes(">login<") ||
    lower.includes("sign in to your steam account") ||
    lower.includes("login_btn_signin") ||
    lower.includes("id=\"loginform\"")
  );
}

export function htmlToText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(?:td|th|tr|div|p|li|span|h\d)>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

export function extractDateCandidates(text, now = new Date()) {
  const candidates = [];
  const normalized = text.replace(/\s+/g, " ");

  collectSteamTimestampDates(normalized, candidates);
  collectDayMonthDates(normalized, now, candidates);
  collectMonthDayDates(normalized, now, candidates);
  collectNumericDates(normalized, now, candidates);
  collectIsoDates(normalized, candidates);

  return dedupeDates(candidates);
}

function collectDayMonthDates(text, now, candidates) {
  const re = new RegExp(
    `\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\w*\\.?[,]?\\s*(\\d{4})?\\s*(?:@|at|,)?\\s*(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*(am|pm)?\\s*(GMT|UTC|Z|[+-]\\d{2}:?\\d{2})?\\b`,
    "gi"
  );
  for (const match of text.matchAll(re)) {
    const date = buildDate({
      day: match[1],
      monthIndex: monthIndex(match[2]),
      year: match[3],
      hour: match[4],
      minute: match[5],
      second: match[6],
      ampm: match[7],
      zone: match[8],
      now
    });
    if (date) {
      candidates.push(date);
    }
  }
}

function collectMonthDayDates(text, now, candidates) {
  const re = new RegExp(
    `\\b(${MONTH_PATTERN})\\w*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s*(\\d{4})?\\s*(?:@|at|,)?\\s*(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*(am|pm)?\\s*(GMT|UTC|Z|[+-]\\d{2}:?\\d{2})?\\b`,
    "gi"
  );
  for (const match of text.matchAll(re)) {
    const date = buildDate({
      day: match[2],
      monthIndex: monthIndex(match[1]),
      year: match[3],
      hour: match[4],
      minute: match[5],
      second: match[6],
      ampm: match[7],
      zone: match[8],
      now
    });
    if (date) {
      candidates.push(date);
    }
  }
}

function collectNumericDates(text, now, candidates) {
  const re = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*,?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?\s*(GMT|UTC|Z|[+-]\d{2}:?\d{2})?\b/gi;
  for (const match of text.matchAll(re)) {
    let year = Number.parseInt(match[3], 10);
    if (year < 100) {
      year += 2000;
    }

    const date = buildDate({
      day: match[2],
      monthIndex: Number.parseInt(match[1], 10) - 1,
      year: String(year),
      hour: match[4],
      minute: match[5],
      second: match[6],
      ampm: match[7],
      zone: match[8],
      now
    });
    if (date) {
      candidates.push(date);
    }
  }
}

function collectSteamTimestampDates(text, candidates) {
  const re = /\b(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(GMT|UTC|Z|[+-]\d{2}:?\d{2})\b/gi;
  for (const match of text.matchAll(re)) {
    const date = buildDate({
      day: match[3],
      monthIndex: Number.parseInt(match[2], 10) - 1,
      year: match[1],
      hour: match[4],
      minute: match[5],
      second: match[6],
      zone: match[7],
      now: new Date()
    });
    if (date) {
      candidates.push(date);
    }
  }
}

function collectIsoDates(text, candidates) {
  const re = /\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?(?:Z|[+-]\d{2}:?\d{2})?)\b/g;
  for (const match of text.matchAll(re)) {
    const date = new Date(match[1]);
    if (!Number.isNaN(date.getTime())) {
      candidates.push(date);
    }
  }
}

function buildDate({ day, monthIndex, year, hour, minute, second = "0", ampm, zone, now }) {
  const dayNumber = Number.parseInt(day, 10);
  const hourNumber = to24Hour(Number.parseInt(hour, 10), ampm);
  const minuteNumber = Number.parseInt(minute, 10);
  const secondNumber = Number.parseInt(second || "0", 10);
  const yearNumber = year ? Number.parseInt(year, 10) : now.getFullYear();

  if (
    !Number.isInteger(dayNumber) ||
    !Number.isInteger(monthIndex) ||
    !Number.isInteger(yearNumber) ||
    !Number.isInteger(hourNumber) ||
    !Number.isInteger(minuteNumber) ||
    !Number.isInteger(secondNumber)
  ) {
    return null;
  }

  const date = zone
    ? buildZonedDate(yearNumber, monthIndex, dayNumber, hourNumber, minuteNumber, secondNumber, zone)
    : new Date(yearNumber, monthIndex, dayNumber, hourNumber, minuteNumber, secondNumber, 0);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (!year && date.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
    date.setFullYear(date.getFullYear() - 1);
  }

  return date;
}

function buildZonedDate(year, monthIndex, day, hour, minute, second, zone) {
  const offsetMinutes = parseZoneOffsetMinutes(zone);
  if (offsetMinutes === null) {
    return new Date(Number.NaN);
  }

  const utcTime = Date.UTC(year, monthIndex, day, hour, minute, second, 0) - offsetMinutes * 60 * 1000;
  return new Date(utcTime);
}

function parseZoneOffsetMinutes(zone) {
  const normalized = String(zone || "").toUpperCase();
  if (normalized === "GMT" || normalized === "UTC" || normalized === "Z") {
    return 0;
  }

  const match = normalized.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[2], 10);
  const minutes = Number.parseInt(match[3], 10);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  const offset = hours * 60 + minutes;
  return match[1] === "-" ? -offset : offset;
}

function monthIndex(value) {
  return MONTHS[String(value).toLowerCase().replace(".", "")];
}

function to24Hour(hour, ampm) {
  if (!ampm) {
    return hour;
  }

  const lower = ampm.toLowerCase();
  if (lower === "am") {
    return hour === 12 ? 0 : hour;
  }
  return hour === 12 ? 12 : hour + 12;
}

function dedupeDates(dates) {
  const byTime = new Map();
  for (const date of dates) {
    if (!Number.isNaN(date.getTime())) {
      byTime.set(date.getTime(), date);
    }
  }
  return [...byTime.values()];
}

function extractHtmlTextBlocks(html) {
  const blocks = [];
  const cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const blockRe = /<(tr|li|p|section|article|div)\b[^>]*>[\s\S]*?<\/\1>/gi;

  for (const match of cleaned.matchAll(blockRe)) {
    const text = htmlToText(match[0]);
    if (SKILL_GROUP_LABEL_RE.test(text)) {
      blocks.push(text);
    }
  }

  return blocks;
}

function extractPremierSkillGroupFromMatchmakingTable(html) {
  const rows = extractTableRows(html);
  if (rows.length === 0) {
    return { foundTable: false, currentRating: null };
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const headers = rows[rowIndex].cells.map(normalizeTableCell);
    const modeIndex = headers.indexOf("matchmaking mode");
    const skillGroupIndex = headers.indexOf("skill group");
    if (modeIndex === -1 && skillGroupIndex === -1) {
      continue;
    }
    if (modeIndex === -1 || skillGroupIndex === -1) {
      return { foundTable: true, currentRating: null };
    }

    for (const row of rows.slice(rowIndex + 1)) {
      if (normalizeTableCell(row.cells[modeIndex]) !== "premier") {
        continue;
      }

      return {
        foundTable: true,
        currentRating: parseStrictRatingValue(row.cells[skillGroupIndex])
      };
    }

    return { foundTable: true, currentRating: null };
  }

  return { foundTable: false, currentRating: null };
}

function extractTableRows(html) {
  const rows = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi;

  for (const rowMatch of html.matchAll(rowRe)) {
    const cells = [...rowMatch[1].matchAll(cellRe)].map((cellMatch) => htmlToText(cellMatch[1]));
    if (cells.length > 0) {
      rows.push({ cells });
    }
  }

  return rows;
}

function normalizeTableCell(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function parseStrictRatingValue(value) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(?:\d{1,2},\d{3}|\d{4,5})$/);
  if (!match) {
    return null;
  }

  const rating = Number.parseInt(normalized.replace(/,/g, ""), 10);
  return rating >= 1000 && rating <= 99999 ? rating : null;
}

const SKILL_GROUP_LABEL_RE = /\bpremi(?:er|ere)\s+skill\s+group\b/i;

function extractRatingNearSkillGroupLabel(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const labelMatches = [...normalized.matchAll(new RegExp(SKILL_GROUP_LABEL_RE, "gi"))];
  if (labelMatches.length === 0) {
    return null;
  }

  const numbers = extractStrictRatingNumbers(normalized);
  if (numbers.length === 0) {
    return null;
  }

  let best = null;
  for (const label of labelMatches) {
    const labelStart = label.index;
    const labelEnd = label.index + label[0].length;
    for (const number of numbers) {
      const beforeDistance = labelStart - (number.index + number.raw.length);
      const afterDistance = number.index - labelEnd;
      const distance = number.index >= labelEnd ? afterDistance : beforeDistance;
      const isAfter = number.index >= labelEnd;
      if (distance < 0) {
        continue;
      }
      if (
        best === null ||
        distance < best.distance ||
        distance === best.distance && isAfter && !best.isAfter
      ) {
        best = { ...number, distance, isAfter };
      }
    }
  }

  return best ? best.value : null;
}

function extractStrictRatingNumbers(text) {
  const ratings = [];
  const numberRe = /(^|[^\d.])((?:\d{1,2},\d{3})|\d{4,5})(?![\d.])/g;

  for (const match of text.matchAll(numberRe)) {
    const raw = match[2];
    const value = Number.parseInt(raw.replace(/,/g, ""), 10);
    if (value >= 1000 && value <= 99999) {
      ratings.push({
        raw,
        value,
        index: match.index + match[1].length
      });
    }
  }

  return ratings;
}

function extractJsStringValue(html, name) {
  const safeName = escapeRegExp(name);
  const match = html.match(new RegExp(`\\b(?:var\\s+)?${safeName}\\s*=\\s*(['"])([\\s\\S]*?)\\1`));
  return match ? decodeJsStringLiteral(match[2]) : null;
}

function decodeJsStringLiteral(value) {
  return String(value || "")
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\(['"\\])/g, "$1");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
