# Guild Defence Optimizer

A dependency-free, local-first prototype for planning Summoners War Siege and World Guild Battle defences from pasted candidate data and monster availability.

## Run

Serve this directory with any static HTTP server, for example:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000>. Choose **Siege** or **World Guild Battle** on the intro tab, then import the data for that mode, review it, and optimize. Siege and WGB imports are kept separate.

Choose **System**, **Light**, or **Dark** from the appearance selector in the page header. The selection is saved in this browser; System follows the device appearance preference.

- **Siege:** rank-aware 4-star and all-defenses tables are imported separately. The second category is the table-derived all-defenses remainder.
- **World Guild Battle:** rank-aware tables use one candidate list, with no rarity split.

For rank-aware Siege analysis, paste eight 4-star-only and all-defenses tables: G1, G2, G3, and ALL-ranks for each source. Within each source, ALL means all ranks. The app builds the 4-star category from the four 4-star tables, then removes every team identity found in any of those four tables from each all-defenses table; the remaining teams form the **all-defenses remainder**. This category is derived from source-table comparison, not catalog-verified rarity. Tables must use matching seasons, snapshots, and filters. For rank-aware WGB, paste G1, G2, G3, and ALL-ranks tables into its separate import; WGB has no rarity split.

Ranked portfolios choose the best available evidence for each defense in this order: measured G1, inferred G1, measured G2, inferred G2, then measured G3. Inferred results require complete rank tables and a consistent residual; each option is scored conservatively with a Wilson lower bound. ALL-only candidates remain visible but are not given an ALL-rank substitute. The roster's average priority-rank win rate uses the same evidence selection, so lower-rank candidates with usable samples are not shown as missing.

After cleaning, the review step shows only the selected mode's tables. The importer collapses doubled labels such as `FionaFiona`, extracts the integer battle count from cells such as `1,048 / 0.2%`, and parses `WR%` separately. The **Complete JSON import/export** panel imports or exports a single Siege file containing all eight categorized tables; it can be reused without pasting each table again. Each mode has its own saved monster availability; selecting a different mode does not overwrite it. Every unique monster starts with one available copy. Set the copy count to zero for monsters you do not have, or increase it for built duplicates. Siege rosters are grouped with 5★/unknown monsters first, then 4★/lower monsters; WGB has one unsegmented roster.

For Siege, request any mix of 4★-list and remaining all-defences-list teams, up to ten total. If that exact mix cannot be built, the optimizer shows the largest available portfolio with the closest category mix, identifies the missing category counts, then recommends eligible defenses from either category for any remaining slots. These filler defenses respect roster counts, copy caps, build budget and the duplicate-team setting. Select the 1–5 copy tab to set the maximum number of times each available 4★/lower monster may be used across the whole portfolio; changing a tab immediately re-optimizes. Exact team repeats are off by default; turn on **Allow the same exact team more than once** to permit them.

No data or roster is sent to a server.

Run the solver checks with `node --test tests/optimizer.test.cjs`.

## Candidate data format

Normalized JSON import is also available. `naturalStars` means natural rarity (0 means unknown), not current/awakened stars. `winRate` is a percentage and `battles` is the positive integer battle count; the sample share is not used.

```json
{
  "title": "Authorized snapshot",
  "snapshot": "Season or date; battle type and rank scope",
  "monsters": [
    { "id": "monster-1", "name": "Display name", "naturalStars": 4 },
    { "id": "monster-2", "name": "Another monster", "naturalStars": 5 },
    { "id": "monster-3", "name": "Third monster", "naturalStars": 3 }
  ],
  "teams": [
    { "leader": "monster-1", "members": ["monster-2", "monster-3"], "winRate": 18.2, "battles": 1109 }
  ]
}
```

For rank-aware imports, Siege needs separate rank tables for its 4-star list and its all-defenses list; WGB needs one set with no rarity split. Rank tables omit combinations below their display threshold; an omitted row is not a zero win rate. The complete Siege export uses `format: "guild-defense-complete-siege-v1"` and holds records in `fourStarTables` and `allTables`, each keyed by G1, G2, G3, and ALL. Each row has `names` (leader then two members), `battles`, `winRate`, and `precision`. The optional normalized JSON representation adds `rankAware`, dataset- and team-level `rankTablesProvided`, and per-team `rankData`:

```json
{
  "title": "Rank-scoped 4-star Siege snapshot",
  "snapshot": "Season, date, and filter scope",
  "mode": "siege",
  "rankAware": true,
  "rankTablesProvided": ["G1", "G2", "G3", "ALL"],
  "monsters": [
    { "id": "morris", "name": "Morris", "naturalStars": 0, "rosterGroup": "fourStar" },
    { "id": "orion", "name": "Orion", "naturalStars": 0, "rosterGroup": "fourStar" },
    { "id": "trevor", "name": "Trevor", "naturalStars": 0, "rosterGroup": "fourStar" }
  ],
  "teams": [
    {
      "leader": "morris",
      "members": ["orion", "trevor"],
      "winRate": 16.2,
      "battles": 6343,
      "siegeCategory": "fourStar",
      "rankTablesProvided": ["G1", "G2", "G3", "ALL"],
      "rankData": {
        "G2": { "winRate": 19.0, "battles": 1672, "precision": 1 },
        "G3": { "winRate": 12.2, "battles": 3687, "precision": 1 },
        "ALL": { "winRate": 16.2, "battles": 6343, "precision": 1 }
      }
    }
  ]
}
```

`rankTablesProvided` records which complete rank tables were pasted, even when a particular defense has no row in one of them. Do not list a table that was not supplied: a missing G1 table is not evidence that a defense was censored there.

For combined Siege JSON, each team carries `rankData` and `rankTablesProvided` from its own source category. Teams with `siegeCategory: "fourStar"` use the 4-star source; teams with `siegeCategory: "natFive"` use the all-defenses remainder. WGB uses `mode: "wgb"` and omits `siegeCategory`; it still supports `rankData` and the same rank-aware scoring.

The `precision` field is the number of decimal places shown for that percentage in the source table. It is used to conservatively bound the unknown win count implied by rounded percentages. Measured rank results are scored with a 95% Wilson lower bound based on the lowest win count consistent with the displayed rate. If a team is absent from G1 but present in ALL, G2, and G3, and all four tables for that team's source category were imported, the app may infer the residual G1 battle count and a rounding-bounded rate; similarly, it can infer G2 from ALL, G1, and G3. An inferred score uses the lowest plausible residual win count and a Wilson lower bound. The result is labeled **inferred**. If a rank cannot be directly measured or reconstructed, the next rank in the priority order is used when available; ALL alone is not treated as a ranked substitute.

Rank-aware portfolios optimize the conservative score for the selected priority rank; the UI still shows displayed rates, confidence intervals or inferred rounding ranges, sample counts, and all available rank context. Wilson bounds represent sampling uncertainty only. They do not correct SWGT contributor-selection bias or make rank differences causal. G1 is preferred; G2 is fallback context, G3 is a high-end stress test, and ALL is for discovery—not a ranked substitute. The score is a conservative decision aid, not a predicted intrinsic win probability.

Siege uses editable requested counts for teams from the supplied four-star list and from the all-defenses remainder after removing all identities found across the four 4-star source tables. This remainder is table-derived, not verified monster rarity. World Guild Battle returns five teams without a rarity split. The optimizer respects each monster's entered copy count and reports the closest feasible Siege portfolio when requested category counts cannot be met.

The app intentionally has no live SWGT connector. Add one only after written permission specifies a supported access method, permitted fields, retention and refresh frequency. Imported data should be used only under the applicable authorization; this local prototype does not determine data rights.
