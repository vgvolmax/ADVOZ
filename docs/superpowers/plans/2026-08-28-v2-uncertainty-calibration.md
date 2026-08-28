# ADVOZ v2 — uncertainty calibration plan

## Goal

Add uncertainty quantification around the already implemented `TEMPORAL_ADJUSTED` observational transition effect without changing the underlying AchievedCPC/regime architecture.

## Statistical design

1. Keep the existing temporal point estimate: treatment step + linear calendar trend + weekday fixed effects, evaluated over lag 0/+1/+2.
2. Only transitions with `LAG_STABLE` are eligible for uncertainty inference.
3. Select the identified lag whose adjusted effect is closest to the lag-summary representative effect.
4. Estimate uncertainty with **moving-block residual bootstrap** on the fixed temporal design matrix.
   - residual blocks are resampled separately inside baseline and test regimes;
   - this preserves short-range serial dependence without mixing residual blocks across the regime boundary;
   - the full-model residual bootstrap produces a percentile confidence interval;
   - a reduced model without the treatment step is used for a null residual bootstrap and an approximate two-sided bootstrap p-value.
5. If bootstrap validity is too low, return `UNCERTAINTY_NOT_IDENTIFIED`, never a numeric p-value/interval.
6. Campaign-wide eligible transition p-values are adjusted with Benjamini–Hochberg.
7. `q` is a multiplicity safeguard, not a causal proof. All historical evidence remains `OBSERVATIONAL`.

## Decision integration

Strong operational decisions (`DEPLOY` / `ROLLBACK`) require:

- clean CPC transition;
- `LAG_STABLE` temporal estimate;
- identified bootstrap uncertainty;
- confidence interval direction consistent with the point estimate;
- enough power/duration under the existing feasibility layer;
- after campaign-wide adjustment, `q <= fdrAlpha` when multiple eligible hypotheses are present.

If CI crosses zero, bootstrap is not identified, or FDR does not pass, the transition is downgraded to `EXTEND` or `INCONCLUSIVE` rather than being presented as strong evidence.

## TDD contracts

- deterministic seeded bootstrap produces reproducible output;
- positive synthetic step has CI mostly above zero and small null-bootstrap p-value;
- no-effect autocorrelated series does not generate a strong signal;
- too-short designs return `UNCERTAINTY_NOT_IDENTIFIED`;
- BH implementation is monotone and handles missing p-values;
- evaluator blocks strong decisions when uncertainty is weak;
- campaign-wide FDR annotation can downgrade strong per-transition decisions;
- UI exposes CI, p and q while retaining `OBSERVATIONAL` labeling.

## Explicit non-goals of this phase

- randomized-causal interpretation;
- exact coverage/budget reconstruction;
- holiday/external-demand models;
- calibrated 0–100 confidence score;
- full contribution-profit inputs;
- smooth nonlinear `CPC*` optimization.
