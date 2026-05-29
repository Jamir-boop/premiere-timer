import { formatDuration, getTimerState } from "./lib/calc.js";
import {
  ext,
  hasApiPermission,
  hasPermission,
  requestApiPermission,
  requestPermission,
  sendMessage
} from "./lib/ext-api.js";
import {
  createTranslator,
  getBrowserLanguageCandidates,
  normalizeLanguagePreference,
  timerLabel
} from "./lib/i18n.js";
import { DEFAULT_THEME, STEAM_ORIGIN } from "./lib/state.js";

const elements = {
  statusText: document.querySelector("#statusText"),
  statusDot: document.querySelector("#statusDot"),
  onboarding: document.querySelector("#onboarding"),
  stepAccess: document.querySelector("#stepAccess"),
  stepSync: document.querySelector("#stepSync"),
  stepReady: document.querySelector("#stepReady"),
  countdown: document.querySelector("#countdown"),
  playBefore: document.querySelector("#playBefore"),
  ratingValue: document.querySelector("#ratingValue"),
  latestMatch: document.querySelector("#latestMatch"),
  fetchValue: document.querySelector("#fetchValue"),
  timezoneValue: document.querySelector("#timezoneValue"),
  primaryAction: document.querySelector("#primaryAction"),
  accessStatus: document.querySelector("#accessStatus"),
  secondaryButtons: document.querySelector(".secondary-buttons"),
  moreDataToggle: document.querySelector("#moreDataToggle"),
  manualToggle: document.querySelector("#manualToggle"),
  settingsToggle: document.querySelector("#settingsToggle"),
  moreDataPanel: document.querySelector("#moreDataPanel"),
  manualPanel: document.querySelector("#manualPanel"),
  settingsPanel: document.querySelector("#settingsPanel"),
  ratingSourceValue: document.querySelector("#ratingSourceValue"),
  expiryValue: document.querySelector("#expiryValue"),
  matchStatusValue: document.querySelector("#matchStatusValue"),
  ratingStatusValue: document.querySelector("#ratingStatusValue"),
  fetchStatusValue: document.querySelector("#fetchStatusValue"),
  fetchErrorValue: document.querySelector("#fetchErrorValue"),
  ratingForm: document.querySelector("#ratingForm"),
  ratingInput: document.querySelector("#ratingInput"),
  manualForm: document.querySelector("#manualForm"),
  manualLatest: document.querySelector("#manualLatest"),
  remindersEnabled: document.querySelector("#remindersEnabled"),
  languagePreference: document.querySelector("#languagePreference"),
  themeAccentColor: document.querySelector("#themeAccentColor"),
  badgeCounterEnabled: document.querySelector("#badgeCounterEnabled"),
  resetTheme: document.querySelector("#resetTheme"),
  versionValue: document.querySelector("#versionValue"),
  openGitHub: document.querySelector("#openGitHub"),
  openSidebar: document.querySelector("#openSidebar"),
  openShortcuts: document.querySelector("#openShortcuts"),
  message: document.querySelector("#message")
};

let state = null;
let hasSteamAccess = false;
let tickTimer = null;
let activePanel = null;
let manualFallbackWasNeeded = false;
let translator = createTranslator();

const APP_VERSION = ext.runtime?.getManifest?.().version || "1.0.0";
const NOTIFICATIONS_PERMISSION = "notifications";

async function init() {
  bindEvents();
  await reloadState();
  tickTimer = setInterval(render, 30 * 1000);
}

function bindEvents() {
  elements.primaryAction.addEventListener("click", async () => {
    const action = primaryActionForState(state, hasSteamAccess);
    await runAction(action.busyLabel, async () => {
      if (action.type === "permission") {
        const allowed = await requestPermission(STEAM_ORIGIN);
        hasSteamAccess = allowed;
        setMessage(allowed ? t("steamAccessAllowedNext") : t("steamAccessDenied"));
        return;
      }

      if (action.type === "open") {
        state = await sendMessage("openGcpd");
        render();
        setMessage(t("openedSteamGcpdPages"));
        return;
      }

      state = await sendMessage("refresh");
      render();
      setMessage(fetchStatusMessage(state));
    });
  });

  elements.moreDataToggle.addEventListener("click", () => {
    setActivePanel("moreData");
  });

  elements.manualToggle.addEventListener("click", () => {
    setActivePanel("manual");
  });

  elements.settingsToggle.addEventListener("click", () => {
    setActivePanel("settings");
  });

  elements.openSidebar.addEventListener("click", async () => {
    await runAction(t("openingSidebar"), async () => {
      await openSidebarFromUserGesture();
      setMessage(t("sidebarOpened"));
    });
  });

  elements.openShortcuts.addEventListener("click", async () => {
    await runAction(t("openingShortcutSettings"), async () => {
      await sendMessage("openShortcutSettings");
      setMessage(t("shortcutSettingsOpened"));
    });
  });

  elements.openGitHub.addEventListener("click", async () => {
    await runAction(t("openingRepository"), async () => {
      await sendMessage("openRepository");
      setMessage(t("repositoryOpened"));
    });
  });

  elements.ratingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runAction(t("savingRating"), async () => {
      state = await sendMessage("saveRating", { rating: elements.ratingInput.value });
      render();
      setMessage(t("manualRatingSaved"));
    });
  });

  elements.manualForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runAction(t("savingLatestMatch"), async () => {
      if (!elements.manualLatest.value) {
        throw new Error(t("pickLatestPremierMatchTime"));
      }
      state = await sendMessage("saveManualLatest", {
        latestPremierMatchAt: new Date(elements.manualLatest.value).toISOString()
      });
      render();
      setMessage(t("manualMatchTimeSaved"));
    });
  });

  elements.themeAccentColor.addEventListener("change", saveThemeFromInputs);
  elements.remindersEnabled.addEventListener("change", saveConfigFromInputs);
  elements.languagePreference.addEventListener("change", saveConfigFromInputs);
  elements.badgeCounterEnabled.addEventListener("change", saveConfigFromInputs);

  elements.resetTheme.addEventListener("click", async () => {
    await runAction(t("resettingColors"), async () => {
      state = await sendMessage("resetTheme");
      render();
      setMessage(t("colorsReset"));
    });
  });

  ext.storage.onChanged.addListener(() => {
    reloadState().catch(() => {});
  });

  window.addEventListener("unload", () => {
    if (tickTimer) {
      clearInterval(tickTimer);
    }
  });
}

async function reloadState() {
  [state, hasSteamAccess] = await Promise.all([
    sendMessage("getState"),
    hasPermission(STEAM_ORIGIN).catch(() => false)
  ]);
  render();
}

function render() {
  if (!state) {
    return;
  }

  translator = createTranslator(
    state.languagePreference,
    getBrowserLanguageCandidates([ext.i18n?.getUILanguage?.()])
  );
  applyStaticTranslations();
  applyTheme(state);

  const timer = getTimerState(state);
  const expiry = timer.expiry;
  const action = primaryActionForState(state, hasSteamAccess);
  const setupComplete = isSetupComplete(state);
  const manualFallbackNeeded = needsManualFallback(state);

  if (!hasSteamAccess && activePanel !== "settings") {
    activePanel = null;
  }

  if (hasSteamAccess && manualFallbackNeeded && !manualFallbackWasNeeded) {
    activePanel = "manual";
  }
  manualFallbackWasNeeded = hasSteamAccess && manualFallbackNeeded;

  elements.statusText.textContent = statusText(timer, state);
  elements.statusDot.className = "";
  elements.statusDot.classList.add(statusClass(timer.level));
  elements.onboarding.hidden = hasTimerData(state);
  elements.stepAccess.classList.toggle("done", hasSteamAccess);
  elements.stepSync.classList.toggle("done", state.lastFetchStatus === "ok");
  elements.stepReady.classList.toggle("done", setupComplete);
  elements.countdown.textContent = expiry ? formatCountdown(expiry.msUntilPlayBefore) : "--";
  elements.playBefore.textContent = state.playBeforeAt
    ? t("playBefore", { value: formatDateTime(state.playBeforeAt) })
    : t("steamSyncNeeded");
  elements.ratingValue.textContent = formatRating(state.currentRating);
  elements.latestMatch.textContent = state.latestPremierMatchAt ? formatDateTime(state.latestPremierMatchAt) : "--";
  elements.fetchValue.textContent = state.lastFetchAt
    ? formatRelativeWithSuffix(state.lastFetchAt)
    : t("never");
  elements.timezoneValue.textContent = timezoneLabel();
  elements.primaryAction.textContent = action.label;
  elements.primaryAction.disabled = action.disabled;
  elements.accessStatus.textContent = hasSteamAccess ? t("steamAccessAllowed") : t("steamAccessPending");
  elements.secondaryButtons.hidden = false;
  elements.moreDataToggle.hidden = !hasSteamAccess;
  elements.manualToggle.hidden = !hasSteamAccess;
  elements.ratingSourceValue.textContent = ratingSourceLabel(state);
  elements.expiryValue.textContent = state.expirationAtEstimate ? formatDateTime(state.expirationAtEstimate) : "--";
  elements.matchStatusValue.textContent = formatStatus(state.latestMatchStatus);
  elements.ratingStatusValue.textContent = formatStatus(state.ratingStatus);
  elements.fetchStatusValue.textContent = formatStatus(state.lastFetchStatus);
  elements.fetchErrorValue.textContent = state.lastFetchError || "--";
  elements.ratingInput.value = state.currentRating ?? "";
  elements.remindersEnabled.checked = state.remindersEnabled === true;
  elements.languagePreference.value = normalizeLanguagePreference(state.languagePreference);
  elements.themeAccentColor.value = normalizeStoredHex(state.themeAccentColor, DEFAULT_THEME.themeAccentColor);
  elements.badgeCounterEnabled.checked = state.badgeCounterEnabled !== false;
  elements.versionValue.textContent = `v${APP_VERSION}`;
  renderPanels();
}

function primaryActionForState(currentState, permission) {
  if (!permission) {
    return { type: "permission", label: t("allowSteamAccess"), busyLabel: t("requestingSteamAccess"), disabled: false };
  }
  if (
    currentState.latestMatchStatus === "needs_login" ||
    currentState.ratingStatus === "needs_login"
  ) {
    return { type: "open", label: t("openSteamGcpd"), busyLabel: t("openingSteamGcpd") };
  }
  if (!currentState.latestPremierMatchAt || currentState.currentRating === null || currentState.currentRating === undefined) {
    return { type: "open", label: t("syncSteamData"), busyLabel: t("openingSteamGcpd") };
  }
  if (currentState.ratingNeedsUpdate || currentState.ratingStatus === "rating_not_found") {
    return { type: "open", label: t("syncSteamRating"), busyLabel: t("openingSteamGcpd") };
  }
  return { type: "refresh", label: t("refresh"), busyLabel: t("refreshingSteam") };
}

function applyStaticTranslations() {
  document.documentElement.lang = translator.language;
  document.title = t("appName");

  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  }
  for (const element of document.querySelectorAll("[data-i18n-title]")) {
    element.setAttribute("title", t(element.dataset.i18nTitle));
  }
}

function t(key, values = {}) {
  return translator.t(key, values);
}

function setActivePanel(panelName) {
  activePanel = activePanel === panelName ? null : panelName;
  renderPanels();
}

function renderPanels() {
  const panels = {
    moreData: elements.moreDataPanel,
    manual: elements.manualPanel,
    settings: elements.settingsPanel
  };
  const buttons = {
    moreData: elements.moreDataToggle,
    manual: elements.manualToggle,
    settings: elements.settingsToggle
  };

  for (const [panelName, panel] of Object.entries(panels)) {
    panel.hidden = activePanel !== panelName;
    buttons[panelName].setAttribute("aria-pressed", String(activePanel === panelName));
  }
}

async function saveThemeFromInputs() {
  await runAction(t("savingColors"), async () => {
    state = await sendMessage("saveTheme", {
      themeAccentColor: elements.themeAccentColor.value
    });
    render();
    setMessage(t("colorsSaved"));
  });
}

async function saveConfigFromInputs(event) {
  await runAction(t("savingConfig"), async () => {
    const remindersResult = await getRequestedRemindersEnabled(event?.target === elements.remindersEnabled);
    state = await sendMessage("saveConfig", {
      remindersEnabled: remindersResult.enabled,
      badgeCounterEnabled: elements.badgeCounterEnabled.checked,
      languagePreference: elements.languagePreference.value
    });
    render();
    setMessage(remindersResult.denied ? t("remindersPermissionDenied") : t("configSaved"));
  });
}

async function getRequestedRemindersEnabled(shouldRequestPermission) {
  if (!elements.remindersEnabled.checked) {
    return { enabled: false, denied: false };
  }

  const hasNotifications = await hasApiPermission(NOTIFICATIONS_PERMISSION).catch(() => false);
  if (hasNotifications) {
    return { enabled: true, denied: false };
  }

  const allowed = shouldRequestPermission
    ? await requestApiPermission(NOTIFICATIONS_PERMISSION).catch(() => false)
    : false;
  if (allowed) {
    return { enabled: true, denied: false };
  }

  elements.remindersEnabled.checked = false;
  return { enabled: false, denied: true };
}

function applyTheme(currentState) {
  const backgroundColor = "#000000";
  const accentColor = normalizeStoredHex(currentState.themeAccentColor, DEFAULT_THEME.themeAccentColor);
  const root = document.documentElement;
  const border = blendHex(backgroundColor, accentColor, 0.22);
  const borderStrong = blendHex(backgroundColor, accentColor, 0.44);

  root.style.setProperty("--bg", backgroundColor);
  root.style.setProperty("--surface-0", backgroundColor);
  root.style.setProperty("--surface-1", blendHex(backgroundColor, "#FFFFFF", 0.02));
  root.style.setProperty("--surface-2", blendHex(backgroundColor, "#FFFFFF", 0.04));
  root.style.setProperty("--surface-3", blendHex(backgroundColor, "#FFFFFF", 0.07));
  root.style.setProperty("--accent", accentColor);
  root.style.setProperty("--accent-hover", accentColor);
  root.style.setProperty("--accent-active", accentColor);
  root.style.setProperty("--accent-outline", accentColor);
  root.style.setProperty("--border", border);
  root.style.setProperty("--border-strong", borderStrong);
  root.style.setProperty("--text-on-accent", relativeLuminance(accentColor) > 0.45 ? "#000000" : "#FFFFFF");
}

function normalizeStoredHex(value, fallback) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toUpperCase()
    : fallback;
}

function blendHex(baseColor, overlayColor, overlayAmount) {
  const base = hexToRgb(baseColor);
  const overlay = hexToRgb(overlayColor);
  return rgbToHex({
    r: Math.round(base.r * (1 - overlayAmount) + overlay.r * overlayAmount),
    g: Math.round(base.g * (1 - overlayAmount) + overlay.g * overlayAmount),
    b: Math.round(base.b * (1 - overlayAmount) + overlay.b * overlayAmount)
  });
}

function relativeLuminance(hexColor) {
  const { r, g, b } = hexToRgb(hexColor);
  const [red, green, blue] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function hexToRgb(hexColor) {
  return {
    r: Number.parseInt(hexColor.slice(1, 3), 16),
    g: Number.parseInt(hexColor.slice(3, 5), 16),
    b: Number.parseInt(hexColor.slice(5, 7), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function isSetupComplete(currentState) {
  return (
    hasSteamAccess &&
    currentState.latestPremierMatchAt &&
    currentState.currentRating !== null &&
    currentState.currentRating !== undefined &&
    currentState.latestMatchStatus === "ok" &&
    currentState.ratingStatus === "ok"
  );
}

function hasTimerData(currentState) {
  return (
    currentState.latestPremierMatchAt &&
    currentState.currentRating !== null &&
    currentState.currentRating !== undefined
  );
}

function needsManualFallback(currentState) {
  return (
    currentState.ratingNeedsUpdate ||
    currentState.ratingStatus === "rating_not_found" ||
    currentState.ratingStatus === "error"
  );
}

function statusText(timer, currentState) {
  if (currentState.latestMatchStatus === "needs_login" || currentState.ratingStatus === "needs_login") {
    return t("loginRequired");
  }
  if (currentState.latestMatchStatus === "no_premier_matches") {
    return t("noPremierMatchFound");
  }
  if (timer.level === "unknown") {
    return t("missingData");
  }
  if (timer.level === "stale_rating") {
    return t("updateRating");
  }
  return timerLabel(timer.level, translator);
}

function statusClass(level) {
  if (level === "ok") {
    return "ok";
  }
  if (level === "warning" || level === "stale_rating") {
    return "warning";
  }
  if (level === "urgent" || level === "expired") {
    return "urgent";
  }
  return "";
}

function formatRating(value) {
  return value === null || value === undefined ? "--" : Number(value).toLocaleString(translator.language);
}

function ratingSourceLabel(currentState) {
  if (currentState.ratingSource === "steam_matchmaking") {
    return t("steamMatchmaking");
  }
  if (currentState.ratingSource === "manual") {
    return t("manual");
  }
  return t("missing");
}

function formatStatus(status) {
  const labels = {
    empty: "statusEmpty",
    error: "statusError",
    needs_login: "statusNeedsLogin",
    never: "statusNever",
    no_permission: "statusNoPermission",
    no_premier_matches: "statusNoPremierMatches",
    ok: "statusOk",
    rating_not_found: "statusRatingNotFound"
  };
  return labels[status] ? t(labels[status]) : status || t("never");
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(translator.language, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

function timezoneLabel() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || t("local");
  return `${timezone} (${timezoneOffsetLabel(new Date())})`;
}

function timezoneOffsetLabel(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}

function formatCountdown(ms) {
  const value = formatDuration(ms);
  if (value === "unknown") {
    return t("missing");
  }
  if (value === "expired") {
    return t("expired");
  }
  return value;
}

function formatRelative(value) {
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return t("now");
  }
  return formatCountdown(diffMs);
}

function formatRelativeWithSuffix(value) {
  const relative = formatRelative(value);
  return relative === t("now") ? t("now") : t("ago", { value: relative });
}

function fetchStatusMessage(currentState) {
  if (currentState.latestMatchStatus === "ok" && currentState.ratingStatus === "ok") {
    return t("steamDataRefreshed");
  }
  if (currentState.latestMatchStatus === "needs_login" || currentState.ratingStatus === "needs_login") {
    return t("steamLoginRequired");
  }
  if (currentState.lastFetchStatus === "no_permission") {
    return t("steamAccessNotAllowed");
  }
  if (currentState.ratingStatus === "rating_not_found") {
    return t("ratingNotFoundManual");
  }
  if (currentState.latestMatchStatus === "no_premier_matches") {
    return t("noPremierMatchFound");
  }
  if (currentState.lastFetchError) {
    return currentState.lastFetchError;
  }
  return t("steamStatus", { status: formatStatus(currentState.lastFetchStatus) });
}

async function openSidebarFromUserGesture() {
  if (ext.sidePanel?.open) {
    await ext.sidePanel.open({ windowId: ext.windows?.WINDOW_ID_CURRENT ?? -2 });
    return;
  }

  if (ext.sidebarAction?.open) {
    await ext.sidebarAction.open();
    return;
  }

  await sendMessage("openSidebar");
}

async function runAction(label, fn) {
  setMessage(`${label}...`);
  setBusy(true);
  try {
    await fn();
  } catch (error) {
    setMessage(localizeErrorMessage(error.message));
  } finally {
    setBusy(false);
    await reloadState();
  }
}

function setBusy(isBusy) {
  for (const button of document.querySelectorAll("button")) {
    button.disabled = isBusy;
  }
}

function setMessage(value) {
  elements.message.textContent = value;
}

function localizeErrorMessage(message) {
  const keys = {
    "Accent color must be a hex color.": "accentColorInvalid",
    "CS Rating must be a number from 0 to 99999.": "csRatingInvalid",
    "Latest Premier match time is invalid.": "latestPremierMatchInvalid",
    "Open supported Steam GCPD page first.": "openSupportedSteamGcpd",
    "Sidebar is not available in this browser.": "sidebarUnavailable",
    "Unknown request.": "requestUnknown"
  };
  return keys[message] ? t(keys[message]) : message;
}

init().catch((error) => {
  setMessage(error.message);
});
