'use strict';
const {SCENARIO_SCHEMA_VERSION}=require('../schema.js');

function s(id,parameters,expectations={}){return{schemaVersion:SCENARIO_SCHEMA_VERSION,id,level:'B',parameters:{days:90,startDate:'2026-06-01',orderBaseMean:20,clickBaseMean:250,basePrice:500,cpcNoiseSigma:.015,orderOverdispersion:.08,cpcRegimes:[{start:0,end:44,cpc:14},{start:45,end:89,cpc:16}],trueEffect:.20,trueLag:0,...parameters},truth:{declaredByScenario:true},expectations:{allowSupportedRecommendation:true,...expectations}}}

const ADVERSARIAL_SCENARIOS=[
  s('demand-shock-at-cpc-change',{demandShock:{start:45,multiplier:1.5}},{allowSupportedRecommendation:false,expectedTransitionClass:'UNCERTAIN_OR_CONFOUNDED'}),
  s('pure-trend-null',{trueEffect:0,linearTrend:.012},{allowSupportedRecommendation:false,trueNull:true}),
  s('long-data-gap',{gapIndices:[42,43,44,45,46,47]},{allowSupportedRecommendation:false,expectedReasonCode:'DATA_GAP'}),
  s('cpc-outlier-near-gap',{cpcRegimes:[{start:0,end:89,cpc:14}],gapIndices:[44,45],cpcOutliers:{43:1.35,46:.75},trueEffect:0},{allowSupportedRecommendation:false,expectedNoCpcTransition:true}),
  s('missing-spend-valid-cpc',{missingSpendRate:1},{mustNeverCreateZeroCpc:true}),
  s('partial-spend',{missingSpendRate:.45},{mustNeverCreateZeroCpc:true}),
  s('low-order-coverage',{orderCoverageRate:.25},{allowSupportedRecommendation:false,expectedCoverageGuard:true}),
  s('cpc-plus-price',{priceRegimes:[{start:0,end:44,price:500},{start:45,end:89,price:620}]},{allowSupportedRecommendation:false,expectedTransitionClass:'PRICE_CONFOUNDED_TRANSITION'}),
  s('cpc-plus-budget',{weeklyBudgetCaps:[{start:0,end:44,cap:7000},{start:45,end:89,cap:11000}]},{allowSupportedRecommendation:false,expectedTransitionClass:'MIXED_OR_UNCERTAIN'}),
  s('short-baseline-long-target',{cpcRegimes:[{start:0,end:9,cpc:14},{start:10,end:89,cpc:16}]},{allowSupportedRecommendation:true}),
  s('cpc-a-b-a',{cpcRegimes:[{start:0,end:29,cpc:14},{start:30,end:59,cpc:16},{start:60,end:89,cpc:14}]},{allowSupportedRecommendation:true,expectedReturnToBaseline:true}),
  s('structural-demand-shift-no-cpc',{cpcRegimes:[{start:0,end:89,cpc:14}],trueEffect:0,demandShock:{start:45,multiplier:1.6}},{allowSupportedRecommendation:false,expectedNoCpcTransition:true}),
  s('cpc-separation-below-noise',{cpcRegimes:[{start:0,end:44,cpc:14},{start:45,end:89,cpc:14.5}],cpcNoiseSigma:.06,nominalNoiseGuard:.10},{allowSupportedRecommendation:false,expectedSeparationInsufficient:true}),
  s('stable-cpc-demand-growth',{cpcRegimes:[{start:0,end:89,cpc:14}],trueEffect:0,linearTrend:.018},{allowSupportedRecommendation:false,expectedNoCpcTransition:true}),
  s('clean-cpc-null',{trueEffect:0},{allowSupportedRecommendation:false,trueNull:true,expectedTransitionClass:'CLEAN_CPC_TRANSITION'}),
  s('lag-sensitive-effect',{trueEffect:.20,trueLag:2,demandShock:{start:45,end:46,multiplier:.55}},{allowSupportedRecommendation:false,expectedLagSensitive:true})
];
function getAdversarialScenario(id){return ADVERSARIAL_SCENARIOS.find(x=>x.id===id)||null}
module.exports={ADVERSARIAL_SCENARIOS,getAdversarialScenario};
