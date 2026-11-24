// Sales returns (credit notes) and exchanges.
// A return never edits the invoice's items. It records what came back, puts it into stock (at the cost it left with),
// and settles the money: first against what the client still owes on that invoice, then cash back or an exchange.
const router = require('express').Router();
const { Product, nextId } = require('./models');
const { Sale, Payment, StockMove, SaleReturn } = require('./saleModels');
const sales = require('./sales');

const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));
const num = v => Number(v) || 0;
const r2 = n => Math.round(n * 100) / 100;

const settle = s => { s.due = r2(s.total - (s.returned || 0) - (s.waived || 0) - s.paid); s.status = s.due <= 0 ? 'Paid' : s.paid > 0 ? 'Partial' : 'Due'; };

// For each line of the invoice: how much was sold, how much has already come back, how much can still be returned
async function returnable(sale) {
  const prior = await SaleReturn.find({ sale: sale._id });
  const qty = {}, pcs = {}, amt = {};
  for (const r of prior) for (const l of r.items) {
    qty[l.index] = r2((qty[l.index] || 0) + l.qty); pcs[l.index] = r2((pcs[l.index] || 0) + (l.pcs || 0)); amt[l.index] = r2((amt[l.index] || 0) + l.total);
  }
  return sale.items.map((it, index) => ({
    index, name: it.name, brand: it.brand, size: it.size, thickness: it.thickness, color: it.color, grade: it.grade, unit: it.unit,
    isService: !!it.isService, sold: it.qty, soldPcs: it.pcs || 0, total: it.total,
    returned: qty[index] || 0, returnedPcs: pcs[index] || 0, returnedAmount: amt[index] || 0,
    remaining: r2(it.qty - (qty[index] || 0)), remainingPcs: r2((it.pcs || 0) - (pcs[index] || 0)),
    unitNet: it.qty ? r2(it.total / it.qty) : 0, // price per unit after the line's discount
  }));
}

router.get('/sales/:id/returnable', wrap(async (req, res) => {
  const s = await Sale.findById(req.params.id);
  if (!s) throw new Error('Sale not found');
  res.json({ due: s.due, paid: s.paid, total: s.total, returned: s.returned || 0, lines: await returnable(s) });
}));
router.get('/sales/:id/returns', wrap(async (req, res) =>
  res.json(await SaleReturn.find({ sale: req.params.id }).sort('date createdAt').populate('exchangeSale', 'invoiceNo total'))));

router.post('/sales/:id/returns', wrap(async (req, res) => {
  const s = await Sale.findById(req.params.id);
  if (!s) throw new Error('Sale not found');
  if (s.saleType === 'service') throw new Error('Return is not available for Service Sale');
  if (s.waived > 0) throw new Error(`${s.invoiceNo} has a Moukuf (waived due). Undo the Moukuf first, then make the return.`);
  const rows = await returnable(s);
  const b = req.body || {};
  const input = (b.items || []).filter(i => num(i.qty) > 0 || num(i.pcs) > 0);
  if (!input.length) throw new Error('Enter the quantity that is coming back');

  // 1) Check every line and work out its value. Nothing is saved yet.
  const lines = input.map(i => {
    const row = rows[Number(i.index)], it = s.items[Number(i.index)];
    if (!row || !it) throw new Error('A returned line does not belong to this invoice');
    const qty = num(i.qty), pcs = num(i.pcs);
    if (qty <= 0) throw new Error(`Enter a quantity for ${row.name}`);
    if (pcs < 0) throw new Error(`PCS cannot be negative for ${row.name}`);
    if (qty > row.remaining + 1e-9) throw new Error(`${row.name}: only ${row.remaining} ${row.unit || ''} can still be returned`);
    if (row.soldPcs > 0 && pcs > row.remainingPcs + 1e-9) throw new Error(`${row.name}: only ${row.remainingPcs} pcs can still be returned`);
    // The last part of a line gets whatever value is left, so rounding never makes the returns add up to more than the line
    const total = Math.abs(qty - row.remaining) < 1e-9 ? r2(it.total - row.returnedAmount) : r2((qty * it.total) / it.qty);
    return { index: row.index, product: it.product, name: it.name, unit: it.unit, brand: it.brand, thickness: it.thickness, color: it.color, size: it.size, grade: it.grade,
      qty, pcs, price: row.unitNet, total, restock: !it.isService && i.restock !== false, unitCost: it.unitCost || 0, isService: !!it.isService };
  });
  if (new Set(lines.map(l => l.index)).size !== lines.length) throw new Error('A line is listed twice');
  const R = r2(lines.reduce((t, l) => t + l.total, 0));
  const fromDue = r2(Math.min(R, Math.max(0, s.due))), excess = r2(R - fromDue); // excess = money the client had already paid for these goods
  const date = b.date ? new Date(b.date) : new Date();
  if (isNaN(date)) throw new Error('The return date is not valid');
  const returnNo = await nextId('return', 'RET-');

  const undo = [];
  const rollback = async () => { for (const f of undo.reverse()) { try { await f(); } catch (e) { console.error('return rollback:', e.message); } } };
  try {
    // 2) Exchange: make the new invoice first. If it cannot be made (for example not enough stock), nothing has changed yet.
    let ex = null;
    if (b.exchange && (b.exchange.items || []).length) {
      const x = b.exchange;
      ex = await sales.createSale({ saleType: 'product', client: s.client, date, items: x.items, paid: x.paid, method: x.method, salesPerson: x.salesPerson || s.salesPerson,
        orderNo: x.orderNo, ledgerNo: x.ledgerNo, note: `Exchange for ${returnNo}${x.note ? ' · ' + x.note : ''}` });
      undo.push(() => sales.removeSale(ex._id));
    }
    const credit = ex ? r2(Math.min(excess, ex.due)) : 0;
    const refund = r2(excess - credit);

    // 3) The return itself
    const ret = await SaleReturn.create({ returnNo, sale: s._id, client: s.client, date, items: lines, total: R, fromDue, credit, refunded: refund,
      refundMethod: refund > 0 ? (b.refundMethod || 'Cash') : undefined, exchangeSale: ex ? ex._id : undefined, note: b.note });
    undo.push(() => ret.deleteOne());

    // 4) Goods back into stock, at the cost they left with. PCS go back to the PCS counter too.
    for (const l of lines) if (l.restock) {
      await Product.updateOne({ _id: l.product }, { $inc: { stock: l.qty, pcs: l.pcs || 0 } });
      undo.push(() => Product.updateOne({ _id: l.product }, { $inc: { stock: -l.qty, pcs: -(l.pcs || 0) } }));
      const mv = await StockMove.create({ product: l.product, type: 'return', qty: l.qty, cost: l.unitCost, ref: returnNo, date });
      undo.push(() => StockMove.deleteMany({ _id: mv._id }));
    }

    // 5) The invoice: returned amount goes up, and any money paid for these goods is handed back (cash or exchange credit)
    const before = { returned: s.returned || 0, paid: s.paid, due: s.due, status: s.status };
    undo.push(async () => { Object.assign(s, before); await s.save(); });
    s.returned = r2((s.returned || 0) + R);
    s.paid = r2(s.paid - excess);
    settle(s);
    await s.save();
    const pay = async (sale, amount, method, kind) => {
      const p = await Payment.create({ client: s.client, sale: sale._id, amount, method, kind, ret: ret._id, date });
      undo.push(() => Payment.deleteMany({ _id: p._id }));
    };
    if (credit > 0) {
      await pay(s, -credit, 'Exchange credit', 'credit');
      await pay(ex, credit, 'Exchange credit', 'credit');
      const exBefore = { paid: ex.paid, due: ex.due, status: ex.status };
      undo.push(async () => { Object.assign(ex, exBefore); await ex.save(); });
      ex.paid = r2(ex.paid + credit); ex.due = r2(ex.total - (ex.returned || 0) - (ex.waived || 0) - ex.paid); ex.status = ex.due <= 0 ? 'Paid' : ex.paid > 0 ? 'Partial' : 'Due';
      await ex.save();
    }
    if (refund > 0) await pay(s, -refund, b.refundMethod || 'Cash', 'refund');

    const out = await SaleReturn.findById(ret._id).populate('exchangeSale', 'invoiceNo total');
    res.json(out);
  } catch (e) { await rollback(); throw e; }
}));

// Undo a return: stock leaves again, the invoice goes back to how it was, and an exchange invoice made by it is removed
router.delete('/returns/:id', wrap(async (req, res) => {
  const ret = await SaleReturn.findById(req.params.id);
  if (!ret) throw new Error('Return not found');
  const s = await Sale.findById(ret.sale);
  for (const l of ret.items) if (l.restock) {
    const p = await Product.findById(l.product);
    if (!p || p.stock < l.qty) throw new Error(`${l.name} is no longer in stock (${p ? p.stock : 0} left), so this return cannot be undone`);
  }
  if (ret.exchangeSale) {
    if (await SaleReturn.exists({ sale: ret.exchangeSale })) throw new Error('The exchange invoice has returns of its own. Delete those first.');
    const exId = ret.exchangeSale;
    ret.exchangeSale = undefined; await ret.save();
    await sales.removeSale(exId);
  }
  const moved = await Payment.find({ ret: ret._id, sale: ret.sale });
  const back = r2(moved.reduce((t, p) => t + p.amount, 0)); // negative: money that was paid back
  await Payment.deleteMany({ ret: ret._id });
  if (s) { s.paid = r2(s.paid - back); s.returned = r2(Math.max(0, (s.returned || 0) - ret.total)); settle(s); await s.save(); }
  for (const l of ret.items) if (l.restock) await Product.updateOne({ _id: l.product }, { $inc: { stock: -l.qty, pcs: -(l.pcs || 0) } });
  await StockMove.deleteMany({ type: 'return', ref: ret.returnNo });
  await ret.deleteOne();
  res.json({ ok: true });
}));

module.exports = router;
