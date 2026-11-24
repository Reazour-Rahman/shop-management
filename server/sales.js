const router = require('express').Router();
const { Client, Product, nextId } = require('./models');
const { Sale, Payment, StockMove, Option, SaleReturn } = require('./saleModels');
const { serviceLine } = require('./serviceLib');
const { clientOpening } = require('./opening');

const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));
const num = v => Number(v) || 0;
const r2 = n => Math.round(n * 100) / 100;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const text = v => String(v ?? '').trim();
const blank = v => v === undefined || v === null || String(v).trim() === '';

async function addPayment(sale, amount, date, method) {
  amount = r2(num(amount));
  if (amount <= 0) throw new Error('Enter an amount greater than 0');
  if (amount > sale.due) throw new Error(`Amount is more than the due (${sale.due}) on ${sale.invoiceNo}`);
  await Payment.create({ client: sale.client, sale: sale._id, amount, method, date: date ? new Date(date) : new Date() });
  sale.paid = r2(sale.paid + amount); sale.due = r2(sale.total - (sale.returned || 0) - (sale.waived || 0) - sale.paid);
  sale.status = sale.due <= 0 ? 'Paid' : 'Partial';
  await sale.save();
}

// Product Sale line: Brand, Size, Thick, Grade, Color etc. come from the product and can be changed on the form
function productLine(i, p) {
  const pick = (k, fallback) => (i[k] !== undefined ? text(i[k]) : fallback || '');
  const qty = num(i.qty), price = num(i.price), discount = num(i.discount), total = r2(qty * price - discount);
  if (qty <= 0) throw new Error(`Enter a quantity for ${p.name}`);
  if (total < 0) throw new Error(`Discount is more than the amount for ${p.name}`);
  const opt = k => (blank(i[k]) ? null : num(i[k]));
  return {
    product: p._id, name: p.name, brand: pick('brand', p.brand), thickness: pick('thickness', p.thickness), color: pick('color', p.color),
    size: pick('size', p.size), grade: pick('grade', p.grade), lth: opt('lth'), wth: opt('wth'), pcs: opt('pcs'),
    unit: p.unit, qty, price, discount, total, unitCost: p.isService ? 0 : (p.avgCost || 0), isService: p.isService, isContract: p.isContract,
  };
}

// Product Listing line (Service Sale): the stock that the job uses. Internal only, never printed for the customer.
function listingLine(m, p) {
  const qty = num(m.qty);
  if (!p || p.isService) throw new Error('Choose a stock product in the Product Listing');
  if (qty <= 0) throw new Error(`Enter a quantity for ${p.label} in the Product Listing`);
  const pcs = num(m.pcs);
  if (pcs < 0) throw new Error(`PCS cannot be negative for ${p.label}`);
  return { product: p._id, name: p.label, unit: p.unit, brand: p.brand, size: p.size, thickness: p.thickness, color: p.color, grade: p.grade, pcs, qty, price: p.price, cost: p.avgCost || 0 };
}

const sumBy = (rows, skip) => {
  const m = {};
  rows.filter(r => !skip(r)).forEach(r => { m[r.product] = r2((m[r.product] || 0) + r.qty); });
  return m;
};

// Creates one invoice (Product Sale or Service Sale), takes the stock and records the payment made now. Returns the saved sale.
async function createSale(body) {
  const { client, date, items = [], paid, note, salesPerson, orderNo, ledgerNo, materials = [] } = body;
  const saleType = body.saleType === 'service' ? 'service' : 'product';
  if (!client || !(await Client.exists({ _id: client }))) throw new Error('Choose a client');
  if (!items.length) throw new Error('Add at least one item');
  if (saleType === 'product' && materials.length) throw new Error('A Product Listing belongs to a Service Sale only');

  const ids = [...(saleType === 'product' ? items.map(i => i.product) : []), ...materials.map(m => m.product)].filter(Boolean);
  const prods = await Product.find({ _id: { $in: ids } });
  const find = id => prods.find(x => String(x._id) === String(id));

  let lines;
  if (saleType === 'service') lines = items.map(serviceLine);
  else lines = items.map(i => { const p = find(i.product); if (!p) throw new Error('Choose a product for every row'); return productLine(i, p); });
  const listing = materials.map(m => listingLine(m, find(m.product)));

  // Stock is taken once: Product Sale lines use stock directly, Service Sale lines never do (they are services).
  // A Service Sale takes stock only through its Product Listing.
  const need = sumBy(lines, l => l.isService), listNeed = sumBy(listing, () => false);
  for (const id of new Set([...Object.keys(need), ...Object.keys(listNeed)])) {
    const p = find(id), want = r2((need[id] || 0) + (listNeed[id] || 0));
    if (p.stock < want) throw new Error(`Not enough stock for ${p.label}: ${p.stock} ${p.unit} left`);
  }
  const total = r2(lines.reduce((s, l) => s + l.total, 0)), paidAmt = r2(num(paid));
  if (paidAmt < 0 || paidAmt > total) throw new Error('Paid amount must be between 0 and the total');

  const sale = await Sale.create({ invoiceNo: await nextId('invoice', 'INV-'), saleType, client, date: date ? new Date(date) : new Date(), items: lines, materials: listing, total, paid: 0, due: total, status: 'Due', note, salesPerson, orderNo, ledgerNo, paidAtSale: paidAmt });
  const taken = [];
  try {
    for (const [moves, type] of [[need, 'sale'], [listNeed, 'contract']]) for (const id in moves) {
      await Product.updateOne({ _id: id }, { $inc: { stock: -moves[id] } });
      taken.push([id, moves[id], 0]);
      await StockMove.create({ product: id, type, qty: -moves[id], ref: sale.invoiceNo, date: sale.date });
    }
    // PCS typed on a Product Sale row comes off the product's own PCS counter (no stock move, no effect on any amount)
    for (const l of listing) if (l.pcs > 0) { // Product Listing PCS also comes off the PCS counter
      await Product.updateOne({ _id: l.product }, { $inc: { pcs: -l.pcs } });
      taken.push([l.product, 0, l.pcs]);
    }
    for (const l of lines) if (!l.isService && l.pcs > 0) {
      await Product.updateOne({ _id: l.product }, { $inc: { pcs: -l.pcs } });
      taken.push([l.product, 0, l.pcs]);
    }
    if (paidAmt > 0) await addPayment(sale, paidAmt, sale.date, body.method);
  } catch (e) { // put everything back so a failed save never leaves a half-made invoice
    for (const [id, q, pc] of taken) await Product.updateOne({ _id: id }, { $inc: { stock: q, pcs: pc || 0 } });
    await StockMove.deleteMany({ ref: sale.invoiceNo, type: { $in: ['sale', 'contract'] } });
    await Payment.deleteMany({ sale: sale._id });
    await sale.deleteOne();
    throw e;
  }
  return sale.populate('client');
}
router.post('/sales', wrap(async (req, res) => res.json(await createSale(req.body))));

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

// Removes one invoice and puts its stock back. An invoice with returns, or one made by an exchange, is protected.
async function removeSale(id) {
  const s = await Sale.findById(id);
  if (!s) throw new Error('Sale not found');
  if (await SaleReturn.exists({ sale: s._id })) throw new Error(`${s.invoiceNo} has returns. Delete the returns first.`);
  if (await SaleReturn.exists({ exchangeSale: s._id })) throw new Error(`${s.invoiceNo} was made by an exchange. Delete that return first.`);
  for (const l of s.items) if (!l.isService) await Product.updateOne({ _id: l.product }, { $inc: { stock: l.qty, pcs: l.pcs || 0 } });
  await StockMove.deleteMany({ type: 'sale', ref: s.invoiceNo });
  for (const m of s.materials || []) await Product.updateOne({ _id: m.product }, { $inc: { stock: m.qty, pcs: m.pcs || 0 } });
  await StockMove.deleteMany({ type: 'contract', ref: s.invoiceNo });
  await Payment.deleteMany({ sale: s._id });
  await s.deleteOne();
}
router.delete('/sales/:id', wrap(async (req, res) => { await removeSale(req.params.id); res.json({ ok: true }); }));
// Moukuf: the shop gives up (part of) what the client still owes on this invoice. No money moves.
// The invoice's due goes down, the client's due list and statement follow, and the Income Statement shows it as "Dues waived".
router.post('/sales/:id/waive', wrap(async (req, res) => {
  const s = await Sale.findById(req.params.id);
  if (!s) throw new Error('Sale not found');
  if (req.body.confirm !== true) throw new Error('Please confirm the Moukuf first');
  const amount = blank(req.body.amount) ? s.due : r2(num(req.body.amount));
  if (!(amount > 0)) throw new Error('This invoice has no due to waive');
  if (amount > s.due + 1e-9) throw new Error(`Amount is more than the due (${s.due}) on ${s.invoiceNo}`);
  s.waived = r2((s.waived || 0) + amount);
  s.waivedAt = req.body.date ? new Date(req.body.date) : new Date();
  s.waivedNote = text(req.body.note);
  s.due = r2(s.total - (s.returned || 0) - s.waived - s.paid);
  s.status = s.due <= 0 ? 'Paid' : s.paid > 0 ? 'Partial' : 'Due';
  await s.save();
  res.json(s);
}));
// Undo a Moukuf done by mistake: the whole waived amount comes back as due
router.delete('/sales/:id/waive', wrap(async (req, res) => {
  const s = await Sale.findById(req.params.id);
  if (!s) throw new Error('Sale not found');
  if (!(s.waived > 0)) throw new Error('This invoice has no Moukuf');
  s.waived = 0; s.waivedAt = undefined; s.waivedNote = undefined;
  s.due = r2(s.total - (s.returned || 0) - s.paid);
  s.status = s.due <= 0 ? 'Paid' : s.paid > 0 ? 'Partial' : 'Due';
  await s.save();
  res.json(s);
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
  const op = (await clientOpening([req.params.id])).get(String(req.params.id)), openLeft = op ? op.left : 0;
  const totalDue = r2(openLeft + sales.reduce((s, x) => s + x.due, 0));
  if (amt > totalDue) throw new Error(`Amount is more than the client's total due (${totalDue})`);
  // The opening due is the oldest money, so it is paid first. It has no invoice, so the payment has no sale.
  if (openLeft > 0) {
    const a = Math.min(amt, openLeft);
    await Payment.create({ client: req.params.id, sale: null, amount: a, method: req.body.method, date: req.body.date ? new Date(req.body.date) : new Date() });
    amt = r2(amt - a);
  }
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
    map[k] = map[k] || { client: s.client, due: 0, oldest: s.date, invoices: 0, opening: 0 };
    map[k].due = r2(map[k].due + s.due); map[k].invoices++;
  }
  // Clients with an opening due (money owed before this system started), even if they have no invoice yet
  for (const [k, o] of await clientOpening()) {
    if (o.left <= 0) continue;
    const when = o.date || o.owner.createdAt;
    map[k] = map[k] || { client: o.owner, due: 0, oldest: when, invoices: 0, opening: 0 };
    map[k].due = r2(map[k].due + o.left); map[k].opening = o.left;
    if (new Date(when) < new Date(map[k].oldest)) map[k].oldest = when;
  }
  res.json(Object.values(map).sort((a, b) => b.due - a.due));
}));

router.get('/clients/:id/statement', wrap(async (req, res) => {
  const [client, sales, payments] = await Promise.all([
    Client.findById(req.params.id), Sale.find({ client: req.params.id }).sort('date createdAt'),
    Payment.find({ client: req.params.id }).sort('date createdAt').populate('sale', 'invoiceNo'),
  ]);
  const o = (await clientOpening([req.params.id])).get(String(req.params.id));
  const opening = client && client.openingDue > 0 ? { amount: client.openingDue, date: client.openingDate || client.createdAt } : null;
  const returns = await SaleReturn.find({ client: req.params.id }).sort('date createdAt');
  res.json({ client, sales, payments, opening, openingLeft: o ? o.left : 0, returns });
}));

// Client's balance before this invoice was made (earlier invoices minus earlier payments)
router.get('/sales/:id/prev-balance', wrap(async (req, res) => {
  const s = await Sale.findById(req.params.id);
  if (!s) throw new Error('Sale not found');
  const [sales, pays, client, rets] = await Promise.all([
    Sale.find({ client: s.client, createdAt: { $lt: s.createdAt } }), Payment.find({ client: s.client, createdAt: { $lt: s.createdAt } }), Client.findById(s.client),
    SaleReturn.find({ client: s.client, createdAt: { $lt: s.createdAt } })]);
  const by = {};
  // Only real receipts are listed by method. Refunds and exchange adjustments are shown as the invoice's returned amount instead.
  (await Payment.find({ sale: s._id })).filter(x => (x.kind || 'payment') === 'payment').forEach(x => { const k = x.method || 'Received'; by[k] = r2((by[k] || 0) + x.amount); });
  // The client's opening due counts as an earlier balance, together with earlier invoices, less everything paid before this invoice
  const refunded = r2((await Payment.find({ sale: s._id, kind: { $in: ['refund', 'credit'] } })).reduce((t, x) => t - x.amount, 0));
  const waivedBefore = sales.filter(x => x.waived > 0 && x.waivedAt && new Date(x.waivedAt) < s.createdAt).reduce((t, x) => t + x.waived, 0); // Moukuf given before this invoice
  res.json({ prev: r2((client?.openingDue || 0) + sales.reduce((t, x) => t + x.total, 0) - rets.reduce((t, x) => t + x.total, 0) - pays.reduce((t, x) => t + x.amount, 0) - waivedBefore), waived: s.waived || 0, pays: Object.entries(by).map(([method, amount]) => ({ method, amount })), returned: s.returned || 0, refunded });
}));

// Materials used for a contract invoice: they reduce stock only. The invoice amount does not change.
router.post('/sales/:id/materials', wrap(async (req, res) => {
  const s = await Sale.findById(req.params.id);
  if (!s) throw new Error('Sale not found');
  if (s.saleType !== 'service' && !s.items.some(l => l.isContract)) throw new Error('This invoice has no contract or service item');
  const q = num(req.body.qty);
  if (q <= 0) throw new Error('Enter a quantity');
  const p = await Product.findById(req.body.product);
  if (!p || p.isService) throw new Error('Choose a stock product');
  if (p.stock < q) throw new Error(`Not enough stock for ${p.label}: ${p.stock} ${p.unit} left`);
  const line = listingLine({ qty: q, pcs: req.body.pcs }, p);
  await Product.updateOne({ _id: p._id }, { $inc: { stock: -q, pcs: -line.pcs } });
  await StockMove.create({ product: p._id, type: 'contract', qty: -q, ref: s.invoiceNo, date: new Date() });
  s.materials.push(line);
  await s.save();
  res.json(s);
}));

router.delete('/sales/:id/materials/:mid', wrap(async (req, res) => {
  const s = await Sale.findById(req.params.id);
  if (!s) throw new Error('Sale not found');
  const m = s.materials.id(req.params.mid);
  if (!m) throw new Error('Material line not found');
  await Product.updateOne({ _id: m.product }, { $inc: { stock: m.qty, pcs: m.pcs || 0 } });
  await StockMove.create({ product: m.product, type: 'contract', qty: m.qty, ref: s.invoiceNo, date: new Date() });
  s.materials.pull(req.params.mid);
  await s.save();
  res.json(s);
}));

// Dropdown values for the Service Sale form: the operator's own additions plus what the Products list already has
const KINDS = ['brand', 'size', 'color', 'service'];
const uniq = list => {
  const seen = new Set(), out = [];
  for (const v of list.map(text).filter(Boolean)) if (!seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); }
  return out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
};
router.get('/options', wrap(async (req, res) => {
  const kind = req.query.kind;
  if (!KINDS.includes(kind)) throw new Error('Unknown option type');
  const saved = (await Option.find({ kind })).map(o => o.value);
  const fromProducts = kind === 'service'
    ? await Product.distinct('name', { $or: [{ isService: true }, { isContract: true }] })
    : await Product.distinct(kind);
  res.json(uniq([...saved, ...fromProducts]));
}));
router.post('/options', wrap(async (req, res) => {
  const kind = req.body.kind, value = text(req.body.value);
  if (!KINDS.includes(kind)) throw new Error('Unknown option type');
  if (!value) throw new Error('Type a value first');
  if (value.length > 60) throw new Error('That value is too long');
  const old = await Option.findOne({ kind, value: new RegExp('^' + esc(value) + '$', 'i') });
  res.json(old || await Option.create({ kind, value }));
}));

module.exports = router;
module.exports.createSale = createSale;
module.exports.removeSale = removeSale;
module.exports.productLine = productLine;
