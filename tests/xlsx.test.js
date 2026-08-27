const assert = require('assert');
const X = require('../src/xlsx.js');

const rows = [
  ['Кампания №14615565'],
  ['День','SKU','Клики','Добавления в корзину','Средняя стоимость клика, ₽','Заказано на сумму, ₽'],
  ['01.08.2026','123',10,2,15.5,1000]
];
const found = X._internals.findOzonTable(rows);
assert.ok(found);
assert.strictEqual(found.campaignId, '14615565');
assert.strictEqual(found.rows.length, 1);
assert.strictEqual(found.rows[0]['SKU'], '123');
assert.strictEqual(Object.prototype.hasOwnProperty.call(found.rows[0], 'Расход, ₽'), false);
console.log('PASS finds Ozon table without requiring Spend column');
