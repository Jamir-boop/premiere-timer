import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractSteamGcpdLoadMoreState,
  extractDateCandidates,
  htmlToText,
  looksLoggedOut,
  parseSteamGcpdMatchHistory,
  parseSteamGcpdMatchmakingRating
} from "../extension/lib/parser.js";

describe("Steam GCPD parser", () => {
  it("detects login pages", () => {
    assert.equal(looksLoggedOut("<form id=\"loginForm\">Sign in to your Steam account</form>"), true);
  });

  it("strips HTML to text", () => {
    assert.equal(htmlToText("<table><tr><td>May&nbsp;27, 2026 @ 7:11pm</td></tr></table>"), "May 27, 2026 @ 7:11pm");
  });

  it("extracts Steam load-more state", () => {
    const html = `
      <script>
        var g_sessionID = "abc123";
        var g_sGcContinueToken = '3823456766813798400';
      </script>
      <a id="load_more_clickable" onclick="ElementsContainerHistory_LoadMore(); return false;">
        <div id="load_more_button">Load More History</div>
      </a>
    `;

    assert.deepEqual(extractSteamGcpdLoadMoreState(html), {
      continueToken: "3823456766813798400",
      sessionId: "abc123"
    });
  });

  it("does not treat load-more continue date as a match", () => {
    const html = `
      <div id="personaldata_elements_container" style="display: none;">
        <table class="generic_kv_table csgo_scoreboard_root">
          <tbody>
            <tr><th class="col_left">Map</th><th>Match Results</th></tr>
          </tbody>
        </table>
      </div>
      <script>
        var g_sessionID = "abc123";
        var g_sGcContinueToken = '3823456766813798400';
      </script>
      <div class="load_more_history_area">
        <div id="load_more_button_continue_text" class="returnLink">2026-06-01</div>
        <a id="load_more_clickable" onclick="ElementsContainerHistory_LoadMore(); return false;">
          <div id="load_more_button" class="btnv6_blue_hoverfade btn_medium">Load More History</div>
        </a>
      </div>
    `;

    const result = parseSteamGcpdMatchHistory(html, new Date("2026-06-02T12:00:00.000Z"));

    assert.equal(result.status, "no_premier_matches");
    assert.deepEqual(result.candidates, []);
  });

  it("extracts newest date from Steam-like page", () => {
    const html = `
      <table>
        <tr><td>May 1, 2026 @ 7:11pm</td><td>Mirage</td></tr>
        <tr><td>Apr 30, 2026 @ 6:02pm</td><td>Nuke</td></tr>
      </table>
    `;
    const result = parseSteamGcpdMatchHistory(html, new Date("2026-05-28T00:00:00.000Z"));

    assert.equal(result.status, "ok");
    assert.equal(result.latestPremierMatchAt, new Date(2026, 4, 1, 19, 11).toISOString());
  });

  it("infers missing year and rolls future dates back", () => {
    const dates = extractDateCandidates("Dec 31 @ 11:30pm", new Date("2026-01-02T12:00:00.000Z"));
    assert.equal(dates[0].getFullYear(), 2025);
  });

  it("handles day-month format", () => {
    const result = parseSteamGcpdMatchHistory(
      "<tr><td>27 May, 2026 @ 19:11</td></tr>",
      new Date("2026-05-28T00:00:00.000Z")
    );
    assert.equal(result.status, "ok");
    assert.equal(result.latestPremierMatchAt, new Date(2026, 4, 27, 19, 11).toISOString());
  });

  it("parses Steam GMT timestamp as UTC", () => {
    const dates = extractDateCandidates("2026-05-28 03:50:25 GMT");

    assert.equal(dates[0].toISOString(), "2026-05-28T03:50:25.000Z");
  });

  it("parses month-name GMT date as UTC", () => {
    const dates = extractDateCandidates(
      "May 28, 2026 @ 03:50:25 GMT",
      new Date("2026-05-29T00:00:00.000Z")
    );

    assert.equal(dates[0].toISOString(), "2026-05-28T03:50:25.000Z");
  });

  it("honors numeric timezone offsets", () => {
    const dates = extractDateCandidates("2026-05-28 03:50:25 -0500");

    assert.equal(dates[0].toISOString(), "2026-05-28T08:50:25.000Z");
  });

  it("keeps unmarked dates as local time", () => {
    const dates = extractDateCandidates(
      "May 28, 2026 @ 03:50",
      new Date("2026-05-29T00:00:00.000Z")
    );

    assert.equal(dates[0].toISOString(), new Date(2026, 4, 28, 3, 50).toISOString());
  });

  it("extracts Premiere Skill Group rating", () => {
    const result = parseSteamGcpdMatchmakingRating("<tr><td>Premiere Skill Group</td><td>14250</td></tr>");

    assert.equal(result.status, "ok");
    assert.equal(result.currentRating, 14250);
  });

  it("extracts comma-formatted Premier Skill Group rating", () => {
    const result = parseSteamGcpdMatchmakingRating("<div>Premier Skill Group 14,250</div>");

    assert.equal(result.status, "ok");
    assert.equal(result.currentRating, 14250);
  });

  it("extracts Premier row Skill Group from matchmaking table", () => {
    const html = `
      <tbody>
        <tr>
          <th>Matchmaking Mode</th>
          <th>Wins</th>
          <th>Ties</th>
          <th>Losses</th>
          <th>Skill Group</th>
          <th>Last Match</th>
          <th>Region</th>
        </tr>
        <tr>
          <td>Premier</td><td>123</td><td>2</td><td>24</td><td>26269</td><td>2026-05-28 03:50:25 GMT</td><td>2</td>
        </tr>
        <tr>
          <td>Competitive</td><td>596</td><td>98</td><td>523</td><td>12</td><td>2023-09-17 16:47:54 GMT</td><td>2</td>
        </tr>
        <tr>
          <td>Wingman</td><td>179</td><td>37</td><td>100</td><td>14</td><td>2026-05-12 02:11:46 GMT</td><td>2</td>
        </tr>
      </tbody>
    `;
    const result = parseSteamGcpdMatchmakingRating(html);

    assert.equal(result.status, "ok");
    assert.equal(result.currentRating, 26269);
  });

  it("ignores non-Premier Skill Group values in matchmaking table", () => {
    const html = `
      <tr><th>Matchmaking Mode</th><th>Skill Group</th></tr>
      <tr><td>Competitive</td><td>26269</td></tr>
      <tr><td>Wingman</td><td>15250</td></tr>
    `;
    const result = parseSteamGcpdMatchmakingRating(html);

    assert.equal(result.status, "rating_not_found");
    assert.equal(result.currentRating, null);
  });

  it("returns rating_not_found when matchmaking table is missing Skill Group header", () => {
    const html = `
      <tr><th>Matchmaking Mode</th><th>Wins</th></tr>
      <tr><td>Premier</td><td>26269</td></tr>
    `;
    const result = parseSteamGcpdMatchmakingRating(html);

    assert.equal(result.status, "rating_not_found");
    assert.equal(result.currentRating, null);
  });

  it("returns rating_not_found when matchmaking table has invalid Premier Skill Group", () => {
    const html = `
      <tr><th>Matchmaking Mode</th><th>Skill Group</th></tr>
      <tr><td>Premier</td><td>12</td></tr>
      <tr><td>Competitive</td><td>26269</td></tr>
    `;
    const result = parseSteamGcpdMatchmakingRating(html);

    assert.equal(result.status, "rating_not_found");
    assert.equal(result.currentRating, null);
  });

  it("returns needs_login for logged-out matchmaking page", () => {
    const result = parseSteamGcpdMatchmakingRating("<form id=\"loginForm\">Sign in to your Steam account</form>");

    assert.equal(result.status, "needs_login");
    assert.equal(result.currentRating, null);
  });

  it("returns rating_not_found when matchmaking label is missing", () => {
    const result = parseSteamGcpdMatchmakingRating("<div>Skill Group 14250</div>");

    assert.equal(result.status, "rating_not_found");
    assert.equal(result.currentRating, null);
  });

  it("returns rating_not_found for invalid matchmaking values", () => {
    const result = parseSteamGcpdMatchmakingRating("<div>Premier Skill Group 999</div><div>Unrelated 14250</div>");

    assert.equal(result.status, "rating_not_found");
    assert.equal(result.currentRating, null);
  });
});
