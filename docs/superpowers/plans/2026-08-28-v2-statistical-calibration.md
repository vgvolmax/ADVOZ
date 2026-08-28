# ADVOZ v2 Statistical Calibration Plan

**Goal:** Extend the merged v2 core with temporal/statistical calibration while preserving the approved regime-based `AchievedCPC` architecture and `OBSERVATIONAL` semantics.

**Base:** `main` at `d0f395669cf37bf42d94c874046a512c864cd9e0`.

## Non-negotiable constraints

- Do not reintroduce `Spend` as a total-effect regression control.
- Do not reintroduce day-to-day CPC elasticity as the decision unit.
- Historical transition conclusions remain `OBSERVATIONAL`.
- Ambiguous lag/trend/weekday results must reduce evidence or become `INCONCLUSIVE`.
- No external runtime dependencies; browser-only application remains intact.

## Phase 1 — Lag + weekday/trend adjustment

### New module

`src/temporal_adjustment.js`

Public API:

```js
evaluateTemporalTransition(transition, fromRegime, toRegime, fromMetrics, toMetrics, options)
```

For clean CPC transitions it must:

1. evaluate `lag = 0, 1, 2` by default;
2. build daily primary-KPI observations from both regimes;
3. exclude the first `lag` days of the new regime for that lag scenario;
4. fit a local observational adjustment using:
   - treatment/regime indicator;
   - linear calendar trend;
   - weekday fixed effects;
5. report an adjusted effect for every identifiable lag;
6. summarize lag stability:
   - `LAG_STABLE` when direction is consistent and dispersion is acceptable;
   - `LAG_SENSITIVE` when sign/direction materially changes;
   - `LAG_NOT_IDENTIFIED` when data are insufficient/rank-deficient.

The module does **not** claim causal identification.

### Integration

`src/transition_evaluator.js` consumes temporal results:

- `DEPLOY`/`ROLLBACK` require a stable temporal result when temporal calibration is available;
- `LAG_SENSITIVE` forces `INCONCLUSIVE`;
- `LAG_NOT_IDENTIFIED` prevents stronger claims and records the reason;
- response/effect displayed by the evaluator should prefer adjusted effect when valid, otherwise retain explicitly unadjusted observational effect.

### Tests

Create `tests/temporal-adjustment.test.js` covering:

- weekday composition bias removed by weekday adjustment;
- deterministic linear trend is not mistaken entirely for treatment lift;
- lagged effect is detected more strongly at the matching lag;
- sign conflict across lags returns `LAG_SENSITIVE`;
- too-short/rank-deficient regimes return `LAG_NOT_IDENTIFIED` rather than a number.

Update integration/adversarial tests so:

- seasonality-only outcome changes without CPC change still create no transition;
- a clean CPC transition with unstable lag evidence becomes `INCONCLUSIVE`;
- `OBSERVATIONAL` basis is preserved.

## Phase 2 — Multiple testing / FDR

Add inferential uncertainty only after Phase 1 has a tested per-transition statistic/SE. Then implement BH/FDR across comparable SKU transition tests. `q` values remain signal-strength controls, never causality claims.

## Phase 3 — Time-aware uncertainty

Add block bootstrap/regime resampling and Monte-Carlo calibration for:

- false-positive rate;
- sign recovery;
- interval coverage;
- trend/weekday/demand-shock robustness.

## Phase 4 — Confidence score

Only after Phases 1–3, create a calibrated evidence-quality score. It must be explicitly documented as **not** a probability that the recommendation is true.

## Phase 5 — richer economics / response curve

After temporal calibration is stable:

- extend contribution-profit inputs;
- add smooth nonlinear local response fitting;
- expose `CPC*` only within supported/interpolated range;
- add budget-regime heterogeneity only when evidence supports it.

## Verification for this branch

Before PR:

- all existing v2 tests pass;
- all new temporal tests pass;
- `node --check` passes for all JS;
- legacy guard still rejects `logSpend`, `fitDifferencedElasticity`, `marginalCpo`;
- UI remains local/no CDN/backend;
- README records any still-deferred calibration layers.
