'use strict';
const assert=require('assert');
const {scoreDecision}=require('../calibration/metrics/decision_metrics.js');

{
  const analysis={
    transitions:[{decision:'DEPLOY',code:'CLEAN_CPC_TRANSITION',fdrStatus:'FDR_PASS'}],
    validatedDirection:'UP',responseEvidence:[{validationStatus:'VALIDATED'}],
    recommendation:{status:'RECOMMENDED',direction:'UP',targetCpc:16}
  };
  const truth={trueEffect:0,cpcElasticity:0,expectedNextDirection:null};
  const s=scoreDecision(analysis,truth,{allowSupportedRecommendation:false});
  assert.equal(s.strongFalsePositive,true);
  assert.equal(s.supportedRecommendation,true);
  assert.equal(s.forbiddenRecommendation,true);
  assert.equal(s.recommendedUnderNull,true);
}

{
  const analysis={
    transitions:[{decision:'DEPLOY',code:'CLEAN_CPC_TRANSITION',fdrStatus:'FDR_PASS'}],
    validatedDirection:'UP',responseEvidence:[{validationStatus:'VALIDATED'}],
    recommendation:{status:'RECOMMENDED',direction:'UP',targetCpc:17}
  };
  const truth={trueEffect:.2,cpcElasticity:1,expectedNextDirection:'UP'};
  const s=scoreDecision(analysis,truth,{allowSupportedRecommendation:true});
  assert.equal(s.identified,true);
  assert.equal(s.targetDirectionCorrect,true);
  assert.equal(s.wrongSignStrongDecision,false);
}

{
  const analysis={transitions:[{decision:'INCONCLUSIVE',fdrStatus:'FDR_NOT_PASS'}],validatedDirection:null,responseEvidence:[],recommendation:{status:'NO_FEASIBLE_TEST'}};
  const truth={trueEffect:.2,cpcElasticity:1,expectedNextDirection:'UP'};
  const s=scoreDecision(analysis,truth,{allowSupportedRecommendation:false});
  assert.equal(s.supportedRecommendation,false);
  assert.equal(s.rejectedEvidenceLeakage,false);
  assert.equal(s.noFeasibleTest,true);
}

console.log('PASS B2 decision-policy calibration contracts');
