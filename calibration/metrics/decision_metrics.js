'use strict';
const {wilsonInterval}=require('./monte_carlo_ci.js');

function expectedDirection(truth){
  if(['UP','DOWN'].includes(truth?.expectedNextDirection))return truth.expectedNextDirection;
  const e=Number(truth?.cpcElasticity);return e>1e-12?'UP':e<-1e-12?'DOWN':null;
}
function expectedTransitionSign(t,truth){
  const e=Number(truth?.cpcElasticity),a=Number(t?.fromCpc),b=Number(t?.toCpc);
  if(!Number.isFinite(e)||!(a>0&&b>0))return 0;
  return Math.sign(Math.pow(b/a,e)-1);
}
function scoreDecision(analysis,truth,expectations={}){
  const transitions=analysis?.transitions||[],strong=transitions.filter(t=>['DEPLOY','ROLLBACK'].includes(t.decision));
  const nullEffect=Math.abs(Number(truth?.cpcElasticity)||0)<1e-12,strongFalsePositive=nullEffect&&strong.length>0;
  const wrongSignStrongDecision=strong.some(t=>{const sign=expectedTransitionSign(t,truth);return(t.decision==='DEPLOY'&&sign<=0)||(t.decision==='ROLLBACK'&&sign>=0)});
  const recommendation=analysis?.recommendation||{},supportedRecommendation=recommendation.status==='RECOMMENDED',identified=!!analysis?.validatedDirection,expected=expectedDirection(truth),targetDirection=supportedRecommendation?recommendation.direction:null;
  const targetDirectionCorrect=supportedRecommendation&&expected?targetDirection===expected:null;
  const forbiddenRecommendation=expectations.allowSupportedRecommendation===false&&supportedRecommendation;
  const rejectedEvidenceLeakage=supportedRecommendation&&(!identified||!(analysis?.responseEvidence||[]).length||(analysis.responseEvidence||[]).some(x=>x.validationStatus!=='VALIDATED'));
  return{identified,strongDecisionCount:strong.length,strongFalsePositive,wrongSignStrongDecision,supportedRecommendation,forbiddenRecommendation,rejectedEvidenceLeakage,recommendedUnderNull:nullEffect&&supportedRecommendation,recommendedUnderNonIdentification:!identified&&supportedRecommendation,noFeasibleTest:recommendation.status==='NO_FEASIBLE_TEST',targetDirection,targetDirectionCorrect,expectedDirection:expected,decisionDistribution:transitions.reduce((m,t)=>{const k=t.decision||'INCONCLUSIVE';m[k]=(m[k]||0)+1;return m},{})};
}
function aggregateDecisionScores(scores=[]){
  const a=scores||[],nulls=a.filter(x=>x.nullEffect===true||x._nullEffect===true),identified=a.filter(x=>x.identified),recommended=a.filter(x=>x.supportedRecommendation),directionScored=a.filter(x=>x.targetDirectionCorrect!==null);
  return{replications:a.length,identificationRate:wilsonInterval(identified.length,a.length),supportedRecommendationRate:wilsonInterval(recommended.length,a.length),forbiddenRecommendationRate:wilsonInterval(a.filter(x=>x.forbiddenRecommendation).length,a.length),rejectedEvidenceLeakageRate:wilsonInterval(a.filter(x=>x.rejectedEvidenceLeakage).length,a.length),targetDirectionAccuracy:wilsonInterval(directionScored.filter(x=>x.targetDirectionCorrect).length,directionScored.length),wrongSignStrongDecisionRate:wilsonInterval(a.filter(x=>x.wrongSignStrongDecision).length,a.length),strongFalsePositiveRate:wilsonInterval(nulls.filter(x=>x.strongFalsePositive).length,nulls.length)};
}
module.exports={scoreDecision,aggregateDecisionScores,_internals:{expectedDirection,expectedTransitionSign}};
