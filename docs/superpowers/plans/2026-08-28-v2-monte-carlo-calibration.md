# ADVOZ v2 Monte-Carlo Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the five deterministic P0 defects, then build a separate Node-only Monte-Carlo calibration contour that scores estimator, pipeline, decision-policy, and campaign FDR behavior against synthetic histories with immutable known truth.

**Architecture:** Production remains browser-only under `src/`; calibration lives under `calibration/` and may import production modules, never the reverse. The same seeded DGP feeds A/B1/B2/C runners; truth is carried beside observations but is never passed into production functions. Reports are deterministic JSON + Markdown artifacts with Monte-Carlo intervals and release-gate failures.

**Tech Stack:** JavaScript CommonJS/UMD, Node 22 for calibration/CI, existing dependency-free browser runtime, GitHub Actions, no npm runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-28-v2-monte-carlo-calibration-design.md`

## Global Constraints

- Historical production conclusions remain `OBSERVATIONAL`.
- `Spend` must not be reintroduced as a total-effect regression control.
- Production code must never import `calibration/`.
- Browser application remains local: no backend, CDN, npm runtime dependency, bid ledger, or Ozon digital twin.
- Monte-Carlo never auto-tunes production defaults.
- `missing Spend + valid reported CPC` must never create `CPC=0`.
- Primary KPI is locked once per SKU analysis; units may not switch by regime.
- Campaign FDR must be applied before response evidence and `TargetCPC` are built.
- Full baseline/deep calibration is not a CI claim; CI uses only seeded smoke sentinels.

---

## File Structure

### Production files modified during deterministic prerequisite phase

- `src/regime_metrics.js` — aggregate one explicitly selected primary objective and expose coverage/usability.
- `src/transitions.js` — detect calendar gaps and emit machine-readable `reasonCode`.
- `src/power.js` — add historical two-regime precision diagnostic; retain baseline-only future-test forecast.
- `src/transition_evaluator.js` — enforce primary-unit/reliability guards and attach historical precision.
- `src/analyzer.js` — lock objective once, apply FDR before response construction, rebuild recommendation from validated evidence.
- `src/response_curve.js` — accept only explicitly validated evidence.
- `src/test_planner.js` — keep future-test power semantics labelled as forecast.

### Calibration files created

- `calibration/README.md` — usage and dependency-direction rules.
- `calibration/cli.js` — `smoke|baseline|deep` entrypoint.
- `calibration/rng.js` — deterministic RNG/subseed derivation.
- `calibration/schema.js` — scenario/report schema versions and validation.
- `calibration/dgp/counts.js` — Poisson and Gamma-Poisson counts.
- `calibration/dgp/time_series.js` — weekday/trend/AR(1)/shared shocks.
- `calibration/dgp/ozon_history.js` — Ozon-like daily rows + immutable truth.
- `calibration/scenarios/manifest.js` — profiles and scenario families.
- `calibration/scenarios/adversarial.js` — named B sentinel scenarios.
- `calibration/scenarios/random.js` — seeded continuous parameter sampling.
- `calibration/runners/estimator.js` — A runner.
- `calibration/runners/pipeline.js` — B1/B2 single-SKU runner.
- `calibration/runners/campaign.js` — C multi-SKU runner.
- `calibration/metrics/monte_carlo_ci.js` — Wilson intervals and summaries.
- `calibration/metrics/estimator_metrics.js` — A aggregation.
- `calibration/metrics/pipeline_metrics.js` — B1 change-point/classification scoring.
- `calibration/metrics/decision_metrics.js` — B2 decision/TargetCPC scoring.
- `calibration/metrics/fdr_metrics.js` — campaign FDP/FDR/TDR scoring.
- `calibration/report/json_report.js` — machine-readable report.
- `calibration/report/markdown_report.js` — human summary.
- `calibration/output/.gitkeep` — report directory marker.

### Tests created/modified

- `tests/p0-objective-coverage.test.js`
- `tests/p0-validated-evidence.test.js`
- `tests/p0-data-gap.test.js`
- `tests/p0-historical-precision.test.js`
- `tests/calibration-rng.test.js`
- `tests/calibration-truth.test.js`
- `tests/calibration-estimator.test.js`
- `tests/calibration-pipeline.test.js`
- `tests/calibration-decision.test.js`
- `tests/calibration-fdr.test.js`
- `tests/calibration-report-schema.test.js`
- `tests/calibration-sentinels.test.js`
- modify `.github/workflows/verify.yml`

---

### Task 1: Lock primary objective and enforce Order coverage

**Files:**
- Modify: `src/regime_metrics.js`
- Modify: `src/analyzer.js`
- Test: `tests/p0-objective-coverage.test.js`

**Interfaces:**
- Produces: `resolvePrimaryObjective(days, economicsSettings) -> {mode, name, minCoverage}` exported from `regime_metrics.js`.
- Changes: `aggregateRegimeMetrics(regime, days, economicsSettings, objective)` where `objective` is fixed for every regime of one SKU.
- Each metric returns `primaryMode`, `primaryKpiName`, `primaryCoverage`, `primaryUsable`, `primaryDaily`, `primaryMean`, `primaryVariance`.

- [ ] **Step 1: Write the failing objective-lock tests**

```js
const assert=require('assert');
const M=require('../src/regime_metrics.js');

const days=[
  {date:'2026-06-01',safeOrderReliable:true,safeOrderUnits:2,totalRevenue:1000,spend:50},
  {date:'2026-06-02',safeOrderReliable:true,safeOrderUnits:3,totalRevenue:1200,spend:50},
  {date:'2026-06-03',safeOrderReliable:false,safeOrderUnits:null,totalRevenue:1100,spend:50}
];

const objective=M.resolvePrimaryObjective(days,{minOrderCoverage:.70});
assert.equal(objective.mode,'orders');

const regime={id:'R1',startDate:'2026-06-01',endDate:'2026-06-03',cpc:14};
const metric=M.aggregateRegimeMetrics(regime,days,{minOrderCoverage:.70},objective);
assert.equal(metric.primaryMode,'orders');
assert.equal(metric.primaryUsable,false);
assert.ok(metric.primaryCoverage<.70);
```

Add a second case where whole-history profit inputs select `profit`, then a low-profit-coverage regime remains `profit` with `primaryUsable=false` rather than falling back to orders.

- [ ] **Step 2: Run RED**

Run: `node tests/p0-objective-coverage.test.js`

Expected: FAIL because `resolvePrimaryObjective` and `primaryUsable` do not exist and objective currently varies by regime.

- [ ] **Step 3: Implement objective resolution and fixed-unit aggregation**

Implement:

```js
function resolvePrimaryObjective(days,opt={}){
  const minOrderCoverage=Number.isFinite(Number(opt.minOrderCoverage))?Number(opt.minOrderCoverage):.70;
  const minProfitCoverage=Number.isFinite(Number(opt.minProfitCoverage))?Number(opt.minProfitCoverage):.70;
  const n=(days||[]).length;
  const profits=(days||[]).map(r=>E.contributionProfit(r,opt)).filter(Number.isFinite).length;
  const orders=(days||[]).filter(r=>r.safeOrderReliable&&Number.isFinite(Number(r.safeOrderUnits))).length;
  if(n>0&&profits/n>=minProfitCoverage) return {mode:'profit',name:'contributionProfit/day',minCoverage:minProfitCoverage};
  return {mode:'orders',name:'orders/day',minCoverage:minOrderCoverage};
}
```

`aggregateRegimeMetrics` must derive only the locked objective and set `primaryUsable = primaryCoverage >= objective.minCoverage && primaryMean is finite`.

- [ ] **Step 4: Wire objective once in `analyzer.js`**

Resolve after `safe` series creation and pass the same object to every regime metric.

- [ ] **Step 5: Run GREEN and regression suite**

Run:

```bash
node tests/p0-objective-coverage.test.js
for test_file in tests/*.test.js; do node "$test_file"; done
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/regime_metrics.js src/analyzer.js tests/p0-objective-coverage.test.js
git commit -m "fix: lock primary objective and enforce coverage"
```

---

### Task 2: Detect data gaps as confounded transitions

**Files:**
- Modify: `src/transitions.js`
- Test: `tests/p0-data-gap.test.js`

**Interfaces:**
- Adds: `calendarGapDays(fromEndIso, toStartIso) -> integer >= 0`.
- Transition output adds `reasonCode` and `dataGapDays`.

- [ ] **Step 1: Write failing gap tests**

```js
const assert=require('assert');
const T=require('../src/transitions.js');
assert.equal(T._internals.calendarGapDays('2026-06-10','2026-06-11'),0);
assert.equal(T._internals.calendarGapDays('2026-06-10','2026-06-15'),4);

const regimes=[
 {id:'R1',startDate:'2026-06-01',endDate:'2026-06-10',cpc:14},
 {id:'R2',startDate:'2026-06-15',endDate:'2026-06-25',cpc:16}
];
const budget={states:[{regimeId:'R1',code:'BUDGET_UNCONSTRAINED'},{regimeId:'R2',code:'BUDGET_UNCONSTRAINED'}]};
const price={status:'PRICE_STABLE',daily:[
 {date:'2026-06-05',price:1000,reliable:true},{date:'2026-06-20',price:1000,reliable:true}
]};
const [x]=T.buildTransitions(regimes,budget,price,{maxDataGapDays:0});
assert.equal(x.code,'OTHER_CONFOUNDED_TRANSITION');
assert.equal(x.reasonCode,'DATA_GAP');
assert.equal(x.dataGapDays,4);
```

- [ ] **Step 2: Run RED**

Run: `node tests/p0-data-gap.test.js`

Expected: FAIL because gap logic is absent.

- [ ] **Step 3: Implement gap precedence**

Compute UTC calendar-day distance. Gap confounding must be evaluated before declaring a transition clean; it may be overridden only by an even more specific explicit `otherConfounded` reason if that API already supplies one.

- [ ] **Step 4: Run GREEN + transition/adversarial tests**

Run:

```bash
node tests/p0-data-gap.test.js
node tests/transitions.test.js
node tests/adversarial.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/transitions.js tests/p0-data-gap.test.js
git commit -m "fix: confound CPC transitions across data gaps"
```

---

### Task 3: Add historical two-regime precision and symmetric sufficiency

**Files:**
- Modify: `src/power.js`
- Modify: `src/transition_evaluator.js`
- Test: `tests/p0-historical-precision.test.js`

**Interfaces:**
- Produces: `estimateHistoricalPrecision(a, b, opt) -> {status,se,observedEffectRelative,mdeRelativeApprox,varianceTerm,nA,nB}`.
- Future planner continues using `estimateTestFeasibility(baselineMetrics, targetEffect, opt)` and keeps its forecast assumption text.

- [ ] **Step 1: Write failing symmetric-precision tests**

```js
const assert=require('assert');
const P=require('../src/power.js');
const a={primaryMean:10,primaryVariance:10,nDays:20,primaryMode:'orders'};
const b={primaryMean:12,primaryVariance:40,nDays:20,primaryMode:'orders'};
const x=P.estimateHistoricalPrecision(a,b,{alpha:.05,power:.8});
assert.equal(x.status,'IDENTIFIED');
assert.ok(Math.abs(x.varianceTerm-(10/20+40/20))<1e-9);

const swapped=P.estimateHistoricalPrecision(b,a,{alpha:.05,power:.8});
assert.ok(Math.abs(swapped.varianceTerm-x.varianceTerm)<1e-9);
```

- [ ] **Step 2: Run RED**

Run: `node tests/p0-historical-precision.test.js`

Expected: FAIL because function is absent.

- [ ] **Step 3: Implement two-regime diagnostic**

Use:

```js
varianceTerm = varA/nA + varB/nB;
se = Math.sqrt(varianceTerm);
delta = meanB-meanA;
observedEffectRelative = delta/Math.abs(meanA);
mdeAbsApprox = (zAlpha+zPower)*se;
mdeRelativeApprox = mdeAbsApprox/Math.abs(meanA);
```

For orders, apply a Poisson variance floor independently on both sides: `varA=max(rawVarA,meanA)` and `varB=max(rawVarB,meanB)`.

- [ ] **Step 4: Attach historical precision in evaluator**

Replace any historical sufficiency claim that depends only on `a`. Bootstrap CI remains the primary uncertainty gate; `historicalPrecision` is a diagnostic/sufficiency summary using both regimes.

- [ ] **Step 5: Run GREEN + evaluator tests**

Run:

```bash
node tests/p0-historical-precision.test.js
node tests/uncertainty-integration.test.js
node tests/transition-temporal-integration.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/power.js src/transition_evaluator.js tests/p0-historical-precision.test.js
git commit -m "fix: use both regimes for historical precision"
```

---

### Task 4: Rebuild response evidence only after FDR and reliability gates

**Files:**
- Modify: `src/analyzer.js`
- Modify: `src/response_curve.js`
- Modify: `src/test_planner.js`
- Test: `tests/p0-validated-evidence.test.js`

**Interfaces:**
- Add internal `isValidatedTransition(t, metricsByRegime) -> boolean`.
- Add internal `buildValidatedResponseEvidence(analysis) -> regimeEvidence[]`.
- `analyzeCampaignV2` becomes two-pass: per-SKU structural/evaluator analysis → campaign FDR → per-SKU validated response/recommendation finalization.
- `response_curve.js` receives only evidence with `validationStatus:'VALIDATED'`.

- [ ] **Step 1: Write failing leakage tests**

Construct an analysis with a structurally clean transition whose final state is `FDR_NOT_PASS` and assert:

```js
assert.equal(result.recommendation.status,'NO_FEASIBLE_TEST');
assert.equal(result.responseCurve.points.length,0);
```

Add variants for low primary coverage and `UNCERTAINTY_NOT_IDENTIFIED`.

Add a positive sentinel where `CLEAN + primaryUsable + LAG_STABLE + UNCERTAINTY_IDENTIFIED + FDR_PASS` produces validated evidence.

- [ ] **Step 2: Run RED**

Run: `node tests/p0-validated-evidence.test.js`

Expected: FAIL because recommendation is currently created before campaign FDR.

- [ ] **Step 3: Split `analyzeSku` into pre-FDR and finalize phases**

Use explicit shapes:

```js
function analyzeSkuPreFdr(sku,days,settings){ /* regimes, metrics, transitions only */ }
function finalizeSkuAfterFdr(analysis,settings){ /* validated evidence, curve, recommendation */ }
function analyzeCampaignV2(rows,settings={}){
  const pre=groupRows(rows,settings.todayIso).map(g=>analyzeSkuPreFdr(g.sku,g.days,settings));
  const adjusted=D.MT.applyFdrToCampaign(pre,{alpha:Number(settings.fdrAlpha)||.05});
  return adjusted.map(a=>finalizeSkuAfterFdr(a,settings));
}
```

- [ ] **Step 4: Define the validated transition gate exactly**

A transition supports response direction only when:

```js
return t.code==='CLEAN_CPC_TRANSITION' &&
  from.primaryMode===to.primaryMode &&
  from.primaryUsable===true && to.primaryUsable===true &&
  t.temporal?.status==='LAG_STABLE' &&
  t.uncertainty?.status==='UNCERTAINTY_IDENTIFIED' &&
  Number.isFinite(t.uncertainty?.ci?.low) && Number.isFinite(t.uncertainty?.ci?.high) &&
  (t.effectRelative>0 ? t.uncertainty.ci.low>0 : t.effectRelative<0 ? t.uncertainty.ci.high<0 : false) &&
  t.fdrStatus==='FDR_PASS';
```

- [ ] **Step 5: Prevent response curve from silently accepting unvalidated rows**

`buildResponseCurve` should require `validationStatus==='VALIDATED'` when that field is present; finalizer sets it explicitly.

- [ ] **Step 6: Keep future-test power labelled as forecast**

Ensure planner output contains e.g. `feasibility.assumption` and `powerSemantics:'FUTURE_TEST_FORECAST'`.

- [ ] **Step 7: Run GREEN and full suite**

Run:

```bash
node tests/p0-validated-evidence.test.js
for test_file in tests/*.test.js; do node "$test_file"; done
```

Expected: all PASS; rejected evidence leakage is zero in deterministic tests.

- [ ] **Step 8: Commit**

```bash
git add src/analyzer.js src/response_curve.js src/test_planner.js tests/p0-validated-evidence.test.js
git commit -m "fix: gate TargetCPC on validated post-FDR evidence"
```

---

### Task 5: Seeded RNG, immutable truth, and calibration schemas

**Files:**
- Create: `calibration/rng.js`
- Create: `calibration/schema.js`
- Create: `calibration/README.md`
- Create: `calibration/output/.gitkeep`
- Test: `tests/calibration-rng.test.js`
- Test: `tests/calibration-truth.test.js`

**Interfaces:**
- `createRng(seed) -> {uniform(), normal(), integer(min,max), fork(label)}`.
- `freezeTruth(truth) -> deeply frozen clone`.
- Constants: `SCENARIO_SCHEMA_VERSION='1.0.0'`, `REPORT_SCHEMA_VERSION='1.0.0'`.
- `validateScenario(scenario)` and `validateReport(report)` throw on schema violations.

- [ ] **Step 1: Write RNG reproducibility tests**

```js
const {createRng}=require('../calibration/rng.js');
const a=createRng(123),b=createRng(123),c=createRng(124);
assert.deepEqual([a.uniform(),a.uniform(),a.normal()],[b.uniform(),b.uniform(),b.normal()]);
assert.notDeepEqual([createRng(123).uniform()],[c.uniform()]);
assert.equal(createRng(123).fork('sku-1').uniform(),createRng(123).fork('sku-1').uniform());
```

- [ ] **Step 2: Write truth immutability/schema tests**

Verify production rows contain no `truth` property and mutations of returned truth throw/fail under strict mode.

- [ ] **Step 3: Run RED**

Run:

```bash
node tests/calibration-rng.test.js
node tests/calibration-truth.test.js
```

Expected: FAIL because calibration infrastructure is absent.

- [ ] **Step 4: Implement deterministic RNG and schema helpers**

Use a small dependency-free 32-bit PRNG with Box-Muller normal draws. `fork(label)` derives a stable integer seed from parent seed + UTF-8 label hash; it must not depend on call order in sibling streams.

- [ ] **Step 5: Run GREEN**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add calibration/rng.js calibration/schema.js calibration/README.md calibration/output/.gitkeep tests/calibration-rng.test.js tests/calibration-truth.test.js
git commit -m "feat: add deterministic calibration foundation"
```

---

### Task 6: Build DGP primitives and Ozon-like history generator

**Files:**
- Create: `calibration/dgp/counts.js`
- Create: `calibration/dgp/time_series.js`
- Create: `calibration/dgp/ozon_history.js`
- Create: `calibration/scenarios/adversarial.js`
- Test: `tests/calibration-sentinels.test.js`

**Interfaces:**
- `samplePoisson(lambda,rng)`.
- `sampleGammaPoisson(mean,overdispersion,rng)`.
- `generateLatentSeries(config,rng) -> {demand, sharedShock, weekdayMultiplier, trendMultiplier}`.
- `generateOzonHistory(scenario,rng) -> {rows, truth}`.
- Rows use production-normalized field names accepted by `analyzeCampaignV2`.

- [ ] **Step 1: Write sentinel DGP tests**

Include exact assertions:

```js
const {generateOzonHistory}=require('../calibration/dgp/ozon_history.js');
const {createRng}=require('../calibration/rng.js');
const x=generateOzonHistory({id:'missing-spend',days:30,cpcRegimes:[{start:0,end:29,cpc:14}],missingSpendRate:1,reportedCpc:true},createRng(1));
assert.ok(x.rows.every(r=>r.spend==null));
assert.ok(x.rows.every(r=>r.reportedCpc>0));
assert.ok(!('truth' in x.rows[0]));
assert.ok(Object.isFrozen(x.truth));
```

Also test deterministic `A→B→A`, data-gap indices, shared demand shock, and CPC separation-below-noise scenario generation.

- [ ] **Step 2: Run RED**

Run: `node tests/calibration-sentinels.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement count processes**

Poisson for low/medium counts; Gamma-Poisson for overdispersion. Avoid external libraries.

- [ ] **Step 4: Implement time-series latent factors**

Use multiplicative demand:

```text
latentDemand_t = baseDemand × weekday_t × exp(linearTrend*t) × exp(ar1Shock_t + sharedShock_t)
```

- [ ] **Step 5: Implement Ozon-like observations**

Generate AchievedCPC with log-scale within-regime noise; generate clicks from demand/traffic scale; when Spend is present set `spend = achievedCpc * clicks`; set `reportedCpc = achievedCpc`; generate Orders from the configured count process with the true treatment effect applied after the configured lag.

- [ ] **Step 6: Encode all 16 named adversarial scenarios**

Each scenario exports machine-readable expectations such as `allowRecommendation:false`, `expectedTransitionClass:'OTHER'`, `expectedNoCpcTransition:true`.

- [ ] **Step 7: Run GREEN**

Run: `node tests/calibration-sentinels.test.js`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add calibration/dgp calibration/scenarios/adversarial.js tests/calibration-sentinels.test.js
git commit -m "feat: add seeded Ozon-like calibration DGP"
```

---

### Task 7: Implement Level A estimator calibration

**Files:**
- Create: `calibration/runners/estimator.js`
- Create: `calibration/metrics/monte_carlo_ci.js`
- Create: `calibration/metrics/estimator_metrics.js`
- Test: `tests/calibration-estimator.test.js`

**Interfaces:**
- `runEstimatorReplication(scenario, seed, productionSettings) -> replicateScore`.
- `aggregateEstimatorScores(scores) -> metrics`.
- `wilsonInterval(successes,total,level=.95) -> {low,high}`.

- [ ] **Step 1: Write failing A contracts**

Use a deterministic strong +30% scenario and null scenario. Assert output schema includes `identified`, `ciCovered`, `signRecovered`, `effectEstimate`, `ciWidth`, `pValue`.

- [ ] **Step 2: Run RED**

Run: `node tests/calibration-estimator.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement runner using known regime boundaries**

Construct regime objects directly from truth and call production `evaluateTemporalTransition` then `estimateTemporalUncertainty`. Do not call CPC detector.

- [ ] **Step 4: Implement unconditional/conditional aggregation**

Return at minimum:

```js
{
 replications,
 identificationRate:{estimate,ci},
 ciCoverageIdentified:{estimate,ci},
 signRecoveryAll:{estimate,ci},
 signRecoveryIdentified:{estimate,ci},
 strongFalsePositiveRate:{estimate,ci},
 meanCiWidth
}
```

- [ ] **Step 5: Run GREEN**

Run: `node tests/calibration-estimator.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add calibration/runners/estimator.js calibration/metrics/monte_carlo_ci.js calibration/metrics/estimator_metrics.js tests/calibration-estimator.test.js
git commit -m "feat: add estimator Monte-Carlo calibration"
```

---

### Task 8: Implement B1 pipeline and B2 decision scoring

**Files:**
- Create: `calibration/runners/pipeline.js`
- Create: `calibration/metrics/pipeline_metrics.js`
- Create: `calibration/metrics/decision_metrics.js`
- Test: `tests/calibration-pipeline.test.js`
- Test: `tests/calibration-decision.test.js`

**Interfaces:**
- `runPipelineReplication(scenario,seed,settings) -> {analysis,truth,pipelineScore,decisionScore}`.
- `matchChangePoints(detected,truePoints,toleranceDays=2)` one-to-one minimum-distance matching.
- `scoreDecision(analysis,truth) -> decision metrics`.

- [ ] **Step 1: Write change-point matching tests**

Example true points day 30/60 and detected 31/65 with tolerance 2 must match only day 30↔31; day 60 is missed and day 65 false.

- [ ] **Step 2: Write B2 forbidden-recommendation tests**

For gap, low coverage, mixed price/budget, and explicit FDR-fail fixtures assert `supportedRecommendation=false` and leakage count zero.

- [ ] **Step 3: Run RED**

Run:

```bash
node tests/calibration-pipeline.test.js
node tests/calibration-decision.test.js
```

Expected: FAIL.

- [ ] **Step 4: Implement pipeline runner through real `analyzeCampaignV2`**

Rows go through the same production analyzer. Truth is used only after the result returns.

- [ ] **Step 5: Implement B1 scoring**

Score change-point precision/recall/date error, regime count/value error, structural-class confusion, gap detection, price/budget confound detection, order coverage guard correctness.

- [ ] **Step 6: Implement B2 scoring**

Score final decisions, strong false positives, wrong-sign decisions, recommendation under null/non-identification, `NO_FEASIBLE_TEST`, target direction, and rejected-evidence leakage.

- [ ] **Step 7: Run GREEN**

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add calibration/runners/pipeline.js calibration/metrics/pipeline_metrics.js calibration/metrics/decision_metrics.js tests/calibration-pipeline.test.js tests/calibration-decision.test.js
git commit -m "feat: add pipeline and decision calibration"
```

---

### Task 9: Implement C multi-SKU multiplicity calibration

**Files:**
- Create: `calibration/runners/campaign.js`
- Create: `calibration/metrics/fdr_metrics.js`
- Test: `tests/calibration-fdr.test.js`

**Interfaces:**
- `runCampaignReplication(campaignScenario,seed,settings) -> {analyses,truthBySku,score}`.
- `scoreCampaignDiscoveries(analyses,truthBySku) -> {discoveries,falseDiscoveries,trueDiscoveries,wrongSignDiscoveries,fdp}`.

- [ ] **Step 1: Write FDP definition test**

```js
const s=scoreCampaignDiscoveries(analyses,truth);
assert.equal(s.fdp,s.falseDiscoveries/Math.max(s.discoveries,1));
```

Include zero-discovery case -> `fdp=0`.

- [ ] **Step 2: Write dependence-structure tests**

Same master shared shock must enter all SKU streams in `shared-shock` profile while idiosyncratic streams differ by `rng.fork(sku)`.

- [ ] **Step 3: Run RED**

Run: `node tests/calibration-fdr.test.js`

Expected: FAIL.

- [ ] **Step 4: Implement campaign generator/runner**

Generate mixed null/non-null SKU, concatenate rows, and call `analyzeCampaignV2` once so BH operates on the actual campaign family.

- [ ] **Step 5: Aggregate empirical FDR correctly**

Average per-campaign FDP; also aggregate true discovery rate, wrong-sign discovery rate, and zero-discovery campaign rate with Monte-Carlo intervals.

- [ ] **Step 6: Run GREEN**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add calibration/runners/campaign.js calibration/metrics/fdr_metrics.js tests/calibration-fdr.test.js
git commit -m "feat: add multi-SKU FDR calibration"
```

---

### Task 10: Scenario manifest, smoke/baseline/deep CLI, and reports

**Files:**
- Create: `calibration/scenarios/manifest.js`
- Create: `calibration/scenarios/random.js`
- Create: `calibration/cli.js`
- Create: `calibration/report/json_report.js`
- Create: `calibration/report/markdown_report.js`
- Test: `tests/calibration-report-schema.test.js`
- Modify: `.github/workflows/verify.yml`

**Interfaces:**
- CLI: `node calibration/cli.js --profile smoke --seed 20260828 --out calibration/output`.
- `runProfile(profile,opt) -> report`.
- Report contains `metadata`, `levels.A`, `levels.B1`, `levels.B2`, `levels.C`, `sentinelFailures`.

- [ ] **Step 1: Write report-schema test**

Assert required metadata: production/calibration commit SHA (or explicit `UNKNOWN` only outside git), scenario/report schema versions, Node version, profile, master seed, top-level replication counts, production bootstrap settings, alpha/FDR alpha, timestamp.

- [ ] **Step 2: Write deterministic smoke-report test**

Run the smoke profile twice with the same seed, normalize timestamps/commit metadata, and assert metric payload equality.

- [ ] **Step 3: Run RED**

Run: `node tests/calibration-report-schema.test.js`

Expected: FAIL.

- [ ] **Step 4: Implement manifest profiles**

`smoke` uses a small fixed subset of adversarial + estimator + FDR sentinels and is explicitly tagged `statisticalCalibrationClaim:false`.

`baseline` targets ~300 A/B replications per scenario family and ~200 campaigns per C family.

`deep` targets ~1000 selected A/B replications and ~500 selected C campaigns.

- [ ] **Step 5: Implement seeded random parameter draws**

Draw continuous parameters from documented ranges using `rng.fork(scenarioId)`, not `Math.random()`.

- [ ] **Step 6: Implement JSON + Markdown reporters**

Markdown tables must include estimate + Monte-Carlo CI for proportions; clearly separate unconditional from identified-only metrics.

- [ ] **Step 7: Add CI smoke step**

Add after unit tests:

```bash
node calibration/cli.js --profile smoke --seed 20260828 --out /tmp/advoz-calibration-smoke
```

Then verify no production file imports `calibration/`:

```bash
if grep -R "calibration/" src app.js index.html; then exit 1; fi
```

- [ ] **Step 8: Run GREEN locally/CI**

Run:

```bash
node tests/calibration-report-schema.test.js
node calibration/cli.js --profile smoke --seed 20260828 --out calibration/output/smoke-local
for test_file in tests/*.test.js; do node "$test_file"; done
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add calibration .github/workflows/verify.yml tests/calibration-report-schema.test.js
git commit -m "feat: add calibration profiles reports and CI smoke"
```

---

### Task 11: Run first baseline calibration and record immutable evidence

**Files:**
- Create: `calibration/output/baseline-<production-sha>-<schema-version>-<seed>.json`
- Create: `calibration/output/baseline-<production-sha>-<schema-version>-<seed>.md`
- Modify: `README.md`

**Interfaces:**
- No production-default changes in this task.
- Baseline report is diagnostic only and must state that numerical statistical release gates are not yet approved.

- [ ] **Step 1: Run full baseline using production defaults**

Run:

```bash
node calibration/cli.js --profile baseline --seed 20260828 --out calibration/output
```

- [ ] **Step 2: Validate baseline report schema**

Run a Node assertion that `validateReport(JSON.parse(fs.readFileSync(report)))` succeeds and `sentinelFailures.length===0` for hard deterministic invariants.

- [ ] **Step 3: Review key tables without changing production defaults**

Extract and record:

- A: identification, null strong FP, CI coverage, sign recovery at ±20%;
- B1: change-point precision/recall/date error and confusion matrix;
- B2: wrong-sign strong decisions, recommendation under null/non-identification, TargetCPC direction, leakage;
- C: empirical FDR/TDR under independent and shared shocks.

- [ ] **Step 4: Update README status**

Document baseline report path and state explicitly: `calibration measured; numerical release thresholds pending explicit approval`.

- [ ] **Step 5: Run final verification**

Run:

```bash
for js_file in app.js src/*.js calibration/**/*.js calibration/*.js tests/*.js; do node --check "$js_file"; done
for test_file in tests/*.test.js; do node "$test_file"; done
node calibration/cli.js --profile smoke --seed 20260828 --out /tmp/advoz-calibration-smoke-final
```

Expected: all PASS.

- [ ] **Step 6: Commit baseline evidence**

```bash
git add calibration/output README.md
git commit -m "calibration: record first v2 baseline report"
```

---

## Plan Self-Review Results

- **Spec coverage:** P0-1 through P0-5 are Tasks 1–4; missing-Spend remains in DGP sentinels; A is Task 7; B1/B2 Task 8; C Task 9; reporting/profiles Task 10; immutable first baseline Task 11.
- **Dependency direction:** only `calibration/*` imports `src/*`; production import guard is part of CI.
- **Type consistency:** `primaryUsable`, `validationStatus`, `FDR_PASS`, `UNCERTAINTY_IDENTIFIED`, `LAG_STABLE`, and `NO_FEASIBLE_TEST` match current production terminology.
- **No auto-tuning:** no task changes alpha/block size/lag/FDR/CPC-step defaults based on calibration results.
- **No placeholders:** first baseline numerical statistical gates intentionally remain unapproved by the design; the plan does not invent them.
