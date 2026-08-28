# ADVOZ v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Ozon CPC Optimizer v2 as a self-contained local browser app that reconstructs CPC regimes and observational quasi-experimental transitions from a three-month Ozon XLSX and returns either a feasible next `TargetCPC` plus test card or `NO_FEASIBLE_TEST`.

**Architecture:** Reuse only proven import/UI infrastructure from `vgvolmax/adv`; write the v2 mathematical decision path as isolated modules under `src/`. `src/analyzer.js` is the sole orchestration entry point and `app.js` renders returned results without embedding decision mathematics.

**Tech Stack:** Vanilla JavaScript (browser + CommonJS-compatible Node tests), HTML/CSS, browser `DecompressionStream`, no npm/runtime dependency for end users.

**Spec:** `Ozon_CPC_Optimizer_v2_FINAL_SPEC.md`; architecture: `docs/superpowers/specs/2026-08-27-advoz-v2-architecture-design.md`

## Global Constraints

- Local browser application; no backend, npm runtime or CDN.
- `AchievedCPC` is the primary CPC variable; configured Ozon bid is not required.
- Analyze stable CPC regimes, not day-to-day CPC noise.
- Spend must not be used as a total-effect regression control.
- `Spend ≈ CPC × Clicks` is data validation only.
- Budget is a latent constraint/moderator, not a jointly optimized variable.
- Historical transition evidence must be labelled `OBSERVATIONAL`.
- Ambiguous cases remain uncertain.
- Every `TargetCPC` must include the complete next-test card.
- If useful power is infeasible in a reasonable horizon, return `NO_FEASIBLE_TEST`.

---

### Task 1: Import and normalized daily schema

**Files:**
- Create: `src/xlsx.js`
- Create: `src/normalize.js`
- Create: `tests/normalize.test.js`

**Interfaces:**
- `readOzonWorkbook(arrayBuffer) -> Promise<{campaignId, headers, rows}>`
- `normalizeOzonRows(rawRows, campaignId, sourceOrder) -> DailyRow[]`
- `actualCpc(row) -> number|null`
- `validateAccounting(row, tolerance) -> {ok, relativeError, code}`

- [ ] Write failing Node tests proving valid normalization, `missing Spend + reported CPC` fallback, and accounting mismatch being a data-quality flag only.
- [ ] Run `node tests/normalize.test.js` and confirm failure because `src/normalize.js` is absent.
- [ ] Adapt the old XLSX reader and implement the minimal normalized schema without importing legacy elasticity/recommendation code.
- [ ] Run `node tests/normalize.test.js` and confirm all tests pass.
- [ ] Commit the import foundation.

### Task 2: Stable CPC regime detection

**Files:**
- Create: `src/cpc_regimes.js`
- Create: `tests/cpc-regimes.test.js`

**Interfaces:**
- `detectCpcRegimes(days, options) -> {regimes, noise, changePoints}`
- Each regime exposes `{id,startDate,endDate,days,nDays,cpc,cpcMedian,cpcSd,clicks}`.

- [ ] Write failing tests for one noisy stationary regime, a persistent step, a one-day spike, and insufficient separation from baseline noise.
- [ ] Run test and verify RED.
- [ ] Implement robust segmentation using candidate splits, robust within-segment noise and configurable minimum duration/separation.
- [ ] Run test and verify GREEN.
- [ ] Commit CPC regime detection.

### Task 3: Effective budget-state inference

**Files:**
- Create: `src/budget_regimes.js`
- Create: `tests/budget-regimes.test.js`

**Interfaces:**
- `rolling7d(days) -> RollingBudgetPoint[]`
- `inferEffectiveBudgetStates(days, cpcRegimes, options) -> {states, changePoints, diagnostics}`
- State codes: `BUDGET_CONSTRAINED`, `BUDGET_UNCONSTRAINED`, `BUDGET_CAP_CHANGED`, `BUDGET_STATE_UNCERTAIN`.

- [ ] Write failing tests for a stable observed ceiling, a ceiling shift at stable CPC, unconstrained variable spend, and an ambiguous demand/budget pattern.
- [ ] Verify RED.
- [ ] Implement rolling-7d aggregation and conservative latent-state inference; never output an exact configured budget.
- [ ] Verify GREEN.
- [ ] Commit budget-state inference.

### Task 4: Order and price regimes plus transition classification

**Files:**
- Create: `src/order_model.js`
- Create: `src/price_regimes.js`
- Create: `src/transitions.js`
- Create: `tests/transitions.test.js`

**Interfaces:**
- `buildSafeOrderSeries(days, options) -> DailyRow[]`
- `detectPriceRegimes(days, options) -> PriceRegimeResult`
- `buildTransitions(cpcRegimes, budgetResult, priceResult, options) -> Transition[]`
- Transition codes exactly include `CLEAN_CPC_TRANSITION`, `MIXED_CPC_BUDGET_TRANSITION`, `PRICE_CONFOUNDED_TRANSITION`, `OTHER_CONFOUNDED_TRANSITION`, `TRANSITION_UNCERTAIN`; every transition has `evidenceType:'OBSERVATIONAL'`.

- [ ] Write failing tests for clean, mixed-budget, price-confounded and uncertain transitions.
- [ ] Verify RED.
- [ ] Adapt conservative order reconstruction and implement price/change classification plus observational transition classification.
- [ ] Verify GREEN.
- [ ] Commit transition layer.

### Task 5: Regime metrics, MDE/power and economics

**Files:**
- Create: `src/regime_metrics.js`
- Create: `src/power.js`
- Create: `src/economics.js`
- Create: `tests/power.test.js`

**Interfaces:**
- `aggregateRegimeMetrics(regime, days, economicsSettings) -> RegimeMetrics`
- `estimateTestFeasibility(baselineMetrics, targetEffect, options) -> Feasibility`
- `contributionProfit(row, settings) -> number|null`

- [ ] Write failing tests proving low-volume SKU produces infeasible power, higher-volume data produces a finite required horizon, and missing economics never masquerades as profit optimum.
- [ ] Verify RED.
- [ ] Implement empirical rate/variance based MDE/power approximation with explicit assumptions and feasibility horizon.
- [ ] Verify GREEN.
- [ ] Commit metrics/power/economics.

### Task 6: Response curve and next-test planner

**Files:**
- Create: `src/response_curve.js`
- Create: `src/test_planner.js`
- Create: `tests/test-planner.test.js`

**Interfaces:**
- `buildResponseCurve(regimeEvidence, options) -> ResponseCurve`
- `planNextTest(context, options) -> {status:'RECOMMENDED', targetCpc, card}|{status:'NO_FEASIBLE_TEST', reason}`
- Test card fields: `baselineAchievedCpc`, `targetCpc`, `targetCorridor`, `minSeparation`, `minFullDays`, `requiredPrimaryKpi`, `maxTestDays`, `stabilizationDays`, `stopLoss`, `mixedConditions`, `reloadWhen`, `possibleDecisions`.

- [ ] Write failing tests for a local feasible target, target smaller than CPC noise, extrapolation guard, and `NO_FEASIBLE_TEST` for infeasible power.
- [ ] Verify RED.
- [ ] Implement conservative local recommendation logic and the full required test card.
- [ ] Verify GREEN.
- [ ] Commit planner.

### Task 7: Orchestrator and adversarial system tests

**Files:**
- Create: `src/analyzer.js`
- Create: `tests/analyzer.test.js`
- Create: `tests/adversarial.test.js`

**Interfaces:**
- `analyzeCampaignV2(rows, settings) -> AnalysisResult[]`

- [ ] Write failing integration tests for the complete pipeline and adversarial scenarios where seasonality changes outcomes without a CPC regime change, CPC+budget change is mixed, and accounting mismatch never causes a budget conclusion.
- [ ] Verify RED.
- [ ] Implement analyzer orchestration only; do not duplicate component logic.
- [ ] Verify GREEN and run all tests.
- [ ] Commit analyzer.

### Task 8: Local browser UI

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `app.js`
- Create: `tests/ui-contract.test.js`
- Modify: `README.md`

**Interfaces:**
- UI calls `OzonV2.analyzeCampaignV2(rows, settings)` and renders returned model only.

- [ ] Write a failing UI contract test checking required scripts, upload input, `OBSERVATIONAL` labelling, `NO_FEASIBLE_TEST`, and next-test-card fields.
- [ ] Verify RED.
- [ ] Adapt the old visual shell and ingestion mechanics, remove legacy E/marginal-CPO decision columns, and render regimes, budget state, transition evidence, TargetCPC/test card.
- [ ] Verify GREEN; open-contract checks must pass without external dependencies.
- [ ] Update README with local launch instructions and v2 semantics.
- [ ] Commit UI.

### Task 9: Final calibration and verification

**Files:**
- Modify tests and focused modules only where calibration evidence requires it.

- [ ] Run every test file with Node.
- [ ] Run adversarial simulations across stationary/noisy CPC, real CPC steps, seasonality-only outcome shifts, budget ceiling shifts, price confounding and low power.
- [ ] Inspect the repository for accidental references to legacy `logSpend` total-effect control, legacy RAISE/LOWER decision rules, or causal claims without `OBSERVATIONAL`.
- [ ] Verify `index.html` has no CDN/backend/runtime dependency.
- [ ] Compare implementation against every section of `Ozon_CPC_Optimizer_v2_FINAL_SPEC.md` and record any intentionally deferred item in README; do not silently omit requirements.
- [ ] Commit verification fixes and open a PR from `feat/v2-core` to `main`.
