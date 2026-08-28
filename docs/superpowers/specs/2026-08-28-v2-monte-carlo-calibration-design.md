# ADVOZ v2 Monte-Carlo Calibration — Design Specification

**Status:** design candidate for user approval  
**Base:** `main` at `c43f154778f730d0582561bc51d36778795a9493`  
**Purpose:** calibrate the implemented observational statistical pipeline against synthetic processes with known truth before treating `CI / p / q` and operational decisions as production-ready.

---

## 1. Purpose

Unit/integration tests verify formulas and deterministic contracts. They do not answer whether the statistical system is calibrated when repeatedly exposed to realistic time-series data with known truth.

Monte-Carlo calibration must answer:

> If ADVOZ repeatedly receives data generated under a known truth, how often does it identify the transition, recover the correct direction, cover the true effect, issue a strong wrong decision, refuse identification, or recommend the wrong next CPC direction?

This is a **calibration and release-gate subsystem**, not a production inference module. Historical production conclusions remain `OBSERVATIONAL`.

---

## 2. Non-negotiable architecture

Calibration is a separate Node-only contour:

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

Monte-Carlo must not be used as an expensive way to rediscover deterministic defects.

### P0-1 — Low Order coverage blocks unsupported recommendations

Before B2 calibration, a recommendation based on `orders/day` must require sufficient reliable Order coverage.

Contract:

- resolve one primary objective for the SKU/history before regime comparison;
- when the objective is `orders/day`, evidence from a regime below `minOrderCoverage` is unusable for response direction;
- default `minOrderCoverage = 0.70`, configurable;
- insufficient coverage yields unusable evidence and ultimately `NO_FEASIBLE_TEST` if no valid direction remains;
- it must never silently fall through into a formal TargetCPC direction.

### P0-2 — TargetCPC depends only on validated evidence

A transition may support response direction only after the complete evidence gate:

1. `CLEAN_CPC_TRANSITION`;
2. compatible primary KPI units;
3. reliability/data-quality guards pass;
4. `LAG_STABLE`;
5. `UNCERTAINTY_IDENTIFIED`;
6. uncertainty direction is usable;
7. campaign-level `FDR_PASS`.

`FDR_NOT_PASS` and `FDR_NOT_APPLICABLE` do **not** support an inferential response direction.

Campaign-level BH/FDR must be applied **before** response evidence and `TargetCPC` are constructed.

If no validated transition supports a direction, return `NO_FEASIBLE_TEST` rather than constructing a direction from rejected evidence.

### P0-3 — Data gaps cannot remain clean transitions

Contract:

- compute missing calendar days between `from.endDate` and `to.startDate`;
- default tolerated missing days = `0`, configurable;
- a gap above tolerance becomes `OTHER_CONFOUNDED_TRANSITION` with `reasonCode: DATA_GAP`;
- gap-confounded evidence cannot feed response direction.

### P0-4 — Primary KPI units are locked per SKU

The objective cannot switch per regime.

Objective resolution contract:

- if usable contribution-profit inputs exist and whole-history profit coverage meets configured requirements, lock the SKU objective to `contributionProfit/day`;
- otherwise lock to `orders/day`;
- once locked, individual regimes never fall back to another unit;
- a regime lacking adequate coverage for the locked objective becomes unusable;
- `PrimaryMetric_A !== PrimaryMetric_B` forces `INCONCLUSIVE` and cannot feed response direction.

### P0-5 — Historical precision uses both regimes

For an already-observed A→B transition, evidence sufficiency must use both sides.

Introduce a separate historical two-regime precision/power contract based on both `(variance_A, n_A)` and `(variance_B, n_B)`, e.g. through the two-sample variance term:

```math
SE^2 = Var_A/n_A + Var_B/n_B
```

The exact implementation may use the bootstrap as the primary interval and a two-regime MDE/power summary as a diagnostic, but it must not call a baseline-only forecast a measured historical power result.

The current baseline-only approximation remains allowed only in the **future-test planner**, explicitly labelled as a forecast assumption.

### Existing regression sentinel — missing Spend

`missing Spend → CPC=0` is already fixed in current `main` and is not an open P0.

It remains a mandatory sentinel:

- missing Spend + valid reported Ozon CPC → use reported CPC fallback;
- missing/partial Spend must not create a synthetic zero-CPC regime.

---

## 4. Calibration levels

## A — Estimator calibration

Purpose: test the estimator with correct regime boundaries already known.

Production path:

```text
temporal_adjustment
→ lag 0/+1/+2
→ moving-block bootstrap uncertainty
→ p-value / CI
```

A bypasses CPC detector and structural transition classification.

Minimum DGP variation:

- true effect: `0, ±0.10, ±0.20, ±0.30`;
- true lag: `0, 1, 2`;
- regime lengths;
- low / medium / high Orders volume;
- weekday pattern strength;
- linear trend;
- overdispersion;
- AR(1) serial correlation;
- shock-free and demand-shock conditions.

Primary KPI for this phase is `orders/day`. Profit is calibrated separately after the full economics model is approved.

### A identification definition

An A-run is `identified` only when:

- temporal result is `LAG_STABLE`;
- uncertainty result is `UNCERTAINTY_IDENTIFIED`;
- a finite effect and CI are available.

CI coverage and conditional sign recovery use exactly this denominator.

---

## B1 — Pipeline calibration

Purpose: test reconstruction of structure from an approximately 90-day Ozon-like history.

Production path:

```text
raw synthetic Ozon-like rows
→ normalize
→ order reconstruction / data quality
→ CPC regime detector
→ effective budget-state inference
→ price regimes
→ transition classification
```

The same generated histories are later scored again in B2.

### Change-point matching contract

Detected and true change-points are matched one-to-one by minimum absolute date distance within a configurable tolerance.

Default tolerance: `±2 calendar days`.

Report both:

- exact date error in days for matched points;
- recall/precision under the configured tolerance.

Unmatched detected points are false change-points; unmatched true points are misses.

### B1 identification definition

A true transition is pipeline-identified when a detected transition is matched to its true change-point within tolerance and has a structural classification output.

### B1 metrics

- change-point recall and precision;
- false change-point rate;
- date error;
- regime-count error;
- CPC-regime value error;
- transition confusion matrix: `CLEAN / MIXED / UNCERTAIN/OTHER`;
- budget-state diagnostics;
- price-confounding detection;
- data-gap detection;
- order-reliability/coverage guard correctness.

---

## B2 — Decision-policy calibration

Purpose: validate the **final operational output**, not only the estimator.

Production path:

```text
B1 pipeline
→ temporal calibration
→ bootstrap uncertainty
→ campaign BH/FDR
→ observational decision
→ validated response evidence
→ TargetCPC / NO_FEASIBLE_TEST
```

### B2 identification definition

A transition is decision-identified when it passes structural/reliability gates and reaches an identified temporal + uncertainty result with a campaign q-value/FDR status.

`DEPLOY/ROLLBACK` are **strong decisions**. `EXTEND/INCONCLUSIVE` are not discoveries.

### B2 metrics

- distribution of `DEPLOY / ROLLBACK / EXTEND / INCONCLUSIVE`;
- strong false-positive rate under true null;
- wrong-sign strong-decision rate;
- unconditional correct-direction rate;
- conditional correct-direction rate among decision-identified runs;
- `RECOMMENDED` rate under null;
- `RECOMMENDED` rate when the effect is not identified;
- `NO_FEASIBLE_TEST` rate;
- TargetCPC direction accuracy;
- recommendation rate after gap / low coverage / mixed transition / FDR fail;
- rejected-evidence leakage into response direction — hard target `0`.

---

## C — Multiplicity calibration

Purpose: evaluate BH/FDR on multi-SKU campaigns.

Required dependence structures:

1. independent SKU innovations;
2. shared latent demand shock across SKU;
3. shared calendar/trend components plus idiosyncratic noise.

### Discovery definitions

A `discovery` is a **final post-FDR strong decision**: `DEPLOY` or `ROLLBACK`.

A `false discovery` is a discovery on a true-null transition.

A `true discovery` is a discovery on a non-null transition with the correct sign.

A wrong-sign discovery on a non-null transition is reported separately and is not counted as a true discovery.

For each campaign:

```math
FDP = FalseDiscoveries / max(AllDiscoveries, 1)
```

Empirical FDR:

```math
EmpiricalFDR = mean(FDP_campaign)
```

Do not pool all discoveries across campaigns into one denominator.

Also report true discovery rate, wrong-sign discovery rate and the fraction of campaigns with zero discoveries.

---

## 5. DGP design

The simulator models observed histories, not undocumented Ozon auction internals.

Do not model nominal bid.

Core latent/observed components:

- latent demand;
- weekday multiplier;
- linear trend;
- AR(1) latent shock;
- optional structural demand shock;
- AchievedCPC regimes + within-regime noise;
- potential traffic/clicks;
- effective budget constraint state;
- price regime;
- Orders count process.

When Spend is present:

```math
Spend = AchievedCPC × Clicks
```

This is an accounting identity only, never a causal diagnostic.

Counts must support:

- Poisson;
- overdispersed Gamma-Poisson/negative-binomial-compatible process;
- AR(1)/shared latent multipliers.

### Truth object

Every run carries an immutable `truth` object separate from observations.

Truth contains at minimum:

- true CPC regime boundaries/levels;
- true change-point dates;
- true primary effect and sign;
- true lag;
- true confounder state: price / budget / demand shock / gap;
- whether the transition is structurally clean;
- whether a recommendation is logically permitted;
- expected next direction where defined;
- null/non-null label.

Production modules never receive `truth`.

For A, the effect is directly parameterized.

For B scenarios with traffic/budget interactions, truth may be derived from the structural generator/counterfactual using the same latent innovations rather than forcing a misleading closed-form effect.

---

## 6. Mandatory adversarial B scenarios

The fixed manifest includes:

1. demand shock exactly on CPC change-point;
2. pure temporal trend with zero CPC effect;
3. long data gap;
4. 1–2 day CPC outlier adjacent to a gap;
5. missing Spend + valid reported CPC;
6. partial Spend coverage;
7. low Order coverage;
8. simultaneous CPC + price change;
9. simultaneous CPC + effective budget change;
10. short baseline + long target regime;
11. repeated `A → B → A`;
12. structural demand shift without CPC change;
13. CPC separation below background CPC noise;
14. stable CPC + large demand growth;
15. clean CPC transition with true null effect;
16. lag-sensitive effect with conflicting lag evidence.

Sentinel expectations are machine-readable truth contracts.

Examples:

- no CPC change → no CPC treatment transition;
- gap / low coverage / mixed evidence alone → no supported TargetCPC direction;
- missing Spend fallback → never CPC=0;
- FDR fail → no leakage into recommendation.

---

## 7. Scenario sampling

Avoid a full Cartesian grid.

Use:

1. compact factorial/pairwise coverage;
2. fixed adversarial scenarios;
3. seeded random parameter draws within approved ranges.

Every sampled scenario stores its parameters and seed.

---

## 8. Metrics: unconditional and identified-only

Where meaningful, report both:

- all runs / unconditional;
- identified runs only / conditional.

Mandatory metrics:

- identification rate;
- change-point recall/precision/date error;
- transition confusion matrix;
- CI coverage among identified;
- mean/median CI width;
- strong false-positive rate;
- sign recovery;
- wrong-sign strong-decision rate;
- unconditional/conditional correct detection;
- full decision distribution;
- `RECOMMENDED` under null;
- `RECOMMENDED` under non-identification;
- TargetCPC direction accuracy;
- forbidden recommendation rate under gap / low coverage / mixed / FDR fail;
- empirical FDR;
- true discovery rate.

Every reported proportion includes a Monte-Carlo confidence interval.

---

## 9. Report format

A full run writes JSON + Markdown.

Required metadata:

- production commit SHA;
- calibration commit SHA;
- scenario schema version;
- report schema version;
- Node version;
- profile;
- master seed;
- scenario parameters;
- top-level replication count;
- production bootstrap settings;
- alpha/FDR alpha;
- timestamp.

JSON stores metadata, scenarios, truth labels, sufficient aggregate counts/sums, metrics, Monte-Carlo intervals and sentinel failures.

Optional replicate-level NDJSON may be emitted for debugging; it is not required in the committed baseline artifact.

Markdown contains compact A/B1/B2/C tables, including examples such as:

```text
true effect = 0      → strong FP rate X% [MC CI]
true effect = +20%   → sign recovery Y% [MC CI]
nominal 95% CI       → empirical coverage Z% [MC CI]
identified           → identification rate Q% [MC CI]
```

---

## 10. Run profiles

### `smoke`

CI/software regression only, **not statistical calibration**.

Checks seed reproducibility, schema stability, truth labels, sentinel scenarios, gross regressions and dependency direction.

It must never claim calibrated Type-I error or coverage from a tiny sample.

### `baseline`

First formal calibration report using production statistical defaults.

Minimum initial targets:

- ~300 top-level replications per A/B scenario family where computationally feasible;
- ~200 generated campaigns per C family.

Monte-Carlo intervals communicate the precision actually achieved.

### `deep`

Higher-precision comparison for default-changing/statistically controversial PRs:

- ~1000 selected A/B replications;
- ~500 selected C campaigns.

Deep runs may be scoped to affected scenario families.

---

## 11. Release-gate semantics

Calibration never auto-tunes production.

Forbidden:

```text
simulator prefers another alpha/blockSize
→ production default changes automatically
```

Required:

```text
production defaults
→ calibration report
→ explicit failure/trade-off
→ separate hypothesis + production PR
→ new report on same scenarios/seeds
→ before/after comparison
```

### Hard invariant release blockers

- rejected/FDR-failed evidence leaks into TargetCPC;
- low-coverage/gap/mixed evidence alone creates a supported recommendation;
- primary KPI units are mixed;
- missing Spend creates CPC=0;
- production imports calibration code;
- seed reproducibility/report schema contracts fail.

### Statistical calibration targets

The first baseline is diagnostic and establishes empirical behavior.

Before claiming production-ready statistical calibration, explicit numerical gates must be approved for at least:

- null strong false-positive rate;
- nominal CI coverage;
- wrong-sign strong-decision rate;
- detection/sign recovery at a practically relevant non-null effect;
- empirical FDR under independent and shared-shock SKU dependence.

Those numerical gates are approved **after** reviewing the first baseline evidence; they are not silently selected to make the simulator pass.

---

## 12. Versioning and comparison

Every committed baseline is tied to production commit, calibration schema, scenario schema, seed and profile.

A production change to statistical/decision defaults must provide a before/after calibration comparison on the same scenario schema/seeds whenever possible.

Historical reports are immutable; do not overwrite previous baselines.

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

---

## 14. Implementation sequence

No implementation starts until this design is approved.

After approval:

1. deterministic P0 tests + fixes;
2. seeded RNG, truth schema, scenario/report schema;
3. A estimator calibration;
4. B1 pipeline scoring;
5. B2 decision/TargetCPC scoring;
6. C independent-SKU multiplicity;
7. C shared-demand-shock multiplicity;
8. smoke CI;
9. first baseline calibration report;
10. separate production-default review.

The calibration PR does not automatically alter alpha, block size, lag thresholds, FDR alpha, CPC-step defaults or other production settings.

---

## 15. Completion criteria

The Monte-Carlo subsystem is complete when:

- all five open deterministic P0 are fixed and regression-tested;
- missing-Spend fallback remains a sentinel;
- A/B1/B2/C run from Node with fixed seeds;
- identical seeds reproduce identical scenario/truth output;
- production cannot access truth labels;
- unconditional and identified-only metrics are both reported;
- B2 evaluates final TargetCPC direction/leakage;
- C computes empirical FDR as mean campaign FDP;
- correlated shared-demand-shock campaigns are included;
- smoke CI is explicitly non-calibrational;
- a baseline JSON + Markdown report exists with reproducibility metadata;
- calibration performs no automatic production tuning.

Only after reviewing that baseline report should production inference/decision defaults be reconsidered.
