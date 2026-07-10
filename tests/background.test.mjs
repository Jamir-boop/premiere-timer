import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

let storageData = {};
let fetchMock = null;
let fetchCalls = [];
let tabIdCounter = 1;
let onUpdatedListeners = [];
let onRemovedListeners = [];

globalThis.browser = {
  action: {
    setBadgeBackgroundColor: async () => {},
    setBadgeText: async () => {},
    setTitle: async () => {}
  },
  alarms: {
    clear: async () => true,
    create: async () => {},
    onAlarm: { addListener: () => {} }
  },
  commands: { onCommand: { addListener: () => {} } },
  i18n: { getUILanguage: () => "en" },
  notifications: {
    create: async () => {},
    onClicked: { addListener: () => {} }
  },
  permissions: {
    contains: async () => true,
    request: async () => true
  },
  runtime: {
    onInstalled: { addListener: () => {} },
    onMessage: { addListener: () => {} },
    onStartup: { addListener: () => {} }
  },
  scripting: {
    executeScript: async () => [],
    getRegisteredContentScripts: async () => [],
    registerContentScripts: async () => {}
  },
  storage: {
    local: {
      get: async (defaults) => ({ ...defaults, ...storageData }),
      set: async (value) => {
        storageData = { ...storageData, ...value };
      }
    },
    onChanged: { addListener: () => {} }
  },
  tabs: {
    create: async () => ({}),
    onRemoved: { addListener: (fn) => onRemovedListeners.push(fn) },
    onUpdated: { addListener: (fn) => onUpdatedListeners.push(fn) },
    query: async () => [],
    remove: async () => {}
  },
  windows: {
    getLastFocused: async () => ({ id: 1 })
  }
};

globalThis.fetch = async (url) => {
  const value = String(url);
  fetchCalls.push(value);
  return fetchMock(value);
};

const {
  fetchAndParseMatchHistory,
  handleMessage,
  parseMatchHistoryWithLoadMore,
  refreshFromSteam,
  startBackground
} = await import("../src/background.js");

startBackground();

const MATCH_URL = "https://steamcommunity.com/my/gcpd/730/?tab=matchhistorypremier&l=english";
const RATING_HTML = "<div>Premier Skill Group 14,250</div>";
const NOW = new Date("2026-06-08T00:00:00.000Z");

beforeEach(() => {
  storageData = {};
  fetchCalls = [];
  fetchMock = () => htmlResponse("<html></html>");
  tabIdCounter = 1;
});

describe("Steam background history scan", () => {
  it("user refresh finds Premier match within 25 load-more pages", async () => {
    let ajaxCount = 0;
    fetchMock = (url) => {
      const parsed = new URL(url);
      if (parsed.searchParams.get("tab") === "matchmaking") {
        return htmlResponse(RATING_HTML, url);
      }
      if (parsed.searchParams.get("ajax") !== "1") {
        return htmlResponse(historyPage("token0"), url);
      }

      ajaxCount += 1;
      assert.equal(parsed.searchParams.get("l"), "english");
      if (ajaxCount === 25) {
        return jsonResponse({ success: true, html: matchRow("May 1, 2026 @ 7:11pm GMT") }, url);
      }
      return jsonResponse({
        success: true,
        html: `<table><tr><td>No Premier date page ${ajaxCount}</td></tr></table>`,
        continue_token: `token${ajaxCount}`
      }, url);
    };

    const result = await refreshFromSteam({
      matchHistoryLoadMoreDelayMs: 0,
      matchHistoryScanTimeLimitMs: 60 * 1000
    });

    assert.equal(ajaxCount, 25);
    assert.equal(result.latestMatchStatus, "ok");
    assert.equal(result.latestPremierMatchAt, "2026-05-01T19:11:00.000Z");
    assert.equal(result.ratingStatus, "ok");
  });

  it("background refresh stops at 5 pages and keeps cached match", async () => {
    const cachedMatch = "2026-01-15T12:00:00.000Z";
    storageData = {
      latestPremierMatchAt: cachedMatch,
      latestPremierMatchSource: "steam_gcpd_fetch",
      currentRating: 14250,
      ratingSource: "steam_matchmaking"
    };
    let ajaxCount = 0;
    fetchMock = (url) => {
      const parsed = new URL(url);
      if (parsed.searchParams.get("tab") === "matchmaking") {
        return htmlResponse(RATING_HTML, url);
      }
      if (parsed.searchParams.get("ajax") !== "1") {
        return htmlResponse(historyPage("token0"), url);
      }

      ajaxCount += 1;
      return jsonResponse({
        success: true,
        html: `<table><tr><td>No Premier date page ${ajaxCount}</td></tr></table>`,
        continue_token: `token${ajaxCount}`
      }, url);
    };

    const result = await refreshFromSteam({
      scanMode: "background",
      matchHistoryLoadMoreDelayMs: 0,
      matchHistoryScanTimeLimitMs: 60 * 1000
    });

    assert.equal(ajaxCount, 5);
    assert.equal(result.latestMatchStatus, "history_scan_limited");
    assert.equal(result.lastFetchStatus, "history_scan_limited");
    assert.equal(result.latestPremierMatchAt, cachedMatch);
  });

  it("returns no_premier_matches only when history end is reached", async () => {
    const result = await parseMatchHistoryWithLoadMore(
      "<table><tr><td>No Premier date</td></tr></table>",
      MATCH_URL,
      NOW,
      { loadMoreDelayMs: 0 }
    );

    assert.equal(result.status, "no_premier_matches");
  });

  it("returns pagination_unavailable when load-more state is incomplete", async () => {
    const result = await parseMatchHistoryWithLoadMore(
      `<script>var g_sessionID = "session";</script><a id="load_more_clickable">Load More</a>`,
      MATCH_URL,
      NOW,
      { loadMoreDelayMs: 0 }
    );

    assert.equal(result.status, "pagination_unavailable");
  });

  it("returns history_scan_limited on repeated continue token", async () => {
    fetchMock = () => jsonResponse({
      success: true,
      html: "<table><tr><td>No Premier date</td></tr></table>",
      continue_token: "token0"
    });

    const result = await parseMatchHistoryWithLoadMore(
      historyPage("token0"),
      MATCH_URL,
      NOW,
      { loadMoreDelayMs: 0, maxLoadMorePages: 25 }
    );

    assert.equal(result.status, "history_scan_limited");
  });

  it("classifies AJAX login HTML before JSON parse", async () => {
    fetchMock = () => htmlResponse("<form id=\"loginForm\">Sign in to your Steam account</form>");

    const result = await parseMatchHistoryWithLoadMore(
      historyPage("token0"),
      MATCH_URL,
      NOW,
      { loadMoreDelayMs: 0, maxLoadMorePages: 25 }
    );

    assert.equal(result.status, "needs_login");
  });

  it("classifies final Steam login URL as needs_login", async () => {
    fetchMock = () => htmlResponse("<html></html>", "https://steamcommunity.com/login/home/?goto=gcpd");

    const result = await fetchAndParseMatchHistory(NOW, { loadMoreDelayMs: 0 });

    assert.equal(result.status, "needs_login");
  });

  it("classifies HTTP 429 as rate_limited", async () => {
    fetchMock = () => htmlResponse("Too many requests", MATCH_URL, { status: 429 });

    const result = await fetchAndParseMatchHistory(NOW, { loadMoreDelayMs: 0 });

    assert.equal(result.status, "rate_limited");
  });

  it("classifies Steam rate-limit marker as rate_limited", async () => {
    fetchMock = () => htmlResponse("{\"eresult\":84}", MATCH_URL);

    const result = await fetchAndParseMatchHistory(NOW, { loadMoreDelayMs: 0 });

    assert.equal(result.status, "rate_limited");
  });
});

describe("unranked season handling", () => {
  const OFFSEASON_RATING_HTML = `
    <table>
      <tr><th>Matchmaking Mode</th><th>Wins</th><th>Skill Group</th></tr>
      <tr><td>Premier</td><td>3</td><td>&nbsp;</td></tr>
    </table>
  `;

  it("clears stale rating when Steam reports the Premier row unranked", async () => {
    storageData = {
      latestPremierMatchAt: "2026-05-01T19:11:00.000Z",
      latestPremierMatchSource: "steam_gcpd_fetch",
      currentRating: 21345,
      ratingSource: "steam_matchmaking"
    };
    fetchMock = (url) => {
      const parsed = new URL(url);
      if (parsed.searchParams.get("tab") === "matchmaking") {
        return htmlResponse(OFFSEASON_RATING_HTML, url);
      }
      return htmlResponse(matchRow("May 1, 2026 @ 7:11pm GMT"), url);
    };

    const result = await refreshFromSteam({ matchHistoryLoadMoreDelayMs: 0 });

    assert.equal(result.ratingStatus, "unranked");
    assert.equal(result.currentRating, null);
    assert.equal(result.premierWins, 3);
    assert.equal(result.playBeforeAt, null);
    assert.equal(result.expirationAtEstimate, null);
    assert.equal(result.lastFetchStatus, "ok");
  });

  it("restores the timer when a rating appears again", async () => {
    storageData = {
      latestPremierMatchAt: "2026-05-01T19:11:00.000Z",
      currentRating: null,
      ratingStatus: "unranked",
      premierWins: 9
    };
    fetchMock = (url) => {
      const parsed = new URL(url);
      if (parsed.searchParams.get("tab") === "matchmaking") {
        return htmlResponse(RATING_HTML, url);
      }
      return htmlResponse(matchRow("May 1, 2026 @ 7:11pm GMT"), url);
    };

    const result = await refreshFromSteam({ matchHistoryLoadMoreDelayMs: 0 });

    assert.equal(result.ratingStatus, "ok");
    assert.equal(result.currentRating, 14250);
    assert.equal(result.premierWins, null);
    assert.ok(result.playBeforeAt);
  });

  it("clearRating message resets the timer to unranked", async () => {
    storageData = {
      latestPremierMatchAt: "2026-05-01T19:11:00.000Z",
      currentRating: 15000,
      ratingSource: "steam_matchmaking",
      premierWins: 2
    };

    const result = await handleMessage({ type: "clearRating" });

    assert.equal(result.currentRating, null);
    assert.equal(result.ratingStatus, "unranked");
    assert.equal(result.premierWins, null);
    assert.equal(result.playBeforeAt, null);
    assert.equal(result.latestPremierMatchAt, "2026-05-01T19:11:00.000Z");
  });
});

describe("openGcpd guided tabs", () => {
  it("waits for guided tabs to parse before returning state", async () => {
    const createdTabs = [];
    const originalCreate = globalThis.browser.tabs.create;
    const originalExecuteScript = globalThis.browser.scripting.executeScript;

    globalThis.browser.tabs.create = async (opts) => {
      const tab = { id: tabIdCounter++, url: opts.url, active: opts.active };
      createdTabs.push(tab);
      return tab;
    };

    globalThis.browser.scripting.executeScript = async () => [{
      result: {
        url: MATCH_URL,
        html: "<html><table><tr><td>Jun 8, 2026 @ 7:11pm GMT</td><td>Mirage</td></tr></table></html>"
      }
    }];

    const p = handleMessage({ type: "openGcpd" });

    await new Promise((r) => setTimeout(r, 50));

    for (const tab of createdTabs) {
      for (const listener of onUpdatedListeners) {
        listener(tab.id, { status: "complete" });
      }
    }

    const state = await p;

    assert.ok(state, "openGcpd should return state");
    assert.equal(createdTabs.length, 2, "should create 2 tabs");
    assert.ok(createdTabs.every((t) => t.active === false), "both tabs should open inactive");

    globalThis.browser.tabs.create = originalCreate;
    globalThis.browser.scripting.executeScript = originalExecuteScript;
  });
});

function historyPage(token) {
  return `
    <script>
      var g_sessionID = "session";
      var g_sGcContinueToken = "${token}";
    </script>
    <a id="load_more_clickable" onclick="ElementsContainerHistory_LoadMore(); return false;">Load More</a>
    <table><tr><td>No Premier date</td></tr></table>
  `;
}

function matchRow(value) {
  return `<table><tr><td>${value}</td><td>Mirage</td></tr></table>`;
}

function htmlResponse(body, url = MATCH_URL, options = {}) {
  const status = options.status ?? 200;
  return {
    headers: new Headers(options.headers || {}),
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    url
  };
}

function jsonResponse(data, url = MATCH_URL, options = {}) {
  return htmlResponse(JSON.stringify(data), url, options);
}
