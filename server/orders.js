const router = require('express').Router();
const { nextId } = require('./models');
const { Order } = require('./orderModels');

const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SPEC = ['brand', 'grade', 'thickness', 'product', 'color', 'size', 'productId'];
const pick = (o, ks) => Object.fromEntries(ks.filter(k => o[k] !== undefined).map(k => [k, o[k]]));

const clean = b => {
  const o = pick(b, ['client', 'clientName', 'phone', 'siteAddress', 'date', 'status', 'note']);
  o.client = o.client || null;
  if (!o.date) delete o.date;
  if (!(o.clientName || '').trim()) throw new Error('Enter the client name');
  o.items = (b.items || []).filter(i => (i.service || '').trim()).map(i => ({
    service: i.service.trim(), qty: Number(i.qty) || 0,
    specs: (i.specs || []).filter(s => SPEC.some(k => String(s[k] || '').trim()))
      .map(s => Object.fromEntries(SPEC.map(k => [k, String(s[k] || '').trim()]))),
  }));
  if (!o.items.length) throw new Error('Add at least one service');
  return o;
};

router.get('/orders', wrap(async (req, res) => {
  const { q = '', status } = req.query, f = {};
  if (q.trim()) { const rx = new RegExp(esc(q.trim()), 'i'); f.$or = [{ orderNo: rx }, { clientName: rx }, { phone: rx }, { siteAddress: rx }]; }
  if (status) f.status = status;
  res.json(await Order.find(f).sort('-createdAt').limit(300));
}));
router.post('/orders', wrap(async (req, res) => res.json(await Order.create({ ...clean(req.body), orderNo: await nextId('order', 'ORD-') }))));
router.put('/orders/:id', wrap(async (req, res) => res.json(await Order.findByIdAndUpdate(req.params.id, clean(req.body), { new: true, runValidators: true }))));
router.delete('/orders/:id', wrap(async (req, res) => { await Order.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

module.exports = router;