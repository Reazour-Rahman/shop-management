const router = require('express').Router();
const mongoose = require('mongoose');
const { Product } = require('./models');
const { Sale, Payment, StockMove } = require('./saleModels');
const { Purchase, SupplierPayment } = require('./purchaseModels');
const { SalaryRecord, SalaryPayment, Expense } = require('./hrModels');

const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));
const r2 = n => Math.round(n * 100) / 100;
const agg = async (M, match, field) => { const [r] = await M.aggregate([{ $match: match }, { $group: { _id: null, v: { $sum: field } } }]); return r2(r?.v || 0); };
const dateMatch = (from, to) => (from || to) ? { date: { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to + 'T23:59:59.999Z') }) } } : {};

// Inventory value at a date (periodic method, weighted average): stock qty from stock movements x average purchase cost up to that date
async function inventoryValue(max) {
  const f = max ? { date: { $lte: max } } : {};
  const [prods, allMoves, purs] = await Promise.all([Product.find({ isService: false }), StockMove.find({ type: { $ne: 'opening' } }), Purchase.find(f)]);
  let total = 0;
  for (const p of prods) {
    const id = String(p._id), mine = allMoves.filter(m => String(m.product) === id);
    // Opening quantity = current stock minus every recorded movement. Works even for products that have no opening entry.
    const openQty = p.stock - mine.reduce((t, m) => t + m.qty, 0);
    const qty = openQty + mine.filter(m => !max || m.date <= max).reduce((t, m) => t + m.qty, 0);
    let buyQty = Math.max(openQty, 0), buyVal = buyQty * (p.openingCost || 0);
    for (const pu of purs) for (const l of pu.items) if (String(l.product) === id) { buyQty += l.qty; buyVal += l.total; }
    if (qty > 0 && buyQty > 0) total += qty * (buyVal / buyQty);
  }
  return r2(total);
}

async function statement(from, to) {
  const m = dateMatch(from, to);
  // Salary is an accrual: counted in the month it belongs to, whenever it is paid
  const pm = (from || to) ? { from: { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to + 'T23:59:59.999Z') }) } } : {};
  const [revenue, purchases, salary, cats, cashIn, paidSup, salPaid, beginInv, endInv] = await Promise.all([
    agg(Sale, m, '$total'), agg(Purchase, m, '$total'), agg(SalaryRecord, pm, '$amount'),
    Expense.aggregate([{ $match: m }, { $group: { _id: '$category', total: { $sum: '$amount' } } }, { $sort: { total: -1 } }]),
    agg(Payment, m, '$amount'), agg(SupplierPayment, m, '$amount'), agg(SalaryPayment, m, '$amount'),
    inventoryValue(from ? new Date(new Date(from) - 1) : new Date(0)), inventoryValue(to ? new Date(to + 'T23:59:59.999Z') : undefined),
  ]);
  const cogs = r2(beginInv + purchases - endInv), gross = r2(revenue - cogs);
  const other = r2(cats.reduce((t, c) => t + c.total, 0)), opex = r2(salary + other);
  return { revenue, beginInv, purchases, endInv, cogs, gross, salary, other, opex,
    categories: cats.map(c => ({ category: c._id, total: r2(c.total) })), cost: r2(cogs + opex), net: r2(gross - opex),
    cash: { in: cashIn, suppliers: paidSup, salary: salPaid, other, net: r2(cashIn - paidSup - salPaid - other) } };
}

router.get('/income-statement', wrap(async (req, res) => res.json(await statement(req.query.from, req.query.to))));

router.get('/dashboard', wrap(async (req, res) => {
  const t = /^\d{4}-\d{2}-\d{2}$/.test(req.query.today || '') ? req.query.today : new Date().toISOString().slice(0, 10);
  const day = new Date(t), end = new Date(t + 'T23:59:59.999Z'), mStart = new Date(t.slice(0, 7) + '-01');
  const month = { date: { $gte: mStart, $lte: end } };
  const start30 = new Date(day.getTime() - 29 * 864e5);
  const [todaySales, monthSales, monthPaid, monthDue, clientDue, payable, salaryDue, monthExpense, life, low, daily] = await Promise.all([
    agg(Sale, { date: { $gte: day, $lte: end } }, '$total'), agg(Sale, month, '$total'), agg(Sale, month, '$paid'), agg(Sale, month, '$due'),
    agg(Sale, { due: { $gt: 0 } }, '$due'), agg(Purchase, { due: { $gt: 0 } }, '$due'), agg(SalaryRecord, { due: { $gt: 0 } }, '$due'),
    agg(Expense, month, '$amount'), statement(),
    Product.find({ isService: false, $expr: { $lte: ['$stock', '$lowStock'] } }).select('name brand color size thickness stock unit').sort('name'),
    Sale.aggregate([{ $match: { date: { $gte: start30, $lte: end } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$total' } } }]),
  ]);
  const by = Object.fromEntries(daily.map(d => [d._id, d.total]));
  const series = Array.from({ length: 30 }, (_, i) => { const k = new Date(start30.getTime() + i * 864e5).toISOString().slice(0, 10); return { date: k, total: r2(by[k] || 0) }; });
  res.json({ todaySales, monthSales, monthPaid, monthDue, clientDue, payable, salaryDue, monthExpense, lifetimeNet: life.net, low, series });
}));

// Full database backup as one JSON file
router.get('/backup', wrap(async (req, res) => {
  const db = mongoose.connection.db, out = {};
  for (const c of await db.listCollections().toArray()) out[c.name] = await db.collection(c.name).find().toArray();
  res.setHeader('Content-Disposition', `attachment; filename="thai-glass-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ exportedAt: new Date(), data: out });
}));

module.exports = router;
