# Guild Defence Optimizer

A dependency-free, local-first prototype for planning Summoners War Siege and World Guild Battle defences from a candidate dataset and each player's usable monster copies.

## Run

Serve this directory with any static HTTP server, for example:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000>. A clearly labelled synthetic example loads by default. Paste the copied table with its header row:

- **Siege:** paste both the four-star-only list and the all-defences list. Exact teams in the four-star list are removed from the all-defences list; the remaining teams form the Siege nat-five category.
- **World Guild Battle:** select that mode and paste its all-defences list. No rarity split is applied.

The importer collapses doubled labels such as `FionaFiona`, extracts the integer battle count from cells such as `1,048 / 0.2%`, and parses `WR%` separately. Pasted monster rarity is not present in these tables, so it starts as unknown. Set natural stars in the roster table; unknown and nat-five monsters cannot be assigned extra builds. Newly imported monsters start with zero usable copies.

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

Siege returns four teams using only natural 4★-or-lower monsters and six teams containing at least one natural 5★. World Guild Battle returns five teams without a rarity quota. Both modes optimize each up-to-copy budget independently, cap nat-five usage at one copy, and show average historical win rate and required builds. Infeasible results are not presented as complete portfolios.

The app intentionally has no live SWGT connector. Add one only after written permission specifies a supported access method, permitted fields, retention and refresh frequency. Imported data should be used only under the applicable authorization; this local prototype does not determine data rights.
