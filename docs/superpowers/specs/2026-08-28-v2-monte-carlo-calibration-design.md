# ADVOZ v2 Monte-Carlo Calibration — Design Specification

**Status:** design candidate for approval  
**Base:** `main` at `c43f154778f730d0582561bc51d36778795a9493`  
**Purpose:** calibrate the already-implemented observational statistical pipeline against synthetic processes with known truth before treating `CI / p / q` and operational decisions as production-ready.

---

## 1. Why this layer exists

Ordinary unit/integration tests answer whether the implementation follows its formulas and contracts. They do **not** answer whether the statistical system is calibrated when repeatedly exposed to realistic time-series data with known truth.

Monte-Carlo calibration must answer:

> If ADVOZ repeatedly receives data generated under a known truth, how often does it identify the transition, recover the correct direction, cover the true effect with its interval, issue a strong wrong decision, refuse to identify the effect, or recommend the wrong next CPC direction?

This is a **calibration and release-gate subsystem**, not a production inference module.

All historical conclusions in production remain `OBSERVATIONAL`.

---

## 2. Non-negotiable architecture

Calibration is a separate Node-only contour.

```text
Scenario manifest
      ↓
Seeded DGP generator
      ↓
A: estimator runner
B1: pipeline runner
B2: decision-policy evaluator
C: multi-SKU multiplicity runner
      ↓
Metric aggregator + Monte-Carlo intervals
      ↓
JSON report + Markdown summary
```

Dependency direction is one-way:

```text
calibration/ → src/
```

Production code must never import from `calibration/`.

The browser application remains local and unchanged by the simulator. No backend, CDN, npm runtime dependency, auction API, bid ledger or Ozon digital twin is introduced.

---

## 3. Deterministic prerequisites before full Monte-Carlo

Monte-Carlo must not be used as an expensive way to rediscover deterministic defects that can be reproduced with one test.

### P0-1 — Low Order coverage must block unsupported recommendations

`orderReliableCoverage` is currently diagnostic only. Before B2 calibration, a recommendation based on `orders/day` must require sufficient reliable order coverage.

Contract:

- one primary objective is resolved for the SKU/history;
- when the objective is `orders/day`, candidate evidence with insufficient order coverage is not usable for response direction or `TargetCPC`;
- default minimum coverage: `0.70`, configurable;
- insufficient coverage produces `NO_FEASIBLE_TEST` or `INCONCLUSIVE` evidence, not a formal CPC direction.

### P0-2 — TargetCPC must depend on validated evidence

Current response evidence must not use a transition merely because its structural code is `CLEAN_CPC_TRANSITION`.

A transition is allowed to support response direction only after the full evidence gate:

1. `CLEAN_CPC_TRANSITION`;
2. compatible primary KPI units;
3. `LAG_STABLE`;
4. `UNCERTAINTY_IDENTIFIED`;
5. interval supports the effect direction for a strong claim;
6. campaign FDR status is acceptable for inferential use;
7. no data-quality/reliability guard blocks the transition.

`TargetCPC` must be calculated **after** campaign-level FDR, not before it.

If no validated evidence supports a direction, return `NO_FEASIBLE_TEST` rather than constructing a direction from rejected transitions.

### P0-3 — Data gaps must not be clean transitions

A calendar/data discontinuity between adjacent CPC regimes must be detected explicitly.

Contract:

- compute the number of missing calendar days between `from.endDate` and `to.startDate`;
- a gap above the configured tolerance cannot remain `CLEAN_CPC_TRANSITION`;
- use `OTHER_CONFOUNDED_TRANSITION` with a machine-readable `reasonCode: DATA_GAP` rather than adding a new top-level transition enum;
- long-gap transitions cannot feed response direction.

### P0-4 — Primary KPI units must never be mixed

The objective cannot silently switch from `contributionProfit/day` in one regime to `orders/day` in another.

Contract:

- resolve the primary objective once per SKU analysis;
- if profit is selected, a regime with inadequate profit coverage becomes unusable rather than falling back to orders;
- if orders are selected, all compared regimes use orders;
- `PrimaryMetric_A !== PrimaryMetric_B` forces `INCONCLUSIVE` and makes the transition unusable for response direction.

### P0-5 — Historical precision/power must use both regimes

For an already-observed A→B transition, precision/power must account for the variance and sample size on **both** sides.

A baseline-only approximation remains acceptable only in the future-test planner and must be explicitly labelled as a forecast assumption.

### Existing regression sentinel — missing Spend

`missing Spend → CPC=0` is already fixed in current `main`. It is **not** an open P0.

It remains a mandatory sentinel scenario:

- when Spend is missing and reported Ozon CPC is valid, `AchievedCPC` must use the reported CPC fallback;
- missing/partial Spend must not create a synthetic zero-CPC regime.

---

## 4. Calibration levels

## A — Estimator calibration

Purpose: test the statistical estimator with correct regime boundaries already known.

Production components under test:

```text
temporal_adjustment
→ lag 0/+1/+2
→ moving-block bootstrap uncertainty
→ p-value / CI
```

A deliberately bypasses CPC change-point detection and transition classification.

### A truth parameters

At minimum vary:

- true relative effect: `0, ±0.10, ±0.20, ±0.30`;
- true lag: `0, 1, 2`;
- regime lengths;
- low / medium / high primary-KPI volume;
- weekday pattern strength;
- linear trend;
- overdispersion;
- serial correlation / AR(1);
- shock-free and demand-shock conditions.

Primary KPI for this calibration phase is `orders/day`.

Profit calibration is deferred until the full contribution-profit model is approved.

### A output

Measure whether the estimator itself is calibrated when segmentation is known to be correct.

---

## B1 — Pipeline calibration

Purpose: test reconstruction of structure from an approximately 90-day Ozon-like history.

Production path under test:

```text
raw synthetic Ozon-like rows
→ normalize
→ order reconstruction / data quality
→ CPC regime detector
→ effective budget-state inference
→ price regimes
→ transition classification
```

B1 does not require a separate simulator from B2; the same generated runs are scored with different truth labels.

### B1 metrics

- CPC change-point recall;
- false change-point rate;
- absolute change-point date error;
- regime-count error;
- CPC-regime value error;
- transition confusion matrix: `CLEAN / MIXED / UNCERTAIN/OTHER`;
- budget-state/classification diagnostics;
- price-confounding detection;
- data-gap detection;
- order-reliability/coverage guard correctness.

---

## B2 — Decision-policy calibration

Purpose: validate the **final operational output**, not only the estimator.

Production path under test:

```text
B1 pipeline
→ temporal calibration
→ bootstrap uncertainty
→ campaign BH/FDR
→ observational decision
→ response evidence
→ TargetCPC / NO_FEASIBLE_TEST
```

This is mandatory because a well-calibrated estimator does not guarantee a correct response curve or next CPC recommendation.

### B2 metrics

- distribution of `DEPLOY / ROLLBACK / EXTEND / INCONCLUSIVE`;
- strong false-positive rate under true null;
- wrong-sign strong-decision rate;
- unconditional correct-direction rate;
- correct-direction rate conditional on identification;
- `RECOMMENDED` rate under null;
- `RECOMMENDED` rate when the effect is not identified;
- `NO_FEASIBLE_TEST` rate;
- TargetCPC direction correctness;
- recommendation rate after gap / low coverage / mixed transition / FDR fail;
- rate at which rejected evidence still leaks into response direction — target is exactly zero.

---

## C — Multiplicity calibration

Purpose: evaluate campaign-level BH/FDR with multiple SKU.

Generate campaigns containing both null and non-null SKU.

Required dependence structures:

1. independent SKU innovations;
2. correlated SKU through a shared latent demand shock;
3. shared calendar/trend components plus idiosyncratic noise.

For every generated campaign:

```math
FDP = FalseDiscoveries / max(AllDiscoveries, 1)
```

Empirical FDR is:

```math
EmpiricalFDR = mean(FDP_campaign)
```

Do **not** pool all discoveries across campaigns and divide total false by total discoveries.

Also report true discovery rate / power and the fraction of campaigns with zero discoveries.

---

## 5. DGP design

The simulator models observed histories, not the internal Ozon auction.

Do not model nominal Ozon bid or undocumented auction internals.

### Core latent variables

Each synthetic history may contain:

- latent demand level;
- weekday multiplier;
- deterministic linear trend;
- serially correlated latent shock `AR(1)`;
- optional structural demand shock;
- AchievedCPC regime and within-regime CPC noise;
- potential traffic/click volume;
- effective budget constraint state;
- realized price regime;
- orders generated by Poisson or overdispersed count process.

### Observable accounting relationship

When Spend is observed:

```math
Spend = AchievedCPC × Clicks
```

This is generated as an accounting identity only. It does not encode a causal inference rule.

### Count process

The DGP must support:

- Poisson counts;
- overdispersed counts through a negative-binomial-compatible or equivalent Gamma-Poisson mechanism;
- AR(1)/shared latent multipliers for temporal dependence.

### Truth definition

Every generated run carries an explicit immutable `truth` object separate from observed rows.

Truth contains at minimum:

- true CPC regime boundaries and regime levels;
- true change-point dates;
- true primary effect and direction;
- true lag;
- true confounder state: price / budget / demand shock / gap;
- whether the transition is structurally clean;
- whether a recommendation is logically permitted;
- expected next direction where the scenario defines one;
- null/non-null label for multiplicity.

The production pipeline never reads `truth`.

For simple A scenarios the true effect is directly parameterized.

For B scenarios with budget/traffic interactions, truth may be obtained from the structural generator/counterfactual definition using the same latent innovations, rather than assuming a misleading closed-form effect.

---

## 6. Mandatory adversarial scenarios for B

The scenario manifest must include named, fixed sentinel/adversarial cases in addition to the broader parameter grid.

Required scenarios:

1. demand shock exactly on the CPC change-point;
2. pure temporal trend with zero CPC effect;
3. long data gap between regimes;
4. one- or two-day CPC outlier adjacent to a data gap;
5. missing Spend with valid reported CPC;
6. partial Spend coverage;
7. low Order coverage;
8. simultaneous CPC + price regime change;
9. simultaneous CPC + effective budget-state change;
10. short baseline + long target regime;
11. repeated CPC `A → B → A`;
12. structural demand shift with no CPC change;
13. new CPC regime whose separation is smaller than background CPC noise;
14. stable CPC with large demand growth;
15. clean CPC transition with no true primary effect;
16. lag-sensitive effect where lag assumptions disagree.

Sentinel expectations must be encoded as truth contracts, not prose-only assertions.

Examples:

- no CPC change → no CPC treatment transition;
- gap/low coverage/mixed transition → must not produce a strong supported TargetCPC direction from that evidence;
- missing Spend fallback → must not produce CPC=0;
- FDR fail → rejected transition must not leak into response recommendation.

---

## 7. Scenario sampling strategy

Do not use a full Cartesian product over every DGP parameter.

Use three complementary sources:

### 7.1 Compact factorial / pairwise grid

Covers main interactions with a tractable scenario count.

### 7.2 Named adversarial suite

Targets known dangerous edge cases even if they are rare in random sampling.

### 7.3 Seeded random parameter draws

Samples parameters continuously inside approved ranges to reduce overfitting to a small hand-written grid.

The manifest records every chosen parameter and the RNG seed.

---

## 8. Metrics — unconditional and conditional

Metrics must be reported in two views where applicable:

1. **all runs / unconditional**;
2. **identified runs only / conditional on identification**.

This prevents a model that returns `INCONCLUSIVE` almost always from appearing perfectly calibrated on a tiny selected subset.

Mandatory metrics:

- identification rate;
- change-point recall;
- false change-point rate;
- change-point date error;
- transition confusion matrix;
- CI coverage among identified runs;
- mean / median CI width;
- strong false-positive rate under null;
- sign recovery;
- wrong-sign strong-decision rate;
- unconditional correct-detection rate;
- conditional correct-detection rate;
- distribution of all operational decisions;
- `RECOMMENDED` rate under null;
- `RECOMMENDED` rate under non-identification;
- TargetCPC direction accuracy;
- forbidden-recommendation rate under gap / low coverage / mixed / FDR fail;
- empirical FDR;
- true discovery rate.

For every proportion, report a Monte-Carlo confidence interval rather than a naked percentage.

---

## 9. Calibration report format

A full run writes both machine-readable and human-readable outputs.

### Required metadata

- production commit SHA;
- calibration code commit SHA;
- scenario schema version;
- report schema version;
- Node version;
- run profile;
- master seed;
- scenario ID and parameters;
- top-level replication count;
- production bootstrap replication count/settings;
- alpha and FDR alpha;
- timestamp.

### JSON

Default JSON stores:

- metadata;
- scenario definitions;
- truth labels;
- sufficient counts/sums for all reported metrics;
- aggregated metrics;
- Monte-Carlo intervals;
- failure/sentinel counts.

Individual replicate-level records may be emitted as optional NDJSON for debugging but are not required in the committed baseline artifact.

### Markdown summary

Contains compact tables by level/scenario family, including at minimum:

```text
true effect = 0      → strong FP rate X% [MC CI]
true effect = +20%   → sign recovery Y% [MC CI]
nominal 95% CI       → empirical coverage Z% [MC CI]
identified           → identification rate Q% [MC CI]
```

B1 includes change-point and confusion-matrix summaries.

B2 includes final decision and TargetCPC summaries.

C includes empirical FDR and true discovery rate.

---

## 10. Run profiles

### `smoke`

Purpose: CI/software regression only, **not statistical calibration**.

Checks:

- deterministic seed reproducibility;
- JSON/report schema stability;
- truth labels;
- a small set of sentinel scenarios;
- gross statistical regressions;
- calibration code imports production, never the reverse.

The smoke profile must not claim calibrated Type-I error or coverage from a tiny number of runs.

### `baseline`

Purpose: first formal calibration report.

Use production statistical defaults, including the production bootstrap settings.

Initial target:

- approximately 300 top-level replications per A/B scenario family where computationally feasible;
- approximately 200 generated campaigns per C scenario family.

These values are minimum baseline targets, not a claim of arbitrary precision. Monte-Carlo intervals communicate the resulting uncertainty.

### `deep`

Purpose: higher-precision release comparison for controversial/default-changing PRs.

Target:

- approximately 1000 top-level replications per selected A/B scenario;
- approximately 500 generated campaigns per selected C scenario.

A deep run may be scoped to the scenario families affected by a proposed production change.

---

## 11. Release-gate semantics

Monte-Carlo does not automatically tune production parameters.

Forbidden workflow:

```text
calibration says another alpha/blockSize is better
→ production default changes automatically
```

Required workflow:

```text
production defaults
→ calibration report
→ observed failure / trade-off
→ explicit hypothesis
→ separate production PR
→ new calibration report
→ before/after comparison
```

Calibration scenarios must therefore remain separate from production default selection.

### Hard invariant gates

The following are deterministic release blockers regardless of aggregate calibration performance:

- rejected/FDR-failed evidence leaks into TargetCPC direction;
- low-coverage/gap/mixed evidence alone produces a strong supported recommendation;
- primary KPI units are mixed across a compared transition;
- missing Spend fallback creates CPC=0;
- production imports simulator/calibration code;
- seed reproducibility or report schema contracts fail.

### Statistical calibration targets

The first baseline report is diagnostic and establishes the empirical baseline.

Before declaring the statistical layer production-ready, the project must define and satisfy explicit numerical gates for at least:

- null strong false-positive rate;
- nominal CI coverage;
- wrong-sign strong-decision rate;
- sign recovery / detection under a practically relevant non-null effect;
- empirical FDR under independent and shared-shock campaign structures.

Numerical gate values must be approved from the baseline evidence and recorded in a separate release-calibration decision, rather than silently chosen to make the first simulator pass.

---

## 12. Versioning and comparison

Every committed calibration baseline is tied to:

- production commit;
- calibration schema version;
- scenario schema version;
- seed/profile.

A production-default PR that changes inference or decision thresholds must provide a before/after calibration comparison on the same scenario schema and seeds whenever possible.

Historical reports are immutable evidence; do not overwrite an earlier baseline report with a new result.

---

## 13. Proposed repository layout

```text
calibration/
  README.md
  cli.js
  rng.js
  dgp/
    counts.js
    time_series.js
    ozon_history.js
    truth.js
  scenarios/
    manifest.js
    factorial.js
    adversarial.js
    random.js
  runners/
    estimator.js
    pipeline.js
    campaign.js
  metrics/
    estimator_metrics.js
    pipeline_metrics.js
    decision_metrics.js
    fdr_metrics.js
    monte_carlo_ci.js
  report/
    schema.js
    json_report.js
    markdown_report.js
  output/
    .gitkeep

tests/
  calibration-rng.test.js
  calibration-truth.test.js
  calibration-sentinels.test.js
  calibration-report-schema.test.js
```

Full baseline/deep output artifacts may be stored under a versioned report directory or attached to a release/PR; the implementation plan will define the exact retention policy without making the browser runtime depend on them.

---

## 14. Implementation sequence

No Monte-Carlo implementation starts until this design is approved.

After approval, the implementation plan must execute in this order:

1. deterministic P0 tests and fixes;
2. seeded RNG, truth schema, scenario/report schema;
3. Level A estimator calibration;
4. B1 pipeline scoring;
5. B2 decision/TargetCPC scoring;
6. C multiplicity with independent SKU;
7. C multiplicity with shared demand shocks;
8. smoke CI integration;
9. first full baseline calibration report;
10. separate review of production defaults based on that report.

The baseline calibration PR does **not** automatically alter alpha, block size, lag thresholds, FDR alpha, CPC-step defaults or other production settings.

---

## 15. Completion criteria for the Monte-Carlo subsystem

This subsystem is complete when:

- all five open deterministic P0 are fixed and regression-tested;
- missing-Spend fallback remains protected by a sentinel test;
- A/B1/B2/C can be run from Node with fixed seeds;
- the same seed reproduces identical scenario/truth output;
- the production pipeline cannot access truth labels;
- unconditional and identified-only metrics are both reported;
- B2 explicitly evaluates TargetCPC leakage/direction, not merely transition estimation;
- C reports campaign-level empirical FDR as mean FDP;
- correlated shared-demand-shock campaigns are included;
- smoke CI is explicitly non-calibrational;
- a full baseline JSON + Markdown report is generated with reproducibility metadata;
- no production defaults are auto-tuned by calibration.

Only after reviewing that baseline report should the team decide whether inference thresholds or decision rules need a separate production change.
