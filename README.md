# Guild Defence Optimizer

A dependency-free, local-first prototype for planning Summoners War Siege and World Guild Battle defences from pasted candidate data and monster availability.

## Run

Serve this directory with any static HTTP server, for example:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000>. The app has three steps: import tables, review cleaned tables, then optimize. Paste any combination of these copied tables with their header rows; providing all three is recommended:

- **Siege · 4-star defences:** the 4-star category.
- **Siege · all defences:** exact teams from the 4-star table are removed; the remainder forms the 5-star category. If pasted alone, its rows are treated as 5-star category candidates.
- **World Guild Battle:** the all-defences list, with no rarity split.

After cleaning, the app moves to the cleaned-data step, which shows Siege 4-star, Siege 5-star remainder, and WGB tables side by side. Missing sources remain empty and do not block the next step. The importer collapses doubled labels such as `FionaFiona`, extracts the integer battle count from cells such as `1,048 / 0.2%`, and parses `WR%` separately. In the optimize step, switch between Siege and WGB when that dataset has been imported. Every unique monster starts with one available copy. Set the copy count to zero for monsters you do not have, or increase it for built duplicates. The roster is grouped with 5★/unknown monsters first, then 4★/lower monsters; each group is ordered by defence appearances and average WR. Candidate tables show the highest-WR teams first.

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

Siege uses editable requested counts for teams from the supplied four-star list and from the all-defences list after removing those four-star teams. The latter is referred to as the 5★ category, based on the source table comparison rather than catalog-verified rarity. World Guild Battle returns five teams without a rarity split. The optimizer respects each monster's entered copy count, shows average historical win rate, and reports the closest feasible Siege portfolio when the requested counts cannot be met.

The app intentionally has no live SWGT connector. Add one only after written permission specifies a supported access method, permitted fields, retention and refresh frequency. Imported data should be used only under the applicable authorization; this local prototype does not determine data rights.
