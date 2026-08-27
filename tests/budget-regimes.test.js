const assert = require('assert');
const B = require('../src/budget_regimes.js');

function makeDays(spends,cpc=10){
  return spends.map((spend,i)=>({
    date:`2026-06-${String(i+1).padStart(2,'0')}`,
    spend,
    clicks:spend/cpc,
    reportedCpc:cpc
  }));
}
function regime(days){ return {id:'R1',startDate:days[0].date,endDate:days.at(-1).date,days,nDays:days.length,cpcMedian:10}; }

{
  const d=makeDays(Array(28).fill(1000));
  const out=B.inferEffectiveBudgetStates(d,[regime(d)],{minRollingPoints:5,plateauCv:.04});
  assert.strictEqual(out.states[0].code,'BUDGET_CONSTRAINED');
  assert.ok(out.states[0].observedCeiling>0);
  assert.strictEqual('configuredBudget' in out.states[0],false);
}

{
  // Two perfectly flat spend levels at unchanged CPC are ambiguous: demand can create the same pattern.
  const d=makeDays([...Array(14).fill(1000),...Array(14).fill(2000)]);
  const out=B.inferEffectiveBudgetStates(d,[regime(d)],{minRollingPoints:5,plateauCv:.05,capChangeRelative:.2,minDailyCvForCapChange:.08});
  assert.strictEqual(out.states[0].code,'BUDGET_STATE_UNCERTAIN');
  assert.strictEqual(out.changePoints.length,0);
  assert.strictEqual(out.states[0].structuralShiftObserved,true);
}

{
  // Repeating day-level variation with a stable 7-day total gives stronger evidence of an effective weekly ceiling.
  const week=[700,1300,900,1100,800,1200,1000];
  const d=makeDays([...week,...week,...week.map(x=>x*2),...week.map(x=>x*2)]);
  const out=B.inferEffectiveBudgetStates(d,[regime(d)],{minRollingPoints:5,plateauCv:.05,capChangeRelative:.2,minDailyCvForCapChange:.08});
  assert.strictEqual(out.states[0].code,'BUDGET_CAP_CHANGED');
  assert.ok(out.changePoints.length>=1);
  assert.strictEqual(out.states[0].cause,'INFERRED_EFFECTIVE_CEILING_SHIFT');
}

{
  const spends=[300,500,800,1200,1700,2200,900,400,2500,700,1800,350,2100,600,2600,450,1900,3000,550,2300,800,2800,500,2000,3200,650,2400,900];
  const d=makeDays(spends);
  const out=B.inferEffectiveBudgetStates(d,[regime(d)],{minRollingPoints:5,plateauCv:.04,unconstrainedCv:.12});
  assert.strictEqual(out.states[0].code,'BUDGET_UNCONSTRAINED');
}

{
  const d=makeDays([1000,1050,980,1100,970,1020,1080,950,1120,990,1030]);
  const out=B.inferEffectiveBudgetStates(d,[regime(d)],{minRollingPoints:6});
  assert.strictEqual(out.states[0].code,'BUDGET_STATE_UNCERTAIN');
}

console.log('PASS effective budget-state inference contracts');
