# Guild Defence Optimizer

A dependency-free, local-first prototype for planning Summoners War Siege and World Guild Battle defences from pasted candidate data and monster availability.

## Run

Serve this directory with any static HTTP server, for example:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000>. Paste the copied table with its header row:

- **Siege:** paste both the four-star-only list and the all-defences list. Exact teams in the four-star list are removed from the all-defences list; the remaining teams form the Siege nat-five category.
- **World Guild Battle:** select that mode and paste its all-defences list. No rarity split is applied.

After a successful paste, the paste form collapses and the cleaned candidate tables are shown. The importer collapses doubled labels such as `FionaFiona`, extracts the integer battle count from cells such as `1,048 / 0.2%`, and parses `WR%` separately. Every unique monster in the data starts with one available copy. Set the copy count to zero for monsters you do not have, or increase it for built duplicates. The roster is grouped with 5★/unknown monsters first, then 4★/lower monsters; each group is ordered by defence appearances and average WR. Candidate tables show the highest-WR teams first.

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
