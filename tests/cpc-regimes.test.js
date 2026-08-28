const assert = require('assert');
const R = require('../src/cpc_regimes.js');

function days(cpcs){
  return cpcs.map((cpc,i)=>({date:`2026-07-${String(i+1).padStart(2,'0')}`,clicks:100,spend:100*cpc,reportedCpc:cpc}));
}
function eq(a,b,t=0.25){ assert.ok(Math.abs(a-b)<=t, `${a} not within ${t} of ${b}`); }

{
  const a=[14,14.2,13.8,14.1,13.9,14.15,13.85,14.05,13.95,14.1,13.9,14.0,14.05,13.95];
  const out=R.detectCpcRegimes(days(a),{minDays:4,minRelativeChange:.05,noiseMultiplier:2.5});
  assert.strictEqual(out.regimes.length,1);
  eq(out.regimes[0].cpcMedian,14,.15);
}

{
  const a=[14,14.1,13.9,14,14.1,13.9,14,14.05,16,16.1,15.9,16,16.05,15.95,16,16.1];
  const out=R.detectCpcRegimes(days(a),{minDays:4,minRelativeChange:.05,noiseMultiplier:2});
  assert.strictEqual(out.regimes.length,2);
  eq(out.regimes[0].cpcMedian,14,.15);
  eq(out.regimes[1].cpcMedian,16,.15);
  assert.strictEqual(out.changePoints[0].date,'2026-07-09');
}

{
  const a=[14,14.1,13.9,14,14.1,18,13.9,14,14.05,13.95,14.1,13.9,14,14.05];
  const out=R.detectCpcRegimes(days(a),{minDays:4,minRelativeChange:.05,noiseMultiplier:2});
  assert.strictEqual(out.regimes.length,1);
}

{
  const a=[14,14.3,13.8,14.2,13.9,14.1,14.0,14.2,14.25,14.35,14.1,14.3,14.2,14.25,14.3,14.2];
  const out=R.detectCpcRegimes(days(a),{minDays:4,minRelativeChange:.04,noiseMultiplier:2.5});
  assert.strictEqual(out.regimes.length,1);
}

console.log('PASS CPC regime detection contracts');
