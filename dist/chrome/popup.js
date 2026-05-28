import { formatDuration, getTimerState } from "./lib/calc.js";
import { ext, hasPermission, requestPermission, sendMessage } from "./lib/ext-api.js";
import { STEAM_ORIGIN } from "./lib/state.js";

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
  allowSteam: document.querySelector("#allowSteam"),
  primaryAction: document.querySelector("#primaryAction"),
  accessStatus: document.querySelector("#accessStatus"),
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
  openSidebar: document.querySelector("#openSidebar"),
  openShortcuts: document.querySelector("#openShortcuts"),
  message: document.querySelector("#message")
};

let state = null;
let hasSteamAccess = false;
let tickTimer = null;
let activePanel = null;
let manualFallbackWasNeeded = false;

async function init() {
  bindEvents();
  await reloadState();
  tickTimer = setInterval(render, 30 * 1000);
}

function bindEvents() {
  elements.allowSteam.addEventListener("click", async () => {
    await runAction("Requesting Steam access", async () => {
      const allowed = await requestPermission(STEAM_ORIGIN);
      hasSteamAccess = allowed;
      if (!allowed) {
        setMessage("Steam access denied.");
        return;
      }
      await reloadState();
      setMessage("Steam access allowed. Sync Steam data next.");
    });
  });

  elements.primaryAction.addEventListener("click", async () => {
    const action = primaryActionForState(state, hasSteamAccess);
    await runAction(action.busyLabel, async () => {
      if (action.type === "open") {
        state = await sendMessage("openGcpd");
        render();
        setMessage("Opened Steam GCPD pages. Leave them open until sync finishes.");
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
    await runAction("Opening sidebar", async () => {
      await openSidebarFromUserGesture();
      setMessage("Sidebar opened.");
    });
  });

  elements.openShortcuts.addEventListener("click", async () => {
    await runAction("Opening shortcut settings", async () => {
      await sendMessage("openShortcutSettings");
      setMessage("Shortcut settings opened.");
    });
  });

  elements.ratingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runAction("Saving rating", async () => {
      state = await sendMessage("saveRating", { rating: elements.ratingInput.value });
      render();
      setMessage("Manual rating saved.");
    });
  });

  elements.manualForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runAction("Saving latest match", async () => {
      if (!elements.manualLatest.value) {
        throw new Error("Pick latest Premier match time.");
      }
      state = await sendMessage("saveManualLatest", {
        latestPremierMatchAt: new Date(elements.manualLatest.value).toISOString()
      });
      render();
      setMessage("Manual match time saved.");
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

  const timer = getTimerState(state);
  const expiry = timer.expiry;
  const action = primaryActionForState(state, hasSteamAccess);
  const setupComplete = isSetupComplete(state);
  const manualFallbackNeeded = needsManualFallback(state);

  if (manualFallbackNeeded && !manualFallbackWasNeeded) {
    activePanel = "manual";
  }
  manualFallbackWasNeeded = manualFallbackNeeded;

  elements.statusText.textContent = statusText(timer, state);
  elements.statusDot.className = "";
  elements.statusDot.classList.add(statusClass(timer.level));
  elements.onboarding.hidden = hasTimerData(state);
  elements.stepAccess.classList.toggle("done", hasSteamAccess);
  elements.stepSync.classList.toggle("done", state.lastFetchStatus === "ok");
  elements.stepReady.classList.toggle("done", setupComplete);
  elements.countdown.textContent = expiry ? formatDuration(expiry.msUntilPlayBefore) : "--";
  elements.playBefore.textContent = state.playBeforeAt
    ? `Play Premier before ${formatDateTime(state.playBeforeAt)}`
    : "Steam sync needed.";
  elements.ratingValue.textContent = formatRating(state.currentRating);
  elements.latestMatch.textContent = state.latestPremierMatchAt ? formatDateTime(state.latestPremierMatchAt) : "--";
  elements.fetchValue.textContent = state.lastFetchAt
    ? formatRelativeWithSuffix(state.lastFetchAt)
    : "Never";
  elements.timezoneValue.textContent = timezoneLabel();
  elements.allowSteam.hidden = hasSteamAccess;
  elements.primaryAction.hidden = !hasSteamAccess;
  elements.primaryAction.textContent = action.label;
  elements.primaryAction.disabled = !hasSteamAccess || action.disabled;
  elements.accessStatus.textContent = hasSteamAccess ? "Steam access allowed" : "Steam access pending";
  elements.ratingSourceValue.textContent = ratingSourceLabel(state);
  elements.expiryValue.textContent = state.expirationAtEstimate ? formatDateTime(state.expirationAtEstimate) : "--";
  elements.matchStatusValue.textContent = formatStatus(state.latestMatchStatus);
  elements.ratingStatusValue.textContent = formatStatus(state.ratingStatus);
  elements.fetchStatusValue.textContent = formatStatus(state.lastFetchStatus);
  elements.fetchErrorValue.textContent = state.lastFetchError || "--";
  elements.ratingInput.value = state.currentRating ?? "";
  renderPanels();
}

function primaryActionForState(currentState, permission) {
  if (!permission) {
    return { type: "none", label: "Sync Steam data", busyLabel: "Syncing Steam data", disabled: true };
  }
  if (
    currentState.latestMatchStatus === "needs_login" ||
    currentState.ratingStatus === "needs_login"
  ) {
    return { type: "open", label: "Open Steam GCPD", busyLabel: "Opening Steam GCPD" };
  }
  if (!currentState.latestPremierMatchAt || currentState.currentRating === null || currentState.currentRating === undefined) {
    return { type: "open", label: "Sync Steam data", busyLabel: "Opening Steam GCPD" };
  }
  if (currentState.ratingNeedsUpdate || currentState.ratingStatus === "rating_not_found") {
    return { type: "open", label: "Sync Steam rating", busyLabel: "Opening Steam GCPD" };
  }
  return { type: "refresh", label: "Refresh", busyLabel: "Refreshing Steam" };
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
    return "Login required";
  }
  if (currentState.latestMatchStatus === "no_premier_matches") {
    return "No Premier match found";
  }
  if (timer.level === "unknown") {
    return "Missing data";
  }
  if (timer.level === "stale_rating") {
    return "Update rating";
  }
  return timer.label;
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
  return value === null || value === undefined ? "--" : Number(value).toLocaleString();
}

function ratingSourceLabel(currentState) {
  if (currentState.ratingSource === "steam_matchmaking") {
    return "Steam matchmaking";
  }
  if (currentState.ratingSource === "manual") {
    return "Manual";
  }
  return "Missing";
}

function formatStatus(status) {
  const labels = {
    empty: "Empty",
    error: "Error",
    needs_login: "Needs login",
    never: "Never",
    no_permission: "No permission",
    no_premier_matches: "No Premier matches",
    ok: "OK",
    rating_not_found: "Rating not found"
  };
  return labels[status] || status || "Never";
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

function timezoneLabel() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
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

function formatRelative(value) {
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return "now";
  }
  return formatDuration(diffMs);
}

function formatRelativeWithSuffix(value) {
  const relative = formatRelative(value);
  return relative === "now" ? "now" : `${relative} ago`;
}

function fetchStatusMessage(currentState) {
  if (currentState.latestMatchStatus === "ok" && currentState.ratingStatus === "ok") {
    return "Steam data refreshed.";
  }
  if (currentState.latestMatchStatus === "needs_login" || currentState.ratingStatus === "needs_login") {
    return "Steam login required. Open GCPD while logged in.";
  }
  if (currentState.lastFetchStatus === "no_permission") {
    return "Steam access not allowed.";
  }
  if (currentState.ratingStatus === "rating_not_found") {
    return "Steam rating not found. Use manual fallback.";
  }
  if (currentState.latestMatchStatus === "no_premier_matches") {
    return "No Premier match found.";
  }
  if (currentState.lastFetchError) {
    return currentState.lastFetchError;
  }
  return `Steam status: ${formatStatus(currentState.lastFetchStatus)}`;
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
    setMessage(error.message);
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

init().catch((error) => {
  setMessage(error.message);
});
