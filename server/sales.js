const router = require('express').Router();
const { Client, Product, nextId } = require('./models');
const { Sale, Payment, StockMove } = require('./saleModels');

const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));
const num = v => Number(v) || 0;
const r2 = n => Math.round(n * 100) / 100;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function addPayment(sale, amount, date, method) {
  amount = r2(num(amount));
  if (amount <= 0) throw new Error('Enter an amount greater than 0');
  if (amount > sale.due) throw new Error(`Amount is more than the due (${sale.due}) on ${sale.invoiceNo}`);
  await Payment.create({ client: sale.client, sale: sale._id, amount, method, date: date ? new Date(date) : new Date() });
  sale.paid = r2(sale.paid + amount); sale.due = r2(sale.total - sale.paid);
  sale.status = sale.due <= 0 ? 'Paid' : 'Partial';
  await sale.save();
}

router.post('/sales', wrap(async (req, res) => {
  const { client, date, items = [], paid, note, salesPerson, orderNo, ledgerNo } = req.body;
  if (!client || !(await Client.exists({ _id: client }))) throw new Error('Choose a client');
  if (!items.length) throw new Error('Add at least one item');
  const prods = await Product.find({ _id: { $in: items.map(i => i.product) } });
  const lines = items.map(i => {
    const p = prods.find(x => String(x._id) === String(i.product));
    if (!p) throw new Error('Choose a product for every row');
    const qty = num(i.qty), price = num(i.price), discount = num(i.discount), total = r2(qty * price - discount);
    if (qty <= 0) throw new Error(`Enter a quantity for ${p.name}`);
    if (total < 0) throw new Error(`Discount is more than the amount for ${p.name}`);
    return { product: p._id, name: p.name, brand: p.brand, thickness: p.thickness, color: p.color, size: p.size, unit: p.unit, qty, price, discount, total, unitCost: p.isService ? 0 : (p.avgCost || 0), isService: p.isService, isContract: p.isContract };
  });
  const need = {};
  lines.filter(l => !l.isService).forEach(l => { need[l.product] = (need[l.product] || 0) + l.qty; });
  for (const id in need) {
    const p = prods.find(x => String(x._id) === id);
    if (p.stock < need[id]) throw new Error(`Not enough stock for ${p.name}: ${p.stock} ${p.unit} left`);
  }
  const total = r2(lines.reduce((s, l) => s + l.total, 0)), paidAmt = r2(num(paid));
  if (paidAmt < 0 || paidAmt > total) throw new Error('Paid amount must be between 0 and the total');
  const sale = await Sale.create({ invoiceNo: await nextId('invoice', 'INV-'), client, date: date ? new Date(date) : new Date(), items: lines, total, paid: 0, due: total, status: 'Due', note, salesPerson, orderNo, ledgerNo, paidAtSale: paidAmt });
  for (const id in need) {
    await Product.updateOne({ _id: id }, { $inc: { stock: -need[id] } });
    await StockMove.create({ product: id, type: 'sale', qty: -need[id], ref: sale.invoiceNo, date: sale.date });
  }
  if (paidAmt > 0) await addPayment(sale, paidAmt, sale.date, req.body.method);
  res.json(await sale.populate('client'));
}));

router.get('/sales', wrap(async (req, res) => {
  const { q = '', from, to, status } = req.query, f = {};
  if (q.trim()) {
    const rx = new RegExp(esc(q.trim()), 'i');
    const ids = await Client.find({ $or: [{ name: rx }, { phone: rx }, { clientId: rx }] }).distinct('_id');
    f.$or = [{ invoiceNo: rx }, { orderNo: rx }, { ledgerNo: rx }, { client: { $in: ids } }];
  }
  if (from || to) f.date = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to + 'T23:59:59.999Z') }) };
  if (status) f.status = status;
  res.json(await Sale.find(f).sort('-date -createdAt').limit(500).populate('client'));
}));

router.delete('/sales/:id', wrap(async (req, res) => {
  const s = await Sale.findById(req.params.id);
  if (!s) throw new Error('Sale not found');
  for (const l of s.items) if (!l.isService) await Product.updateOne({ _id: l.product }, { $inc: { stock: l.qty } });
  await StockMove.deleteMany({ type: 'sale', ref: s.invoiceNo });

    for (const m of s.materials || []) await Product.updateOne({ _id: m.product }, { $inc: { stock: m.qty } });
  await StockMove.deleteMany({ type: 'contract', ref: s.invoiceNo });

  await Payment.deleteMany({ sale: s._id });
  await s.deleteOne();
  res.json({ ok: true });
}));

router.post('/sales/:id/payments', wrap(async (req, res) => {
  const s = await Sale.findById(req.params.id);
  if (!s) throw new Error('Sale not found');
  await addPayment(s, req.body.amount, req.body.date, req.body.method);
  res.json(s);
}));

// Payment from a client: applied to the oldest unpaid invoices first
router.post('/clients/:id/pay', wrap(async (req, res) => {
  let amt = r2(num(req.body.amount));
  if (amt <= 0) throw new Error('Enter an amount greater than 0');
  const sales = await Sale.find({ client: req.params.id, due: { $gt: 0 } }).sort('date createdAt');
  const totalDue = r2(sales.reduce((s, x) => s + x.due, 0));
  if (amt > totalDue) throw new Error(`Amount is more than the client's total due (${totalDue})`);
  for (const s of sales) {
    if (amt <= 0) break;
    const a = Math.min(amt, s.due);
    await addPayment(s, a, req.body.date, req.body.method);
    amt = r2(amt - a);
  }
  res.json({ ok: true });
}));

router.get('/dues', wrap(async (req, res) => {
  const sales = await Sale.find({ due: { $gt: 0 } }).sort('date').populate('client');
  const map = {};
  for (const s of sales) {
    const k = String(s.client._id);
    map[k] = map[k] || { client: s.client, due: 0, oldest: s.date, invoices: 0 };
    map[k].due = r2(map[k].due + s.due); map[k].invoices++;
  }
  res.json(Object.values(map).sort((a, b) => b.due - a.due));
}));

router.get('/clients/:id/statement', wrap(async (req, res) => {
  const [client, sales, payments] = await Promise.all([
    Client.findById(req.params.id), Sale.find({ client: req.params.id }).sort('date createdAt'),
    Payment.find({ client: req.params.id }).sort('date createdAt').populate('sale', 'invoiceNo'),
  ]);
  res.json({ client, sales, payments });
}));

// Client's balance before this invoice was made (earlier invoices minus earlier payments)
router.get('/sales/:id/prev-balance', wrap(async (req, res) => {
  const s = await Sale.findById(req.params.id);
  if (!s) throw new Error('Sale not found');
  const [sales, pays] = await Promise.all([
    Sale.find({ client: s.client, createdAt: { $lt: s.createdAt } }), Payment.find({ client: s.client, createdAt: { $lt: s.createdAt } })]);
  const by = {};
  (await Payment.find({ sale: s._id })).forEach(x => { const k = x.method || 'Received'; by[k] = r2((by[k] || 0) + x.amount); });
  res.json({ prev: r2(sales.reduce((t, x) => t + x.total, 0) - pays.reduce((t, x) => t + x.amount, 0)), pays: Object.entries(by).map(([method, amount]) => ({ method, amount })) });
}));

// Materials used for a contract invoice: they reduce stock only. The invoice amount does not change.
router.post('/sales/:id/materials', wrap(async (req, res) => {
  const s = await Sale.findById(req.params.id);
  if (!s) throw new Error('Sale not found');
  if (!s.items.some(l => l.isContract)) throw new Error('This invoice has no contract item');
  const q = num(req.body.qty);
  if (q <= 0) throw new Error('Enter a quantity');
  const p = await Product.findById(req.body.product);
  if (!p || p.isService) throw new Error('Choose a stock product');
  if (p.stock < q) throw new Error(`Not enough stock for ${p.label}: ${p.stock} ${p.unit} left`);
  await Product.updateOne({ _id: p._id }, { $inc: { stock: -q } });
  await StockMove.create({ product: p._id, type: 'contract', qty: -q, ref: s.invoiceNo, date: new Date() });
  s.materials.push({ product: p._id, name: p.label, unit: p.unit, qty: q, price: p.price, cost: p.avgCost || 0 });
  await s.save();
  res.json(s);
}));

router.delete('/sales/:id/materials/:mid', wrap(async (req, res) => {
  const s = await Sale.findById(req.params.id);
  if (!s) throw new Error('Sale not found');
  const m = s.materials.id(req.params.mid);
  if (!m) throw new Error('Material line not found');
  await Product.updateOne({ _id: m.product }, { $inc: { stock: m.qty } });
  await StockMove.create({ product: m.product, type: 'contract', qty: m.qty, ref: s.invoiceNo, date: new Date() });
  s.materials.pull(req.params.mid);
  await s.save();
  res.json(s);
}));

module.exports = router;
