'use strict';
const assert=require('assert');
const P=require('../src/power.js');

const a={primaryMean:10,primaryVariance:10,nDays:20,primaryMode:'orders',primaryKpiName:'orders/day'};
const b={primaryMean:12,primaryVariance:40,nDays:20,primaryMode:'orders',primaryKpiName:'orders/day'};
const x=P.estimateHistoricalPrecision(a,b,{alpha:.05,power:.8});
assert.equal(x.status,'IDENTIFIED');
assert.ok(Math.abs(x.varianceTerm-(10/20+40/20))<1e-9);
assert.equal(x.nA,20);
assert.equal(x.nB,20);
assert.ok(x.se>0);
assert.ok(x.mdeRelativeApprox>0);

const swapped=P.estimateHistoricalPrecision(b,a,{alpha:.05,power:.8});
assert.ok(Math.abs(swapped.varianceTerm-x.varianceTerm)<1e-9);

const bad=P.estimateHistoricalPrecision({...a,nDays:0},b,{});
assert.equal(bad.status,'NOT_IDENTIFIED');

console.log('PASS historical two-regime precision contracts');
