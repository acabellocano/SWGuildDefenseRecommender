# Summoners War Guild Siege Defence Optimizer — Handover

Date: 2026-09-30  
Status: product and technical handover; no application implemented.  
Scope: an independent future guild tool, not a feature of the FRIDAY ticket-processing platform.

## 1. Goal and essential corrections

Allow guild members to find the best portfolio of siege defences given their own monster roster, usable copy counts, and willingness/capacity to build additional copies.

The initial use case is **10 three-monster defences: 4 four-star-only teams and 6 teams containing at least one natural-five-star monster**. Optimize all ten together because the same lower-rarity monster can appear in both categories.

Decisions established in this conversation:

- Missing monsters must exclude the entire candidate team; do not invent replacements.
- The user does not own **Velaska or Craig**, in addition to the original exclusions below.
- **Natural-five-star monsters cannot be duplicated**, even when the global duplicate budget is positive. Lamiella, Chandra and Odin are examples, not an exhaustive ban list.
- Lower-rarity monsters may be duplicated only when the member permits it and can supply/build the additional copies.
- A duplicate budget counts **additional monster copies**, not duplicated species or complete teams.
- Preserve the listed leader. Repeat a complete team only if enough eligible copies of all three monsters exist.
- Maximize the **unweighted average historical win rate** across the selected defences, not a battle-weighted average.
- Budgets are **up to** a limit. Never require unnecessary builds merely to exhaust the budget.
- Independently optimal portfolios for budgets 0–5 are not necessarily a cumulative build sequence.
- Historical win rates are observations, not predictions or guaranteed future performance.

## 2. SWGT data source: observations and integration gate

### Requested URL

<https://swgt.io/controllers/allServerAnalytics/defenseTrending/load?selectedFocus=UP_229728&siegeSpecialDate=SSD_70&battleType=SIEGE&battleRank=*&naturalStars=*>

### Verified on the handover date

- An unauthenticated request returned HTTP **200**, content type **text/html;charset=UTF-8**, without a redirect.
- The response is an HTML analytics page with a defence table, **not a verified public JSON API**.
- Visible columns are Monster Leader, Monster 2, Monster 3, Battles, and WR%.
- The Battles cell combines a count and a share, for example `1,048 / 0.2%`. The share is not the team's win rate.
- The page states that teams need at least **1,000 logged battles** to appear. Consequently this is a thresholded candidate set, not every possible defence.
- The visible scope was Season 22 (07/27/2026–11/21/2026), Siege, any/all battle ranks, and any/all natural stars. The rendered table reported 69 entries.
- The live results differ from the original pasted lists. Do not combine those datasets or expect the historical example scores to reproduce against this live page.
- A login link being visible does not establish that every scope is public or that automated reuse is authorized.

### Important permission prerequisite

SWGT's [User Agreement](https://swgt.io/useragreement), effective 07/18/2026, expressly requires written permission for automated extraction/republication, including scrapers, bots, AI systems and browser automation. It also restricts reuse of its proprietary content and implementation.

**Do not implement or run recurring extraction, archive the source, or publish SWGT-derived datasets in the app without the required permission.** Public accessibility and HTTP 200 are not permission. No continuing source inspection is needed until this is resolved.

Before live integration:

1. Contact SWGT at <mailto:info@swgt.io> and explain the private guild optimizer use case.
2. Obtain written authorization covering access method, permitted fields, storage, retention, refresh frequency, member access, exports and attribution.
3. Ask whether there is a supported API, export, or partner feed. Prefer that over HTML ingestion.
4. Establish whether the requested scope requires a member account/subscription and how approved access should be handled.
5. If authorization is unavailable, develop with synthetic fixtures or appropriately licensed/member-owned battle records. Manual upload is not automatically permission to republish SWGT content.

### URL parameter interpretation

| Parameter | Observed value | Treatment in a future app |
| --- | --- | --- |
| `selectedFocus` | `UP_229728` | Opaque identifier; meaning, ownership and whether it affects personalization are not verified. Do not hard-code it as a universal guild identifier. |
| `siegeSpecialDate` | `SSD_70` | Opaque period identifier; the displayed label was Season 22. Resolve approved choices dynamically or configure them explicitly. |
| `battleType` | `SIEGE` | Source battle-type selection. |
| `battleRank` | `*` | Displayed any/all ranks; available rank values are not established here. |
| `naturalStars` | `*` | Displayed any/all natural stars; exact four-star filter encoding is not established here. |

Build URLs using a URL/query API, not string concatenation. Never assume the opaque identifiers or source schema remain stable.

## 3. Member workflow and MVP

1. A member selects an authorized analytics snapshot: season/date, battle type and rank scope.
2. They create or update their roster using a searchable monster catalog and explicit usable copy counts.
3. They specify their defence mix, defaulting to 4 four-star and 6 nat-five teams.
4. They choose a maximum additional-copy budget, default comparison range 0–5.
5. They optionally restrict individual monsters: no additional copies, maximum extra copies, or excluded entirely.
6. The app filters unavailable/unknown candidates and solves all requested budgets against the same immutable snapshot.
7. Results show the complete portfolios, changes between budgets, resource usage and marginal WR gains.

MVP output for every budget:

- Exactly the requested number of teams in each category, or an explicit infeasibility explanation.
- Leader, both teammates, historical WR, sample size and snapshot scope for every defence.
- Per-monster usage, usable copies already owned and additional copies to build.
- Average WR, gain over budget zero and gain over the preceding budget, in percentage points.
- Which teams changed; avoid forcing the member to compare two long lists manually.
- Solver status: proven optimal, feasible but unproven, timed out, or infeasible.
- Source freshness, data warnings and roster assumptions.

Keep guild-member roster editing private by default. Sharing a plan should be opt-in. MVP optimizes each member independently; coordinated guild-wide tower planning is a later feature.

### Category convention versus actual tower eligibility

For the historical example, categories are disjoint:

- **Four-star-only:** every monster has natural rarity at most 4; natural-three-star/second-awakened monsters remain eligible.
- **Nat-five:** at least one monster has natural rarity 5.

The unrestricted tower category may accept lower-rarity-only teams in the game. Do not confuse game eligibility with this user's preference for six teams containing nat-fives. A later explicit setting can allow any team in unrestricted slots; never silently change the requested optimization problem.

## 4. Monster identity, rarity and roster semantics

Use stable internal monster IDs. Display names alone are insufficient: names can change, be localized or temporarily be family/element labels.

Recommended catalog fields:

| Field | Purpose |
| --- | --- |
| `monsterId` | Stable internal identity, independent of source display labels. |
| `displayName`, `aliases` | Search, manual import and historical names. |
| `element`, `family` | Disambiguation; never merge elements or entire families. |
| `naturalStars` | Tower classification and duplicate-policy enforcement. |
| `sourceMappings` | Provider-specific identifiers mapped to the internal identity. |
| `catalogVersion` | Reproducibility and migration of saved rosters. |

A possible catalog provider is [SWARFARM's monster API](https://swarfarm.com/api/v2/monsters/), subject to verifying its current usage terms and coverage. Provider IDs must not be assumed interchangeable with SWGT or game identifiers.

**Use `natural_stars`, not `base_stars`, when consuming SWARFARM metadata.** Verified examples: Fiona and Conrad report `natural_stars: 4` while `base_stars: 5`; Monte is natural 4 and Shahat is natural 5. Awakened/evolved stars are not natural rarity.

The source label **Wind Qilin Slasher** was not resolved by an exact-name SWARFARM lookup during this conversation. Verify its correct identity/rarity and any renamed/collaboration equivalent rather than guessing or treating it as duplicable. Teams containing unknown identities/rarities must be quarantined until resolved.

Roster input should distinguish:

- `usableOwnedCopies`: copies available for these defences now, after reserves/exclusions.
- `maxAdditionalCopies`: extra copies this member is willing and able to build/supply.
- `excluded`: prevents all use, even if owned.
- Optional notes about unbuilt copies, skill-ups and acquisition availability; these are not automatically usable supply.

Default policy: a monster must already be owned to be eligible; unavailable monsters cannot be acquired just by spending the duplicate budget. Natural-five-star usage is capped at one usable copy and zero new copies, matching the user's restriction. Future support for existing duplicate nat-fives must be an explicit product decision, not an implicit exception.

Distinguish two reported counts:

- **Additional copies to build:** usage exceeding current usable inventory; this consumes the budget.
- **Duplicate copies deployed:** usage exceeding one per species; an already-owned second usable copy can count here without requiring a new build.

All historical examples assume exactly one usable copy of each available monster, so these counts coincide. The UI must explain the distinction for real rosters.

## 5. Candidate normalization and data contract

Normalize each source observation into:

| Field | Meaning |
| --- | --- |
| `teamKey` | Leader ID plus canonical ordering of the two nonleader IDs. |
| `leaderId`, `memberIds` | Exact three-monster composition; preserve the leader separately. |
| `category` | Derived from verified natural rarity under the chosen category convention. |
| `battles` | Integer battle count, excluding the displayed percentage share. |
| `winRateBps` | Integer basis points: 20.4% becomes 2040, avoiding floating-point tie errors. |
| `wins`, `losses` | Optional exact source counts; do not invent them from rounded WR. |
| `snapshotId`, `sourceScope` | Immutable observation provenance. |
| `fetchedAt`, `sourceUrl`, `parserVersion` | Freshness and authorized ingestion traceability. |

Cleaning rules:

1. Normalize whitespace and known aliases. For this user's pasted input, `Geldnit` meant Geldnir and `Nephtis` meant Nephthys; show alias corrections rather than silently accepting every fuzzy match.
2. Repeated strings such as `FionaFiona`, `Liu MeiLiu Mei` and `ROBO-R40ROBO-R40` resulted from copied labels/image text. Resolve against the catalog. Do not blindly split every string in half or by spaces.
3. For any future authorized structured feed, prefer its explicit identity fields. For authorized HTML ingestion, extract one verified label per monster cell; exact selectors/schema still require approved implementation work.
4. Do not infer roster ownership from grey images, missing copy formatting or source CSS. Ownership is explicit member input.
5. Deduplicate the same team appearing in all-defences and four-star-only results. Never add their battles or count them as independent evidence.
6. Treat identical nonleader orderings as one team only when source semantics confirm those orders are equivalent. Changing the leader always changes the team key. If duplicate observations conflict, flag them rather than selecting the highest WR opportunistically.
7. Validate exactly three resolved monsters, positive battle counts, WR in [0%, 100%], consistent snapshot scope and known natural rarity.
8. Exclude teams with unavailable members; show which monsters prevented eligibility.
9. A source schema change, login page, malformed response or unexpected empty result is an import error, not a valid zero-team snapshot. Preserve the previous valid snapshot with a stale warning when authorized retention permits it.

Store snapshot provenance separately from each member's roster. The original copied four-star and all-defences lists overlapped. After corrected exclusions and cross-list deduplication, the historical candidate sets contain **31 four-star teams and 26 nat-five teams**.

## 6. Exact optimization model

Let:

- $T_4$ and $T_5$ be eligible candidate sets under the selected category convention.
- $x_t$ be the nonnegative integer number of instances of candidate team $t$ selected.
- $a_{mt}$ be the number of appearances of monster $m$ in one instance of team $t$.
- $o_m$ be usable owned copies and $k_m$ the allowed maximum additional copies.
- $u_m$ be total selected usage of monster $m$.
- $y_m$ be the additional copies required and $D$ the global budget.
- $w_t$ be the listed win rate in integer basis points.

Required constraints for the initial use case:

$$
\sum_{t\in T_4} x_t=4,\qquad \sum_{t\in T_5} x_t=6
$$

$$
u_m=\sum_t a_{mt}x_t,\qquad u_m\le o_m+k_m
$$

$$
y_m\ge u_m-o_m,\qquad 0\le y_m\le k_m,\qquad \sum_m y_m\le D
$$

For natural-five-star monsters, enforce $k_m=0$ and $u_m\le\min(o_m,1)$. For other monsters, $k_m$ comes from explicit member capacity, not from rarity alone. All copy-count variables are integers.

Objective:

$$
\max \sum_t w_t x_t
$$

With a fixed ten-team count, maximizing that sum is equivalent to maximizing average WR. Compute average percentage as $\sum_t w_t x_t/(100\times10)$.

Tie-breaking: first maximize WR, then minimize actual additional-copy requirements, then use deterministic team-ID ordering. Report actual $\max(0,u_m-o_m)$ counts rather than trusting slack values in solver variables.

Do not optimize categories separately or greedily take the highest-WR remaining team. Cross-category resource overlap makes this a constrained integer portfolio problem. Do not prohibit complete repeated teams globally: repeating a lower-rarity-only team is allowed when its three copies fit the budget.

### Implementation choice and correctness

- For small datasets, a deterministic branch-and-bound solver is sufficient. This conversation used a transient Node.js calculation, not a saved production solver.
- The calculation enumerated team multisets and used optimistic bounds that relax conflicts among remaining teams; a pruning bound must never underestimate feasible scores.
- The solver was checked against independent small brute-force cases, including forbidden duplicates, and validated every returned portfolio's counts, WR sum and budgets.
- For larger candidate pools or richer constraints, use a maintained integer/constraint solver instead of extending a custom solver indefinitely. Choose the runtime/library during implementation, not in this handover.
- A previous budget's optimum can seed a lower bound for the next budget but must not lock its teams or build choices.
- Use a deadline/cancellation option. A timed-out incumbent is a feasible result, not a proven optimum.
- Freeze the snapshot and roster version for all budgets in one comparison. Recheck every returned portfolio independently of the search implementation.

Optional future **cumulative build planning** is a different optimization: once a copy is built, later steps retain that investment. The independent budget curve below must not be marketed as a mandatory sequential build plan.

## 7. Historical regression example from this conversation

This section records the **user-provided historical pasted dataset**, not a current SWGT download, and does not authorize external redistribution. Use synthetic tests where source rights are not established. The full numeric fixture is included below for reproducibility of the previous calculation; live integration needs separate approved data.

### Missing-monster fixture

- Lower rarity: Truffle, Molly, Vritra.
- Natural 5: Byungchul, Driana, Son Zhang Lao, Geldnir, Irene, Rahul, Sylvia, Daphnis, Lora, Craka, Narsha, Lionel, Vendhan, Maximilian, Chakra, Nephthys, **Velaska, Craig**.
- Exactly one usable copy of every other monster referenced in the filtered fixture.
- Unlimited additional lower-rarity copies up to the global budget for this mathematical example; zero additional nat-five copies. Real member capacity can be more restrictive.
- Wind Qilin Slasher was treated as a nonduplicable nat-five fixture identity; live metadata still needs verification.

### Expected independently optimal scores

| Budget | Additional copies | Average WR | Gain vs zero (pp) | Gain vs previous (pp) |
| ---: | --- | ---: | ---: | ---: |
| 0 | None | 17.14% | 0.00 | — |
| 1 | Conrad | 17.20% | 0.06 | 0.06 |
| 2 | Conrad, ROBO-R40 | 17.38% | 0.24 | 0.18 |
| 3 | Fiona, Emily, Eshir | 17.54% | 0.40 | 0.16 |
| 4 | Fiona, Emily, Eshir, Conrad | 17.60% | 0.46 | 0.06 |
| 5 | Fiona, Emily, Eshir, Conrad, ROBO-R40 | 17.75% | 0.61 | 0.15 |

Each name above means one additional copy. Previous recommendations involving a duplicated Lamiella or the unavailable Velaska are **invalid and superseded**.

### Seven teams common to every optimal portfolio

| Category | Leader | Monster 2 | Monster 3 | WR |
| --- | --- | --- | --- | ---: |
| 4-star | Fiona | Emily | Eshir | 20.4% |
| 4-star | Conrad | Kinki | ROBO-R40 | 19.8% |
| Nat-five | Seara | Orion | Perna | 18.2% |
| Nat-five | Odin | Adriana | Wind Qilin Slasher | 17.4% |
| Nat-five | Moore | Rakan | Savannah | 16.1% |
| Nat-five | Lamiella | Ashour | Taranys | 16.0% |
| Nat-five | Ramael and Judiah | Cadiz | Ren | 14.8% |

Add the three teams in the appropriate row below to obtain that budget's complete ten-team portfolio. The first monster is the leader; `second instance` means a complete additional team with separate copies.

| Budget | Third 4-star team | Fourth 4-star team | Sixth nat-five team |
| ---: | --- | --- | --- |
| 0 | Martina / Shaina / Triana (16.7%) | Morris / Rex / Shumar (16.4%) | Ophilia / Riley / Theomars (15.6%) |
| 1 | Martina / Shaina / Triana (16.7%) | Morris / Rex / Shumar (16.4%) | Conrad / Ophilia / Theomars (16.2%) |
| 2 | Conrad / Grego / ROBO-R40 (18.8%) | Martina / Shaina / Triana (16.7%) | Ophilia / Riley / Theomars (15.6%) |
| 3 | Fiona / Emily / Eshir, second instance (20.4%) | Martina / Shaina / Triana (16.7%) | Ophilia / Riley / Theomars (15.6%) |
| 4 | Fiona / Emily / Eshir, second instance (20.4%) | Martina / Shaina / Triana (16.7%) | Conrad / Ophilia / Theomars (16.2%) |
| 5 | Fiona / Emily / Eshir, second instance (20.4%) | Conrad / Grego / ROBO-R40 (18.8%) | Ophilia / Riley / Theomars (15.6%) |

Interpretation: three additional copies give the highest average gain per build among these options; four is a weak stopping point; five maximizes raw WR. The total five-copy improvement is only 0.61 percentage points. Rune quality and build effort can outweigh such small historical differences.

### Full filtered four-star fixture: 31 teams

| Leader | Monster 2 | Monster 3 | Battles | WR |
| --- | --- | --- | ---: | ---: |
| Fiona | Emily | Eshir | 1,021 | 20.4% |
| Conrad | Kinki | ROBO-R40 | 1,240 | 19.8% |
| Conrad | Grego | ROBO-R40 | 1,008 | 18.8% |
| Martina | Shaina | Triana | 1,041 | 16.7% |
| Morris | Rex | Shumar | 4,158 | 16.4% |
| Morris | Orion | Trevor | 6,344 | 16.2% |
| Fiona | Deborah | Eshir | 1,041 | 16.0% |
| Morris | Guillaume | Rex | 3,120 | 15.4% |
| Morris | Figaro | Trevor | 1,493 | 14.9% |
| Morris | Guillaume | Orion | 1,203 | 14.5% |
| Mihyang | Cichlid | Hraesvelg | 2,617 | 14.2% |
| Fiona | Hraesvelg | Liesel | 1,521 | 13.5% |
| Mimirr | Gamir | Rex | 4,538 | 13.2% |
| Fiona | Emily | Vigor | 2,080 | 12.9% |
| Morris | Abigail | Eshir | 8,025 | 12.9% |
| Morris | Eshir | Reno | 6,041 | 12.8% |
| Mihyang | Hraesvelg | Rex | 2,426 | 12.3% |
| Morris | Liu Mei | Vigor | 13,263 | 12.1% |
| Solveig | Cichlid | Eshir | 1,802 | 12.0% |
| Fiona | Lavender | Liesel | 1,197 | 11.8% |
| Solveig | Eshir | Orion | 2,283 | 11.7% |
| Fiona | Eshir | Liesel | 20,142 | 11.6% |
| Morris | Iris | Tarq | 3,931 | 11.4% |
| Solveig | Fuuki | Orion | 2,580 | 11.2% |
| Mihyang | Gamir | Rex | 1,721 | 11.0% |
| Morris | Kahn | Rex | 1,673 | 10.5% |
| Mimirr | Chilling | Cichlid | 1,418 | 10.5% |
| Fiona | Hraesvelg | Rex | 1,829 | 10.5% |
| Solveig | Cichlid | Vigor | 4,084 | 10.5% |
| Fiona | Eshir | Luer | 1,370 | 9.9% |
| Morris | Eshir | Orion | 2,026 | 7.4% |

### Full filtered nat-five fixture: 26 teams

| Leader | Monster 2 | Monster 3 | Battles | WR |
| --- | --- | --- | ---: | ---: |
| Seara | Orion | Perna | 1,109 | 18.2% |
| Odin | Adriana | Wind Qilin Slasher | 1,752 | 17.4% |
| Conrad | Ophilia | Theomars | 2,602 | 16.2% |
| Moore | Rakan | Savannah | 1,330 | 16.1% |
| Lamiella | Ashour | Taranys | 1,166 | 16.0% |
| Ophilia | Riley | Theomars | 1,078 | 15.6% |
| Chandra | Monte | Wind Qilin Slasher | 2,348 | 15.1% |
| Seara | Orion | Rakan | 1,528 | 15.1% |
| Ramael and Judiah | Cadiz | Ren | 1,112 | 14.8% |
| Chandra | Jaara | Taranys | 1,274 | 14.0% |
| Lamiella | Adriana | Odin | 1,297 | 13.4% |
| Carcano | Layla | Shi Hou | 1,063 | 13.4% |
| Tarnisha | Layla | Shi Hou | 1,543 | 12.6% |
| Ashour | Brita | Taranys | 2,729 | 12.3% |
| Ramael and Judiah | Ren | Shahat | 1,435 | 12.2% |
| Seara | John | Woonsa | 1,014 | 11.8% |
| Seara | Jeogun | Lamiella | 9,049 | 11.5% |
| Moore | Savannah | Tesarion | 1,474 | 11.2% |
| Fiona | Ethna | Lamiella | 1,194 | 11.1% |
| Tarnisha | Berghild | Layla | 1,543 | 11.0% |
| Tarnisha | Figaro | Savannah | 7,715 | 11.0% |
| Carcano | Eladriel | Miles | 1,662 | 10.9% |
| Tarnisha | Barbara | Savannah | 5,694 | 10.7% |
| Solveig | Berghild | Layla | 1,238 | 10.2% |
| Solveig | Adriana | Odin | 13,493 | 9.7% |
| Seara | Jeogun | Theomars | 1,996 | 9.1% |

## 8. Minimal application architecture

Keep this as a separate project/repository. Do not place game-specific features in FRIDAY backend services or shared libraries just because this handover is stored in their workspace.

Logical separation, not necessarily separate services:

1. **Authorized source adapter:** returns normalized, versioned observations; replaceable by synthetic/member-owned fixtures while permission is unresolved.
2. **Monster catalog and identity mapping:** verified rarity and explicit alias reconciliation.
3. **Roster/settings:** member inventory, exclusions, per-monster build capacity and defence quotas.
4. **Pure optimization core:** snapshot + roster + settings in; validated portfolios out. No network calls or UI state inside the solver.
5. **UI:** roster editor, filter controls, budget comparison and copy/build explanations.

A small web app is sufficient. A browser worker can keep a small optimizer responsive; local roster storage avoids an account backend for the first MVP. Add a backend only if authorized source access, shared storage or guild authentication requires one. Select the stack when implementation begins; do not add microservices, an LLM or rune simulation to the initial scope.

If an authorized server-side connector is needed:

- Cache by approved source scope and share snapshots across members; do not fetch separately for every optimization budget.
- Use permission-agreed refresh intervals, bounded retries, backoff and last-known-good handling within permitted retention.
- Permit only approved source hosts/paths. Do not turn user-entered URLs into an arbitrary server-side fetch proxy.
- Keep any authorized credentials server-side and out of rosters, exports, logs and this repository.
- Enforce guild/member access controls for shared rosters. Do not pool monster inventory across accounts.
- A backend avoids browser CORS limitations technically; it does not grant rights to access or reuse a source.

Do not assume monster artwork may be copied/redistributed with the analytics permission; verify the applicable artwork rights separately. Text-only display is enough for a prototype.

## 9. Validation and acceptance checklist

### Data and roster tests

- [ ] Exact-name/alias cleanup handles FionaFiona, Liu MeiLiu Mei and ROBO-R40ROBO-R40 without damaging legitimate names such as 7R1X or Ramael and Judiah.
- [ ] Cross-list overlap is deduplicated; source battle counts are never summed for repeated observations.
- [ ] Battles count and share are parsed separately from WR.
- [ ] Velaska and Craig are excluded in the historical roster fixture; another member may own them.
- [ ] Natural rarity uses verified catalog metadata, not awakened/current stars, name lists or screenshot appearance.
- [ ] Unknown names/rarities are surfaced and blocked pending resolution.
- [ ] Existing usable copies, reserved copies and permitted new builds are accounted for separately.
- [ ] No acquisition of an unowned monster is silently authorized by a duplicate budget.
- [ ] A changed source structure, access error or stale snapshot produces a visible warning/error.

### Solver tests

- [ ] Return exactly 4 lower-rarity-only and 6 nat-five teams for the historical example.
- [ ] No nat-five monster is used twice under the default restriction, even with budget 5.
- [ ] Eshir used three times from one usable copy consumes two additional copies.
- [ ] Repeating Fiona / Emily / Eshir from one copy each consumes three additional copies.
- [ ] Shared four-star resources are counted across both team categories.
- [ ] A monster's individual copy cap can make an otherwise optimal team unavailable.
- [ ] Reproduce historical optimal WRs: 17.14%, 17.20%, 17.38%, 17.54%, 17.60%, 17.75%.
- [ ] Independently recompute portfolio WR and copy usage; test small synthetic cases against brute-force enumeration.
- [ ] Best score cannot decrease as an up-to budget increases when all other inputs remain fixed.
- [ ] Tie-breaking avoids unnecessary builds and returns deterministic output.
- [ ] Too few feasible teams returns infeasible, not fewer teams disguised as a ten-team result.
- [ ] A timeout does not claim optimality; cancellation leaves the UI responsive.

### Presentation and safety tests

- [ ] Gains use percentage points: 17.14% to 17.75% is +0.61 pp, not +0.61% relative.
- [ ] Show sample sizes, snapshot filters/freshness and historical-performance caveats.
- [ ] Explain that independent budget optima can replace previous build choices.
- [ ] No unauthorized roster sharing, source credential exposure or arbitrary-URL backend fetching.
- [ ] Source access, retention, redistribution and artwork permissions are resolved before live launch.

## 10. Open decisions and next steps

1. **Resolve SWGT permission and supported access first.** Until then, use synthetic or appropriately licensed data, not recurring extraction.
2. Confirm guild preferences: default 4/6 mix, strict nat-five-containing teams versus unrestricted towers, and maximum budgets.
3. Choose manual roster entry first or an approved export/import format. Do not request Summoners War login credentials.
4. Verify all monster IDs/natural rarities, especially renamed or collaboration-family labels.
5. Decide whether budgets mean extra builds beyond usable inventory (recommended) or all duplicates deployed; label the chosen semantics explicitly.
6. Decide whether existing duplicate nat-fives remain prohibited; current requirement caps their usage at one.
7. Establish per-monster capacity: mathematical duplicability does not mean an extra Light/Dark copy can actually be obtained.
8. Implement the pure optimizer with synthetic regression tests before attaching a live source.
9. Build the roster and comparison UI, then add approved source integration and sharing only as required.

Later, optional features: cumulative build plans, build-cost weighting, sample-size-aware ranking, approved roster import, locked favourite teams, alternative near-optimal portfolios and guild-wide placement coordination. These are outside the initial raw-WR optimization.

If exact wins/losses become available, confidence-aware scoring can be offered as a separate objective. Do not treat rounded WR multiplied by battles as an exact win count. Do not imply that better statistical precision models rune quality, matchups or siege adaptation.

### Suggested starting instruction for a future implementation session

Read this handover. Build a standalone guild siege-defence optimizer, preserving the roster, natural-rarity and duplicate constraints in sections 3–6. Start with synthetic test data and the historical regression expectations; do not implement live SWGT extraction unless written permission and an approved access method are supplied. Keep the solver independent of data ingestion and UI. Implement the smallest useful roster editor and budget comparison first; do not introduce an LLM or modify FRIDAY services.
