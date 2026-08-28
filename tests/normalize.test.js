const assert = require('assert');
const N = require('../src/normalize.js');

function test(name, fn){
  try { fn(); console.log('PASS', name); }
  catch (e) { console.error('FAIL', name, e); process.exitCode = 1; }
}

test('normalizes Ozon row and computes achieved CPC from spend/clicks', () => {
  const [r] = N.normalizeOzonRows([{
    'День':'2026-08-01','SKU':'123','Название товара':'Товар',
    'Показы':1000,'Клики':100,'Добавления в корзину':20,
    'Расход, ₽':1500,'Средняя стоимость клика, ₽':16,
    'Заказано на сумму, ₽':5000
  }], '42', 1);
  assert.strictEqual(r.campaignId, '42');
  assert.strictEqual(r.sku, '123');
  assert.strictEqual(r.spend, 1500);
  assert.strictEqual(N.actualCpc(r), 15);
});

test('falls back to reported Ozon CPC when Spend is missing', () => {
  const [r] = N.normalizeOzonRows([{
    'День':'2026-08-02','SKU':'123','Клики':100,
    'Расход, ₽':'','Средняя стоимость клика, ₽':14.7,
    'Заказано на сумму, ₽':1000
  }], '42', 1);
  assert.strictEqual(r.spend, null);
  assert.strictEqual(N.actualCpc(r), 14.7);
});

test('accounting mismatch is a data quality warning only', () => {
  const row = { clicks:100, spend:1000, reportedCpc:15 };
  const q = N.validateAccounting(row, 0.05);
  assert.strictEqual(q.ok, false);
  assert.strictEqual(q.code, 'ACCOUNTING_MISMATCH');
  assert.ok(q.relativeError > 0.3);
  assert.strictEqual('budgetState' in q, false);
});
