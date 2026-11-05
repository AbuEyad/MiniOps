const { db } = require('../../db');
const { HttpError } = require('../../utils/http');

const round2 = n => Math.round(n * 100) / 100;

function buildSale(body){
  const date = String(body.date || '').trim();
  const product = String(body.product || '').trim();
  const qty = Math.round(Number(body.qty));
  const rate = Number(body.rate);
  if(date.length !== 10 || isNaN(Date.parse(date))) throw new HttpError(400, 'Pick a valid date.');
  if(!product) throw new HttpError(400, 'Enter a product.');
  if(!(qty > 0)) throw new HttpError(400, 'Quantity must be more than zero.');
  if(!(rate >= 0)) throw new HttpError(400, 'Rate cannot be negative.');
  return { date, product, qty, rate, total: round2(qty * rate) };
}

// The 'state' the browser needs. Note the LIMIT and the explicit column list: read only what you show.
async function loadState(){
  const [sales, daily] = await Promise.all([
    db.all('SELECT id, date, product, qty, rate, total FROM sales ORDER BY date DESC, created_at DESC LIMIT 100'),
    db.all('SELECT date, SUM(qty)::int AS qty, SUM(total) AS total FROM sales GROUP BY date ORDER BY date DESC LIMIT 7')
  ]);
  return { sales, daily };
}

module.exports = { buildSale, loadState };