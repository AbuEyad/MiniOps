const { db } = require('../../db');
const { HttpError } = require('../../utils/http');
const { uid } = require('../../shared/ids');
const { buildSale, loadState } = require('./sales.service');

exports.list = async (req, res) => res.json(await loadState());

exports.create = async (req, res) => {
  const s = buildSale(req.body || {});
  await db.run('INSERT INTO sales (id, date, product, qty, rate, total) VALUES ($1,$2,$3,$4,$5,$6)',
    [uid('sale'), s.date, s.product, s.qty, s.rate, s.total]);
  res.json(await loadState());
};

exports.remove = async (req, res) => {
  const r = await db.run('DELETE FROM sales WHERE id = $1', [req.params.id]);
  if(!r.changes) throw new HttpError(404, 'Sale not found.');
  res.json(await loadState());
};