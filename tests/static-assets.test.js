const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(!/https?:\/\//i.test(html),'index.html must not depend on remote assets');
const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(x=>!x.startsWith('#'));
for(const ref of refs){
  assert.ok(fs.existsSync(path.join(root,ref)),`missing local asset: ${ref}`);
}
assert.ok(html.indexOf('src/ui_format.js')<html.indexOf('app.js'),'ui formatter must load before app.js');
console.log(`PASS local browser bundle assets (${refs.length} refs)`);
