'use strict';
const assert=require('assert');
const {createRng}=require('../calibration/rng.js');

const a=createRng(123),b=createRng(123),c=createRng(124);
const seqA=[a.uniform(),a.uniform(),a.normal(),a.integer(3,9)];
const seqB=[b.uniform(),b.uniform(),b.normal(),b.integer(3,9)];
assert.deepStrictEqual(seqA,seqB);
assert.notStrictEqual(createRng(123).uniform(),c.uniform());

const p1=createRng(987),childA=p1.fork('sku-1'),childB=p1.fork('sku-2');
const p2=createRng(987);
assert.strictEqual(childA.uniform(),p2.fork('sku-1').uniform());
assert.strictEqual(childB.uniform(),p2.fork('sku-2').uniform());

const order1=createRng(555),x1=order1.fork('A').uniform(),y1=order1.fork('B').uniform();
const order2=createRng(555),y2=order2.fork('B').uniform(),x2=order2.fork('A').uniform();
assert.strictEqual(x1,x2);
assert.strictEqual(y1,y2);

console.log('PASS calibration RNG reproducibility contracts');
