const assert=require('assert');
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');

assert.match(html,/<th>Temporal<\/th>/);
assert.match(html,/src\/temporal_adjustment\.js/);
assert.match(app,/function temporalHtml\(/);
assert.match(app,/LAG_STABLE/);
assert.match(app,/lag 0\/\+1\/\+2/i);
assert.match(app,/TEMPORAL_ADJUSTED/);

console.log('PASS temporal calibration is visible in UI');
