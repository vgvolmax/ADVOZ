'use strict';
const {wilsonInterval,meanFinite}=require('./monte_carlo_ci.js');

function aggregateEstimatorScores(scores=[]){
  const a=scores||[],identified=a.filter(x=>x.identified===true),nullRuns=a.filter(x=>Math.abs(Number(x.trueEffect)||0)<1e-12),nonnull=a.filter(x=>Math.abs(Number(x.trueEffect)||0)>=1e-12),identifiedNonnull=nonnull.filter(x=>x.identified===true);
  return{
    replications:a.length,
    identificationRate:wilsonInterval(identified.length,a.length),
    ciCoverageIdentified:wilsonInterval(identified.filter(x=>x.ciCovered===true).length,identified.length),
    strongFalsePositiveRate:wilsonInterval(nullRuns.filter(x=>x.strongFalsePositive===true).length,nullRuns.length),
    signRecoveryAll:wilsonInterval(nonnull.filter(x=>x.signRecovered===true).length,nonnull.length),
    signRecoveryIdentified:wilsonInterval(identifiedNonnull.filter(x=>x.signRecovered===true).length,identifiedNonnull.length),
    meanCiWidth:meanFinite(identified.map(x=>Number(x.ciWidth)))
  };
}
module.exports={aggregateEstimatorScores};
