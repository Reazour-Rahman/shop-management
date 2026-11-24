const router = require('express').Router();
const { Product, nextId } = require('./models');
const { StockMove } = require('./saleModels');
const { Supplier, Purchase, SupplierPayment } = require('./purchaseModels');
const { supplierOpening, paidAgainstOpening, readOpening } = require('./opening');

const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));
const num = v => Number(v) || 0;
const r2 = n => Math.round(n * 100) / 100;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SF = ['name', 'phone', 'address'];
const OP = 'openingPayable';
const pick = (o, ks) => Object.fromEntries(ks.filter(k => o[k] !== undefined).map(k => [k, o[k]]));

async function addPayment(p, amount, date, method) {
  amount = r2(num(amount));
  if (amount <= 0) throw new Error('Enter an amount greater than 0');
  if (amount > p.due) throw new Error(`Amount is more than the payable (${p.due}) on ${p.purchaseNo}`);
  await SupplierPayment.create({ supplier: p.supplier, purchase: p._id, amount, method, date: date ? new Date(date) : new Date() });
  p.paid = r2(p.paid + amount); p.due = r2(p.total - p.paid);
  p.status = p.due <= 0 ? 'Paid' : 'Partial';
  await p.save();
}

// ---- Suppliers ----
router.post('/suppliers', wrap(async (req, res) => {
  const op = readOpening(req.body, OP);
  if (op[OP] > 0 && !op.openingDate) op.openingDate = new Date();
  res.json(await Supplier.create({ ...pick(req.body, SF), ...op }));
}));
router.put('/suppliers/:id', wrap(async (req, res) => {
  const op = readOpening(req.body, OP);
  if (op[OP] !== undefined) {
    const paid = await paidAgainstOpening(SupplierPayment, 'supplier', req.params.id);
    if (op[OP] < paid) throw new Error(`Opening payable cannot be less than ${paid}, which was already paid against it`);
    if (op[OP] > 0 && op.openingDate === undefined) { const s = await Supplier.findById(req.params.id); if (!s?.openingDate) op.openingDate = new Date(); }
  }
  res.json(await Supplier.findByIdAndUpdate(req.params.id, { ...pick(req.body, SF), ...op }, { new: true, runValidators: true }));
}));
router.delete('/suppliers/:id', wrap(async (req, res) => {
  if (await Purchase.exists({ supplier: req.params.id })) throw new Error('This supplier has purchases, so it cannot be deleted');
  if ((await Supplier.exists({ _id: req.params.id, [OP]: { $gt: 0 } })) || (await SupplierPayment.exists({ supplier: req.params.id }))) throw new Error('This supplier has an opening payable or payments, so it cannot be deleted');
  await Supplier.findByIdAndDelete(req.params.id); res.json({ ok: true });
}));
router.get('/suppliers', wrap(async (req, res) => res.json(await Supplier.find().sort('name'))));

// Per supplier: total purchase, paid, payable, oldest unpaid date
router.get('/supplier-summary', wrap(async (req, res) => {
  const [sups, purs, open] = await Promise.all([Supplier.find().sort('name'), Purchase.find().sort('date'), supplierOpening()]);
  const sum = (a, k) => r2(a.reduce((s, x) => s + x[k], 0));
  res.json(sups.map(s => {
    const ps = purs.filter(p => String(p.supplier) === String(s._id)), owing = ps.filter(p => p.due > 0);
    // Payable = unpaid purchases + the opening payable that is still unpaid (it is the oldest money)
    const o = open.get(String(s._id)), left = o ? o.left : 0;
    return { supplier: s, count: ps.length, total: sum(ps, 'total'), paid: sum(ps, 'paid'), due: r2(sum(ps, 'due') + left), opening: left,
      oldest: left > 0 ? (o.date || s.createdAt) : owing[0]?.date };
  }));
}));

// ---- Purchases ----
router.post('/purchases', wrap(async (req, res) => {
  const { supplier, date, items = [], paid, note } = req.body;
  if (!supplier || !(await Supplier.exists({ _id: supplier }))) throw new Error('Choose a supplier');
  if (!items.length) throw new Error('Add at least one item');
  const prods = await Product.find({ _id: { $in: items.map(i => i.product) } });
  const lines = items.map(i => {
    const p = prods.find(x => String(x._id) === String(i.product));
    if (!p) throw new Error('Choose a product for every row');
    if (p.isService) throw new Error(`${p.name} is a service and cannot be purchased`);
    const qty = num(i.qty), cost = num(i.cost);
    if (qty <= 0) throw new Error(`Enter a quantity for ${p.name}`);
    const pcs = num(i.pcs);
    if (pcs < 0) throw new Error(`PCS cannot be negative for ${p.name}`);
    return { product: p._id, name: p.label, unit: p.unit, qty, pcs, cost, total: r2(qty * cost) };
  });
  const total = r2(lines.reduce((s, l) => s + l.total, 0)), paidAmt = r2(num(paid));
  if (paidAmt < 0 || paidAmt > total) throw new Error('Paid amount must be between 0 and the total');
  const pur = await Purchase.create({ purchaseNo: await nextId('purchase', 'PUR-'), supplier, date: date ? new Date(date) : new Date(), items: lines, total, paid: 0, due: total, status: 'Due', note });
  for (const l of lines) {
    const prod = prods.find(x => String(x._id) === String(l.product));
    const q = prod.stock + l.qty, avg = q > 0 ? Math.round(((prod.stock * (prod.avgCost || 0) + l.total) / q) * 10000) / 10000 : l.cost;
    prod.stock = q; prod.avgCost = avg;
    await Product.updateOne({ _id: l.product }, { $inc: { stock: l.qty, pcs: l.pcs || 0 }, $set: { avgCost: avg } }); // pcs is a separate counter
    await StockMove.create({ product: l.product, type: 'purchase', qty: l.qty, ref: pur.purchaseNo, date: pur.date });
  }
  if (paidAmt > 0) await addPayment(pur, paidAmt, pur.date, req.body.method);
  res.json(await pur.populate('supplier'));
}));

router.get('/purchases', wrap(async (req, res) => {
  const { q = '', from, to, status } = req.query, f = {};
  if (q.trim()) {
    const rx = new RegExp(esc(q.trim()), 'i');
    const ids = await Supplier.find({ $or: [{ name: rx }, { phone: rx }] }).distinct('_id');
    f.$or = [{ purchaseNo: rx }, { supplier: { $in: ids } }];
  }
  if (from || to) f.date = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to + 'T23:59:59.999Z') }) };
  if (status) f.status = status;
  res.json(await Purchase.find(f).sort('-date -createdAt').limit(500).populate('supplier'));
}));

router.delete('/purchases/:id', wrap(async (req, res) => {
  const p = await Purchase.findById(req.params.id);
  if (!p) throw new Error('Purchase not found');
  for (const l of p.items) {
    const prod = await Product.findById(l.product);
    if (!prod || prod.stock < l.qty) throw new Error(`Cannot delete: ${l.name} stock was already used by sales`);
  }
  for (const l of p.items) await Product.updateOne({ _id: l.product }, { $inc: { stock: -l.qty, pcs: -(l.pcs || 0) } });
  await StockMove.deleteMany({ type: 'purchase', ref: p.purchaseNo });
  await SupplierPayment.deleteMany({ purchase: p._id });
  await p.deleteOne(); res.json({ ok: true });
}));

router.post('/purchases/:id/payments', wrap(async (req, res) => {
  const p = await Purchase.findById(req.params.id);
  if (!p) throw new Error('Purchase not found');
  await addPayment(p, req.body.amount, req.body.date, req.body.method); res.json(p);
}));

// Payment to a supplier: applied to the oldest unpaid purchases first
router.post('/suppliers/:id/pay', wrap(async (req, res) => {
  let amt = r2(num(req.body.amount));
  if (amt <= 0) throw new Error('Enter an amount greater than 0');
  const list = await Purchase.find({ supplier: req.params.id, due: { $gt: 0 } }).sort('date createdAt');
  const op = (await supplierOpening([req.params.id])).get(String(req.params.id)), openLeft = op ? op.left : 0;
  const totalDue = r2(openLeft + list.reduce((s, x) => s + x.due, 0));
  if (amt > totalDue) throw new Error(`Amount is more than the total payable (${totalDue})`);
  // The opening payable is the oldest money, so it is paid first. It has no purchase, so the payment has no purchase.
  if (openLeft > 0) {
    const a = Math.min(amt, openLeft);
    await SupplierPayment.create({ supplier: req.params.id, purchase: null, amount: a, method: req.body.method, date: req.body.date ? new Date(req.body.date) : new Date() });
    amt = r2(amt - a);
  }
  for (const p of list) {
    if (amt <= 0) break;
    const a = Math.min(amt, p.due); await addPayment(p, a, req.body.date, req.body.method); amt = r2(amt - a);
  }
  res.json({ ok: true });
}));

router.get('/stock-moves', wrap(async (req, res) =>
  res.json(await StockMove.find({ product: req.query.product }).sort('-date -createdAt').limit(300))));

module.exports = router;
