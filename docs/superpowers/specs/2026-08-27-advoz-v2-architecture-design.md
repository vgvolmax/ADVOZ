# ADVOZ v2 Architecture Design

## Purpose

Build Ozon CPC Optimizer v2 as a new, self-contained local browser application in `vgvolmax/ADVOZ`, using the approved `Ozon_CPC_Optimizer_v2_FINAL_SPEC.md` as the mathematical source of truth.

The new repository reuses only proven infrastructure from `vgvolmax/adv`; it must not inherit the old decision path based on day-to-day elasticity, Spend-adjusted PPML, adjacent-day marginal CPO, or legacy RAISE/LOWER rules.

## Runtime constraints

- Local browser application.
- No backend.
- No npm/runtime dependency required for end users.
- No CDN dependency.
- User opens `index.html`, loads Ozon XLSX, receives analysis.
- Package analysis is stateless between runs.

## Reuse policy

### Reuse/adapt from `vgvolmax/adv`

- XLSX ZIP/XML reader.
- Multi-file ingestion and date/SKU deduplication mechanics.
- Incomplete-current-day exclusion.
- Ozon field normalization utilities where compatible.
- Reliable order reconstruction utilities where compatible.
- Price-history logic where compatible with v2 price-regime semantics.
- HTML/CSS visual shell and generic table/detail UI patterns.
- Test fixtures and utilities that test infrastructure rather than the old decision model.

### Do not reuse in the v2 decision path

- `decision_model.js` PPML decision logic.
- `logSpend` as a total-effect regression control.
- Daily adjacent-pair elasticity as the primary decision unit.
- Adjacent-day marginal CPO/mROAS as causal economics.
- Legacy RAISE/LOWER recommendation rules.
- Fixed event-volume thresholds presented as statistical power.

## Component boundaries

`src/xlsx.js`
: Browser XLSX reader. Reads raw Ozon workbook rows only.

`src/normalize.js`
: Converts raw Ozon rows into a stable daily schema per campaign/SKU/date. Owns `AchievedCPC` fallback rules and data-quality flags.

`src/order_model.js`
: Reconstructs total ordered units conservatively from promoted-sale price and total ordered revenue when possible. Exposes reliability metadata.

`src/price_regimes.js`
: Builds realized-price series and classifies price stability/change points. Never treats positive observed price association as causal demand elasticity.

`src/cpc_regimes.js`
: Detects stable AchievedCPC regimes and change points using within-regime noise, minimum duration, and minimum separation.

`src/budget_regimes.js`
: Computes rolling 7-day Spend and infers only effective budget state: `BUDGET_CONSTRAINED`, `BUDGET_UNCONSTRAINED`, `BUDGET_CAP_CHANGED`, `BUDGET_STATE_UNCERTAIN`. Never claims the exact configured budget.

`src/transitions.js`
: Builds quasi-experimental historical transitions between adjacent CPC regimes and classifies them as clean, mixed, price-confounded, other-confounded, or uncertain. All inferential evidence is labelled `OBSERVATIONAL`.

`src/regime_metrics.js`
: Aggregates clicks, carts, orders, revenue, spend and eventual contribution profit per regime, including weekday composition and variability.

`src/power.js`
: Estimates MDE/power and next-test feasibility from the primary KPI, observed variance, regime duration and event rate. Produces `NO_FEASIBLE_TEST` when a useful test cannot be completed in a reasonable horizon.

`src/economics.js`
: Computes contribution-profit-after-ads when economic inputs are available. Falls back to an explicitly named interim KPI without calling it profit optimum.

`src/response_curve.js`
: Builds a local CPC response from sufficiently clean observational regime evidence. Supports nonlinear local interpolation only inside or near the observed range.

`src/test_planner.js`
: Produces the required next-test card: baseline AchievedCPC, TargetCPC, achievement corridor, minimum CPC separation, minimum full days, required primary-KPI volume, maximum test duration, stabilization period, stop-loss, mixed-test conditions, reload instruction, and possible next decisions.

`src/analyzer.js`
: Orchestrates the pipeline and exposes the single public analysis entry point `analyzeCampaignV2(rows, settings)`.

`app.js`
: UI state, file ingestion, rendering, filtering and detail panels only. It must not contain decision mathematics.

## Data flow

```text
Ozon XLSX
  -> xlsx.js
  -> normalize.js
  -> order_model.js / price_regimes.js
  -> cpc_regimes.js
  -> budget_regimes.js
  -> transitions.js
  -> regime_metrics.js
  -> power.js / economics.js
  -> response_curve.js
  -> test_planner.js
  -> analyzer.js
  -> app.js UI
```

## Critical semantics

1. `AchievedCPC` is the main observed treatment proxy; configured Ozon bid is not required.
2. Stable CPC regimes, not daily fluctuations, are the decision unit.
3. Spend is not a right-hand-side total-effect control. `Spend ≈ CPC × Clicks` is data validation only.
4. Budget is not jointly optimized with CPC. Only latent effective budget state is inferred.
5. Historical transitions are `OBSERVATIONAL` quasi-experimental evidence, not causal proof.
6. Ambiguity produces explicit uncertainty rather than a guessed classification.
7. No valid recommendation is emitted when the next test is statistically infeasible: `NO_FEASIBLE_TEST`.
8. The app remains batch-only and reconstructs the latest stable regime from each newly loaded report.

## Testing strategy

Use plain Node tests with CommonJS-compatible module wrappers so the same modules run in browser and tests. Every production behavior is introduced test-first.

Core adversarial fixtures must include:

- stationary CPC with normal daily noise -> one regime;
- real CPC step -> two regimes;
- one-day CPC spike -> no new regime;
- CPC change with stable effective budget state -> clean transition candidate;
- apparent 7d Spend ceiling shift at stable CPC -> budget-cap-change candidate;
- ambiguous demand/budget pattern -> `BUDGET_STATE_UNCERTAIN`;
- simultaneous CPC and budget-state change -> mixed transition;
- simultaneous CPC and price-regime change -> price-confounded transition;
- low-volume SKU -> `NO_FEASIBLE_TEST`;
- recommendation smaller than baseline CPC noise -> no test recommendation;
- accounting mismatch between Spend/CPC/Clicks -> data-quality warning only, never a budget conclusion.

## Migration sequence

1. Establish self-contained import/normalization foundation from the old app.
2. Add CPC-regime detection.
3. Add rolling-7d effective budget-state inference.
4. Add price-regime and transition classification.
5. Add regime metrics, power and economics.
6. Add response curve and next-test planner.
7. Build v2 UI over the new analyzer API.
8. Add adversarial/calibration tests and remove any accidental legacy decision dependencies.

## Definition of done

- `ADVOZ` runs locally by opening `index.html`.
- It reads the same Ozon reports the previous app could read.
- No legacy decision module is required at runtime.
- Regimes, inferred budget states and transitions are visible in diagnostics.
- Recommendations are labelled `OBSERVATIONAL`.
- Every `TargetCPC` has the full next-test card.
- Statistically infeasible next steps return `NO_FEASIBLE_TEST`.
- All Node test suites pass, including adversarial scenarios.
