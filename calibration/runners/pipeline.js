'use strict';
const {createRng}=require('../rng.js');
const {generateOzonHistory}=require('../dgp/ozon_history.js');
const A=require('../../src/analyzer.js');
const PM=require('../metrics/pipeline_metrics.js');
const DM=require('../metrics/decision_metrics.js');

function runPipelineReplication(scenario,seed,settings={}){
  const parameters=scenario?.parameters||scenario||{},scenarioId=String(scenario?.id||parameters.id||'B');
  const generated=generateOzonHistory({...parameters,id:scenarioId,expectedNextDirection:parameters.expectedNextDirection||scenario?.expectations?.expectedNextDirection},createRng(seed));
  const analyses=A.analyzeCampaignV2(generated.rows,settings),analysis=analyses.find(x=>x.sku===generated.truth.sku)||analyses[0]||null;
  if(!analysis)throw new Error(`production analyzer returned no SKU for ${scenarioId}`);
  const expectations=scenario?.expectations||{},pipelineScore=PM.scorePipeline(analysis,generated.truth,expectations),decisionScore=DM.scoreDecision(analysis,generated.truth,expectations);
  decisionScore.nullEffect=generated.truth.nullEffect;
  return{scenarioId,seed,analysis,truth:generated.truth,pipelineScore,decisionScore};
}
module.exports={runPipelineReplication,matchChangePoints:PM.matchChangePoints};
