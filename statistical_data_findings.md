# SWGT Siege Defense Analysis — Statistical Guidance & Handoff

## Objective

Analyze defense-combination data from SWGT to identify defenses worth building for a specific guild/player.

The objective is **not** to find the defenses with the highest raw global win rate. The objective is to estimate which defenses are most likely to perform well **in the user's actual Siege environment**, while using higher-rank data to understand robustness and using aggregate data to discover candidates.

The user is currently in **G1**, guild rank approximately **787**, reported as approximately **top 3.8% of guilds**. Therefore:

* G1 is the primary target population.
* G2 is a particularly relevant secondary population because the user's guild is relatively high within G1.
* G3 is useful as a high-end stress test.
* ALL/aggregate data is useful for candidate discovery and additional statistical power, but should not be treated as the primary estimate of expected G1 performance.

---

## 1. Understand what the SWGT data represents

SWGT's defense-trending data comes from logged Siege battles rather than a complete census of every Summoners War Siege battle.

The 3MDC SWEX plugin automatically uploads Guild War/Siege battle information and defense/counter win/loss data to the public SWGT system. The plugin documentation states that currently G1/G2/G3 battles are stored and that the system records only 3-monster defenses/offenses.

Therefore, interpret SWGT statistics as:

> **Observed empirical performance in the SWGT logged-battle sample**

not as the exact intrinsic probability that a defense wins a random Siege battle.

Potential selection effects exist because participation in the dataset depends on players/guilds using SWEX + the relevant plugin.

Do not over-interpret differences as purely caused by the monster composition.

---

## 2. Rank-specific data and aggregate data are different populations

SWGT displays a defense only when it reaches the site's minimum battle-count threshold for the selected dataset.

The threshold must be read from the site's current note for the dataset being analyzed. Do not assume it is always 1,000.

This creates an important distinction:

### Rank-filtered table

For G1, G2 or G3, the displayed rows represent approximately:

> defenses with at least the threshold number of battles **within that rank**

Therefore the rank-specific table is **censored/truncated**: many defenses that exist and may be good are invisible because they have insufficient battles in that rank.

### Aggregate/ALL table

The aggregate table includes all logged ranks and can therefore contain defenses that do not reach the display threshold in any individual rank.

Consequently:

> **ALL is not simply "the same rows with more battles."**

It can contain additional information that is absent from the rank-specific tables.

Likewise:

> **The visible G1 + visible G2 + visible G3 rows should not be expected to reconstruct the aggregate table.**

Do not infer missing rank values as zero, missing performance, or absence of the defense.

---

## 3. What each dataset should be used for

### G1 — primary decision signal

Use G1 to answer:

> "How does this defense empirically perform against the environment most directly relevant to the user?"

For a player currently in G1, G1 WR is the primary performance statistic.

Do **not** replace it with aggregate WR merely because aggregate has more battles.

### G2 — secondary decision signal

Use G2 to determine how the defense behaves when exposed to a stronger/higher-ranked environment.

Because the user is relatively high within G1, G2 is especially informative as a robustness check.

G2 should generally carry more practical relevance than G3 for this particular user when interpreting rank scaling.

### G3 — high-end stress test

Use G3 to answer:

> "Does this defense remain effective against the strongest/highest-ranked environment represented in the dataset?"

G3 is valuable evidence but should not automatically be treated as the target performance level for a G1 player's defense.

A low G3 WR does **not** automatically make a defense bad for G1.

A high G3 WR does **not** automatically make it better for G1.

G3 player quality, defender rune quality, artifact quality, team-building choices, attacking knowledge, and available counters can all differ from G1.

### ALL / aggregate — candidate discovery and supporting evidence

Use aggregate data to:

* find defenses that have substantial overall sample size;
* discover defenses that may not meet the rank-specific display threshold;
* identify widely tested defenses;
* provide additional contextual evidence.

Do **not** use aggregate WR as the primary ranking statistic for a G1 player.

Aggregate WR is strongly affected by the distribution of logged battles among G1/G2/G3.

---

## 4. Why raw cross-rank WR comparisons are misleading

A defense may show:

* G1 = 20%
* G2 = 14%
* G3 = 9%

This does not mean the defense itself intrinsically becomes 11 percentage points worse.

The observed result combines multiple factors:

> defense composition
> defender rune/artifact quality
> attacker rune/artifact quality
> attacker skill/knowledge
> available counters
> meta/strategy
> rank environment
> other unobserved variables

Therefore, never interpret rank differences as a pure "skill penalty" without qualification.

The useful comparison is primarily:

> **How does each candidate perform relative to other candidates within the same rank?**

---

## 5. Sampling uncertainty matters, but 1,000+ battles is already useful

For a defense with observed win rate `p` and battle count `n`, approximate binomial standard error is:

`SE = sqrt(p * (1-p) / n)`

For final analysis, prefer a Wilson confidence interval or Bayesian interval rather than a simple normal approximation, especially near the extremes.

Approximate intuition around a 20% win rate:

* 1,000 battles: roughly ±2.5 percentage points at 95% confidence
* 2,000 battles: roughly ±1.7–2.0 pp
* 3,000 battles: roughly ±1.4–1.5 pp
* 5,000+ battles: roughly ±1.1 pp or less

These represent only **random sampling uncertainty**.

They do NOT account for systematic bias in the SWGT contributor population or differences between ranks.

Therefore:

> A 1,000-battle defense can be useful evidence, but a 20.0% result and a 21.0% result should not automatically be treated as meaningfully different.

---

## 6. Never rank defenses purely by WR

Battle count must be considered alongside WR.

For example:

* Defense A: 20.5% WR over 8,000 battles
* Defense B: 23.0% WR over 1,050 battles

Do not automatically conclude that B is substantially better.

The second estimate has considerably more uncertainty.

Recommended interpretation:

* ~threshold–2k battles: promising/useful but relatively uncertain
* ~2k–5k: reasonably strong evidence
* 5k+: strong empirical support

These are guidance bands, not hard statistical cutoffs.

---

## 7. Candidate-selection workflow

Use the following workflow.

### Step 1 — Candidate discovery

Search the relevant SWGT aggregate dataset first.

Look for defenses that have:

* meaningful aggregate battle volume;
* reasonably strong aggregate WR;
* relevance to the user's constraints (e.g. 4-star-only defenses);
* viable monster availability/buildability for the user.

Do not assume the highest aggregate WR is the best candidate.

### Step 2 — Inspect the same defenses by rank

For every promising candidate, retrieve:

* G1 battle count + WR
* G2 battle count + WR
* G3 battle count + WR
* aggregate battle count + WR

Do not restrict analysis to defenses visible in all three rank tables.

A defense may have `< threshold` battles in one rank while still having important evidence there; aggregate data can reveal that the defense exists but the rank-specific table simply does not display it.

### Step 3 — Use G1 as the main expected-performance estimate

The primary question is:

> "Is this defense empirically successful in G1?"

Use G1 WR and G1 battle count as the core evidence.

### Step 4 — Check rank robustness

Compare the candidate's G1 result with G2 and G3.

Useful questions:

* Does performance decline sharply after G1?
* Is the G1 result unusually dependent on rank?
* Does the defense remain relatively effective in higher ranks?
* Is its rank gradient unusual compared with other candidates?

Do not require a defense to have strong G3 WR.

The purpose is understanding its **performance profile**, not awarding it a universal quality score.

### Step 5 — Compare candidates within G1

When choosing between candidates for this user, prioritize:

1. G1 observed WR
2. G1 battle count / uncertainty
3. robustness across G2/G3
4. aggregate evidence
5. practical buildability for the user

Do not allow aggregate WR or G3 WR to override a clearly better-supported G1 result without explaining why.

---

## 8. Important distinction: "best in G1" vs "rank-robust"

These are different properties.

Example:

| Defense |  G1 |  G2 |  G3 |
| ------- | --: | --: | --: |
| A       | 21% | 11% | 10% |
| B       | 20% | 14% | 10% |
| C       | 18% | 17% | 16% |

Do not label C automatically "best" because it has the smallest rank decline.

Instead describe the profiles:

* A has very strong observed G1 performance but a large drop in higher ranks.
* B has strong G1 performance with somewhat better intermediate-rank retention.
* C has lower G1 performance but appears more rank-robust.

The user may reasonably prefer A if the objective is maximizing performance in their current G1 environment.

The analysis agent should report these differences rather than converting them into an unsupported universal quality ranking.

---

## 9. Use rank gradients as context, not as an independent quality score

For a defense with sufficient observations in multiple ranks, useful descriptive quantities include:

`G1→G2 delta = WR_G2 - WR_G1`

`G2→G3 delta = WR_G3 - WR_G2`

`G1→G3 delta = WR_G3 - WR_G1`

These should be presented as **descriptive rank effects for that defense**.

Do not interpret them as causal effects.

A large negative G1→G3 difference can be caused by the changing Siege environment, not necessarily by the defense "being bad."

---

## 10. Pooling / shrinkage when appropriate

When enough data are available, do not force a binary choice between:

* "use G1 only"
* "use ALL"

A better statistical approach is **partial pooling / shrinkage**.

Conceptually:

* A defense with very few G1 battles should have its estimated G1 performance pulled somewhat toward broader evidence.
* A defense with thousands of G1 battles should be driven overwhelmingly by its actual G1 observations.

Possible implementations:

### Option A — Bayesian hierarchical/binomial model

Estimate defense performance by rank:

`P(win | defense, rank)`

with partial pooling across ranks and/or defenses.

### Option B — Simpler empirical shrinkage

For a defense with observed G1 WR:

`p_G1_adjusted = weighted combination of observed G1 rate and a prior estimate`

The weight assigned to the observed G1 data increases with G1 battle count.

Use this only when sufficient data are available to justify the model.

For a straightforward user-facing analysis, raw G1 WR + confidence interval + rank comparison is acceptable and easier to explain.

---

## 11. Do not make these analytical mistakes

### Mistake 1

"ALL has more data, therefore ALL is more accurate for the user."

False.

It may have lower sampling error while estimating the wrong target population.

### Mistake 2

"G3 players are better, therefore G3 WR tells us which defense is best."

False.

G3 represents a different defense/attacker/rune/artifact/meta environment.

### Mistake 3

"G1 has fewer battles, therefore G1 is unreliable."

False.

91k total G1 battles is a substantial dataset. The uncertainty depends primarily on **the individual defense's battle count**, not the total G1 dataset alone.

### Mistake 4

"A defense with 23% WR beats one with 20% WR."

Not necessarily.

Check battle counts and confidence intervals.

### Mistake 5

"The aggregate table contains exactly the union of the visible G1/G2/G3 rows."

False because of the rank-specific battle-count display threshold.

### Mistake 6

"A low G3 WR proves that the defense is bad."

False.

It proves that its observed performance is lower in that higher-rank population.

### Mistake 7

"A high G1 WR proves the defense is intrinsically strong."

Too strong.

It shows strong observed performance in the logged G1 sample.

---

## 12. Special interpretation for this user

The user is approximately rank 787 and therefore relatively high within G1.

For this user:

### Primary

G1 data.

### Particularly relevant secondary evidence

G2 data, because it provides information about how the defense behaves in a somewhat stronger environment.

### Secondary/high-end stress test

G3 data.

### Broad discovery

Aggregate data.

Do not assume that "G1 average" perfectly represents rank 787. SWGT does not appear to provide enough granularity in these tables to isolate exactly rank 787's opponent population, so G1 remains the best directly available proxy.

---

## 13. Recommended output for a defense-analysis task

For each candidate defense, report something like:

**Defense:** Monster A / Monster B / Monster C

**G1:** X battles, Y% WR
**G2:** X battles, Y% WR
**G3:** X battles, Y% WR
**ALL:** X battles, Y% WR

Then provide:

* confidence/uncertainty assessment;
* rank-gradient interpretation;
* whether the G1 result is strongly supported by battle volume;
* whether the defense appears G1-specific or relatively rank-robust;
* any obvious limitation caused by missing/sub-threshold rank data.

The final recommendation should be based primarily on the user's G1 environment and practical constraints, rather than raw aggregate WR.

---

## 14. For selecting a small number of defenses

When asked to identify a handful of defenses to build, the agent should not simply output the top N rows by G1 WR.

Instead:

1. Generate a sufficiently broad candidate pool.
2. Remove candidates that fail the user's monster/build constraints.
3. Evaluate G1 WR + sample size.
4. Account for statistical uncertainty.
5. Examine G2/G3 rank robustness.
6. Avoid selecting multiple defenses that are effectively the same strategic archetype if diversity matters.
7. Prefer defenses for which the observed G1 performance is supported by substantial battle volume.
8. Clearly separate:

   * **empirical performance**
   * **statistical confidence**
   * **rank robustness**
   * **practical buildability**

The goal is to identify defenses that are **well-supported choices for the user's actual environment**, not merely defenses occupying the highest positions in one SWGT table.

---

## 15. Interpretation principle

The central principle for this analysis is:

> **Use the data from the population you care about to estimate performance; use larger/different populations to improve context, discover candidates, and test robustness — not to silently substitute a different target population.**

For this user, that means:

> **G1 tells us what is likely to happen to the defenses in the user's environment.**

> **G2 tells us how they begin to behave against stronger environments.**

> **G3 tells us how they perform under a high-end stress test.**

> **ALL tells us what has been extensively observed across the whole dataset and helps us discover candidates that rank-specific filters may hide.**

No single one of these views should be treated as the complete answer.
