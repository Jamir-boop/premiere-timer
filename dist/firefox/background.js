import { getBadgeInfo, getTimerState, normalizeRating } from "./lib/calc.js";
import { ext, getStorage, hasApiPermission, hasPermission, setStorage } from "./lib/ext-api.js";
import { badgeTitle, createTranslator, getBrowserLanguageCandidates, normalizeLanguagePreference } from "./lib/i18n.js";
import { parseSteamGcpdMatchHistory, parseSteamGcpdMatchmakingRating } from "./lib/parser.js";
import {
  EXPIRY_REMINDER_ALARM,
  getReminderPlans,
  getReminderTypeByAlarm,
  SAFE_REMINDER_ALARM
} from "./lib/reminders.js";
import {
  applyLatestMatch,
  applyPatch,
  applyRating,
  DEFAULT_STATE,
  DEFAULT_THEME,
  DEFAULT_CONFIG,
  GCPD_MATCH_URL,
  GCPD_MATCHMAKING_URL,
  REFRESH_ALARM,
  REFRESH_PERIOD_MINUTES,
  STEAM_ORIGIN
} from "./lib/state.js";

const CONTENT_SCRIPT_ID = "steam-gcpd-auto-update";
const REPOSITORY_URL = "https://github.com/Jamir-boop/premiere-timer";
const NOTIFICATIONS_PERMISSION = "notifications";
const guidedTabs = new Map();

async function loadState() {
  return getStorage(DEFAULT_STATE);
}

async function saveState(state) {
  const next = await applyReminderSchedule(state);
  await setStorage(next);
  await updateBadge(next);
  return next;
}

async function updateBadge(state = null) {
  const current = state || await loadState();
  const badge = getBadgeInfo(current);
  const timer = getTimerState(current);
  const translator = createBackgroundTranslator(current);
  await ext.action.setBadgeText({ text: current.badgeCounterEnabled === false ? "" : badge.text });
  await ext.action.setBadgeBackgroundColor({ color: badge.color });
  await ext.action.setTitle({
    title: translator.t("actionTitleWithStatus", {
      status: badgeTitle(timer.level, translator)
    })
  });
}

function createBackgroundTranslator(state) {
  return createTranslator(
    state?.languagePreference,
    getBrowserLanguageCandidates([ext.i18n?.getUILanguage?.()])
  );
}

async function applyReminderSchedule(state, now = new Date()) {
  await clearReminderAlarms();

  if (!state.remindersEnabled) {
    return state;
  }

  if (!ext.notifications?.create || !await hasApiPermission(NOTIFICATIONS_PERMISSION).catch(() => false)) {
    return { ...state, remindersEnabled: false };
  }

  let next = state;
  const translator = createBackgroundTranslator(state);
  for (const plan of getReminderPlans(next, now)) {
    if (plan.action === "schedule") {
      await ext.alarms.create(plan.alarmName, { when: plan.reminderAtMs });
    }
    if (plan.action === "notify" && await sendReminderNotification(plan, translator)) {
      next = { ...next, [plan.sentField]: plan.key };
    }
  }
  return next;
}

async function clearReminderAlarms() {
  await Promise.all([
    ext.alarms.clear(SAFE_REMINDER_ALARM),
    ext.alarms.clear(EXPIRY_REMINDER_ALARM)
  ].map((operation) => operation.catch(() => false)));
}

async function applyReminderScheduleFromStorage() {
  const state = await loadState();
  const next = await applyReminderSchedule(state);
  if (next !== state) {
    await setStorage(next);
  }
  await updateBadge(next);
}

async function handleReminderAlarm(alarmName) {
  if (!getReminderTypeByAlarm(alarmName)) {
    return false;
  }
  await applyReminderScheduleFromStorage();
  return true;
}

async function sendReminderNotification(plan, translator) {
  const titleKey = plan.type === "safe" ? "safeReminderTitle" : "expiryReminderTitle";
  const messageKey = plan.type === "safe" ? "safeReminderMessage" : "expiryReminderMessage";
  const deadline = formatNotificationDate(plan.deadlineAt, translator.language);

  try {
    await ext.notifications.create(`premiere-timer-${plan.type}-${plan.deadlineAt}`, {
      type: "basic",
      iconUrl: "icons/icon-128.png",
      title: translator.t(titleKey),
      message: translator.t(messageKey, { date: deadline })
    });
    return true;
  } catch {
    return false;
  }
}

function formatNotificationDate(value, language) {
  return new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

async function openSidebar(windowId = null) {
  if (ext.sidePanel?.open) {
    const targetWindowId = windowId ?? await getLastFocusedWindowId();
    await ext.sidePanel.open(targetWindowId ? { windowId: targetWindowId } : {});
    return loadState();
  }

  if (ext.sidebarAction?.open) {
    await ext.sidebarAction.open();
    return loadState();
  }

  throw new Error("Sidebar is not available in this browser.");
}

async function getLastFocusedWindowId() {
  if (!ext.windows?.getLastFocused) {
    return null;
  }

  const window = await ext.windows.getLastFocused();
  return window?.id ?? null;
}

async function openShortcutSettings() {
  if (ext.commands?.openShortcutSettings) {
    await ext.commands.openShortcutSettings();
    return loadState();
  }

  try {
    await ext.tabs.create({ url: "chrome://extensions/shortcuts" });
  } catch {
    await ext.tabs.create({ url: "about:addons" });
  }
  return loadState();
}

function getSteamGcpdPageType(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "steamcommunity.com" || !parsed.pathname.includes("/gcpd/730")) {
      return null;
    }

    const tab = parsed.searchParams.get("tab");
    if (tab === "matchhistorypremier") {
      return "match_history";
    }
    if (tab === "matchmaking") {
      return "matchmaking";
    }
  } catch {
    return null;
  }

  return null;
}

async function ensureAlarm() {
  await ext.alarms.create(REFRESH_ALARM, {
    periodInMinutes: REFRESH_PERIOD_MINUTES,
    delayInMinutes: 1
  });
}

async function ensureContentScriptRegistration() {
  if (!await hasPermission(STEAM_ORIGIN)) {
    return false;
  }

  if (ext.scripting?.registerContentScripts) {
    await registerContentScript().catch(() => {});
  }

  await injectContentScriptIntoOpenGcpdTabs().catch(() => {});
  return true;
}

async function registerContentScript() {
  const baseScript = {
    id: CONTENT_SCRIPT_ID,
    matches: ["https://steamcommunity.com/*"],
    js: ["content-gcpd.js"],
    runAt: "document_idle"
  };

  if (ext.scripting.getRegisteredContentScripts) {
    const existing = await ext.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] });
    if (existing.length > 0) {
      return;
    }
  }

  try {
    await ext.scripting.registerContentScripts([{ ...baseScript, persistAcrossSessions: true }]);
  } catch (error) {
    if (String(error?.message || error).includes("Duplicate script ID")) {
      return;
    }
    await ext.scripting.registerContentScripts([baseScript]);
  }
}

async function injectContentScriptIntoOpenGcpdTabs() {
  if (!ext.tabs?.query || !ext.scripting?.executeScript) {
    return;
  }

  const tabs = await ext.tabs.query({ url: "https://steamcommunity.com/*" });
  await Promise.all(tabs
    .filter((tab) => tab.id && getSteamGcpdPageType(tab.url))
    .map((tab) => ext.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-gcpd.js"]
    }).catch(() => null)));
}

async function refreshFromSteam() {
  let state = await loadState();
  const now = new Date();

  if (!await hasPermission(STEAM_ORIGIN)) {
    return saveState(applyPatch(state, {
      lastFetchAt: now.toISOString(),
      lastFetchStatus: "no_permission",
      lastFetchError: null,
      latestMatchStatus: "no_permission",
      ratingStatus: "no_permission"
    }, now));
  }

  await ensureContentScriptRegistration();

  const [matchResult, ratingResult] = await Promise.all([
    fetchAndParseMatchHistory(now),
    fetchAndParseMatchmakingRating()
  ]);

  state = applyParsedResults(state, {
    matchResult,
    ratingResult,
    source: "steam_gcpd_fetch",
    now
  });
  return saveState(state);
}

async function fetchSteamPage(url) {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Steam returned HTTP ${response.status}.`);
  }

  return response.text();
}

async function fetchAndParseMatchHistory(now) {
  try {
    const html = await fetchSteamPage(GCPD_MATCH_URL);
    return parseSteamGcpdMatchHistory(html, now);
  } catch (error) {
    return { status: "error", latestPremierMatchAt: null, candidates: [], error: error.message };
  }
}

async function fetchAndParseMatchmakingRating() {
  try {
    const html = await fetchSteamPage(GCPD_MATCHMAKING_URL);
    return parseSteamGcpdMatchmakingRating(html);
  } catch (error) {
    return { status: "error", currentRating: null, error: error.message };
  }
}

function applyParsedResults(state, { matchResult = null, ratingResult = null, source, now }) {
  let next = state;
  const patch = {
    lastFetchAt: now.toISOString(),
    lastFetchError: combinedFetchError(matchResult, ratingResult)
  };

  if (matchResult) {
    patch.latestMatchStatus = matchResult.status;
    if (matchResult.status === "ok") {
      next = applyLatestMatch(next, matchResult.latestPremierMatchAt, source, now);
    }
  }

  if (ratingResult) {
    patch.ratingStatus = ratingResult.status;
    if (ratingResult.status === "ok") {
      next = applyRating(next, ratingResult.currentRating, "steam_matchmaking", now);
    }
  }

  patch.lastFetchStatus = aggregateFetchStatus(matchResult?.status, ratingResult?.status);
  return applyPatch(next, patch, now);
}

function combinedFetchError(matchResult, ratingResult) {
  const errors = [];
  if (matchResult?.error) {
    errors.push(`match history: ${matchResult.error}`);
  }
  if (ratingResult?.error) {
    errors.push(`rating: ${ratingResult.error}`);
  }
  return errors.length > 0 ? errors.join("; ") : null;
}

function aggregateFetchStatus(matchStatus, ratingStatus) {
  const statuses = [matchStatus, ratingStatus].filter(Boolean);
  if (statuses.length === 0) {
    return "never";
  }
  if (statuses.every((status) => status === "ok")) {
    return "ok";
  }
  if (statuses.includes("needs_login")) {
    return "needs_login";
  }
  if (statuses.includes("error")) {
    return "error";
  }
  if (matchStatus && matchStatus !== "ok") {
    return matchStatus;
  }
  if (ratingStatus && ratingStatus !== "ok") {
    return ratingStatus;
  }
  return "ok";
}

async function parseProvidedHtml(html, source = "active_tab", url = "", fallbackType = null) {
  let state = await loadState();
  const now = new Date();
  const pageType = getSteamGcpdPageType(url) || fallbackType;

  if (pageType === "match_history") {
    const matchResult = parseSteamGcpdMatchHistory(html, now);
    state = applyParsedResults(state, { matchResult, source, now });
    return {
      state: await saveState(state),
      pageUpdated: matchResult.status === "ok",
      pageType,
      status: matchResult.status
    };
  }

  if (pageType === "matchmaking") {
    const ratingResult = parseSteamGcpdMatchmakingRating(html);
    state = applyParsedResults(state, { ratingResult, source, now });
    return {
      state: await saveState(state),
      pageUpdated: ratingResult.status === "ok",
      pageType,
      status: ratingResult.status
    };
  }

  throw new Error("Open supported Steam GCPD page first.");
}

async function saveRating(ratingValue) {
  const rating = normalizeRating(ratingValue);
  const state = await loadState();
  return saveState(applyRating(state, rating, "manual"));
}

async function saveManualLatest(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Latest Premier match time is invalid.");
  }
  const state = await loadState();
  return saveState(applyLatestMatch(state, date.toISOString(), "manual"));
}

async function saveTheme(theme) {
  const state = await loadState();
  return saveState({
    ...state,
    ...normalizeTheme(theme)
  });
}

async function resetTheme() {
  const state = await loadState();
  return saveState({
    ...state,
    ...DEFAULT_THEME
  });
}

async function saveConfig(config) {
  const state = await loadState();
  return saveState({
    ...state,
    ...normalizeConfig(config)
  });
}

async function resetConfig() {
  const state = await loadState();
  return saveState({
    ...state,
    ...DEFAULT_CONFIG
  });
}

function normalizeTheme(theme) {
  const accentColor = normalizeHexColor(theme?.themeAccentColor, "Accent color");

  return {
    themeAccentColor: accentColor
  };
}

function normalizeConfig(config) {
  const normalized = {};
  if (Object.hasOwn(config || {}, "badgeCounterEnabled")) {
    normalized.badgeCounterEnabled = config.badgeCounterEnabled !== false;
  }
  if (Object.hasOwn(config || {}, "remindersEnabled")) {
    normalized.remindersEnabled = config.remindersEnabled === true;
  }
  if (Object.hasOwn(config || {}, "languagePreference")) {
    normalized.languagePreference = normalizeLanguagePreference(config.languagePreference);
  }
  return normalized;
}

function normalizeHexColor(value, label) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`${label} must be a hex color.`);
  }
  return value.toUpperCase();
}

async function openGcpdTabs() {
  await ensureContentScriptRegistration();
  const matchTab = await ext.tabs.create({ url: GCPD_MATCH_URL });
  const ratingTab = await ext.tabs.create({ url: GCPD_MATCHMAKING_URL, active: false });

  if (matchTab?.id) {
    guidedTabs.set(matchTab.id, { pageType: "match_history", parsing: false });
  }
  if (ratingTab?.id) {
    guidedTabs.set(ratingTab.id, { pageType: "matchmaking", parsing: false });
  }

  return loadState();
}

async function openRepository() {
  await ext.tabs.create({ url: REPOSITORY_URL });
  return loadState();
}

async function parseGuidedTab(tabId, fallbackType) {
  const results = await ext.scripting.executeScript({
    target: { tabId },
    func: () => ({
      url: location.href,
      html: document.documentElement.outerHTML
    })
  });

  const page = results?.[0]?.result;
  if (!page?.html) {
    return false;
  }

  const result = await parseProvidedHtml(page.html, "steam_gcpd_guided_tab", page.url, fallbackType);
  return result.pageUpdated;
}

async function handleMessage(message) {
  switch (message?.type) {
    case "getState":
      await updateBadge();
      return loadState();
    case "refresh":
      return refreshFromSteam();
    case "parseHtml":
      return (await parseProvidedHtml(message.html, message.source, message.url)).state;
    case "steamGcpdPageHtml":
      return parseProvidedHtml(message.html, message.source, message.url);
    case "saveRating":
      return saveRating(message.rating);
    case "saveManualLatest":
      return saveManualLatest(message.latestPremierMatchAt);
    case "saveTheme":
      return saveTheme(message);
    case "resetTheme":
      return resetTheme();
    case "saveConfig":
      return saveConfig(message);
    case "resetConfig":
      return resetConfig();
    case "openGcpd":
      return openGcpdTabs();
    case "openSidebar":
      return openSidebar();
    case "openRepository":
      return openRepository();
    case "openShortcutSettings":
      return openShortcutSettings();
    default:
      throw new Error("Unknown request.");
  }
}

ext.runtime.onInstalled.addListener(() => {
  ensureAlarm()
    .then(() => ensureContentScriptRegistration())
    .then(() => applyReminderScheduleFromStorage())
    .catch(() => {});
});

ext.runtime.onStartup.addListener(() => {
  ensureAlarm()
    .then(() => ensureContentScriptRegistration())
    .then(() => applyReminderScheduleFromStorage())
    .catch(() => {});
});

ext.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    refreshFromSteam().catch(() => {});
    return;
  }
  handleReminderAlarm(alarm.name).catch(() => {});
});

ext.storage.onChanged.addListener(() => {
  loadState()
    .then((state) => updateBadge(state))
    .catch(() => {});
});

ext.tabs?.onUpdated?.addListener((tabId, changeInfo) => {
  const guided = guidedTabs.get(tabId);
  if (!guided || guided.parsing || changeInfo.status !== "complete") {
    return;
  }

  guided.parsing = true;
  parseGuidedTab(tabId, guided.pageType)
    .then(async (success) => {
      if (success) {
        guidedTabs.delete(tabId);
        await ext.tabs.remove(tabId).catch(() => {});
      } else {
        guided.parsing = false;
      }
    })
    .catch(() => {
      guided.parsing = false;
    });
});

ext.tabs?.onRemoved?.addListener((tabId) => {
  guidedTabs.delete(tabId);
});

ext.commands?.onCommand?.addListener((command, tab) => {
  if (command === "open-sidebar") {
    openSidebar(tab?.windowId).catch(() => {});
  }
});

ext.notifications?.onClicked?.addListener(() => {
  openSidebar()
    .catch(() => ext.tabs.create({ url: ext.runtime.getURL("popup.html") }))
    .catch(() => {});
});

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
