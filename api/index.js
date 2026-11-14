require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const { Client, Product, nextId } = require('../server/models');
const { Sale, StockMove } = require('../server/saleModels');
const { Purchase } = require('../server/purchaseModels');

const app = express();
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

// Cached connection (needed for Vercel serverless)
let conn;
app.use(async (req, res, next) => {
  try { conn = conn || mongoose.connect(process.env.MONGODB_URI).then(async c => { await Product.syncIndexes().catch(e => console.error('index sync:', e.message)); return c; }); await conn; next(); }
  catch (e) { conn = null; res.status(500).json({ error: 'Database connection failed' }); }
});

// ---- Simple single-admin login ----
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    res.cookie('auth', 'ok', { signed: true, httpOnly: true, sameSite: 'lax', secure: !!process.env.VERCEL, maxAge: 7 * 864e5 });
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Wrong username or password' });
});
app.post('/api/logout', (req, res) => { res.clearCookie('auth'); res.json({ ok: true }); });
app.get('/api/me', (req, res) => res.json({ loggedIn: req.signedCookies.auth === 'ok' }));

app.use('/api', (req, res, next) => req.signedCookies.auth === 'ok' ? next() : res.status(401).json({ error: 'Please log in' }));

// ---- Helpers ----
const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.code === 11000 ? 'This record already exists' : e.message }));
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- Clients ----
const CF = ['name', 'phone', 'address', 'note'];
app.get('/api/clients', wrap(async (req, res) => {
  const q = (req.query.q || '').trim(), rx = new RegExp(esc(q), 'i');
  res.json(await Client.find(q ? { $or: [{ name: rx }, { phone: rx }, { clientId: rx }] } : {}).sort('-createdAt').limit(300));
}));
app.post('/api/clients', wrap(async (req, res) =>
  res.json(await Client.create({ ...pick(req.body, CF), clientId: await nextId('client', 'C-') }))));
app.put('/api/clients/:id', wrap(async (req, res) =>
  res.json(await Client.findByIdAndUpdate(req.params.id, pick(req.body, CF), { new: true, runValidators: true }))));
app.delete('/api/clients/:id', wrap(async (req, res) => {
  if (await Sale.exists({ client: req.params.id })) throw new Error('This client has sales, so it cannot be deleted');
  await Client.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

// ---- Products & services ----
/* const PF = ['name', 'brand', 'thickness', 'color', 'size', 'unit', 'price', 'stock', 'openingCost', 'lowStock', 'isService']; */
const PF = ['name', 'brand', 'thickness', 'color', 'size', 'unit', 'price', 'stock', 'openingCost', 'lowStock', 'isService', 'isContract'];
app.get('/api/products', wrap(async (req, res) => {
  const q = (req.query.q || '').trim();
  res.json(await Product.find(q ? { $or: ['name', 'brand', 'color', 'size', 'thickness'].map(k => ({ [k]: new RegExp(esc(q), 'i') })) } : {}).sort('name'));
}));
app.post('/api/products', wrap(async (req, res) => {
  // Opening cost: per-unit, or a total that is divided by the opening quantity
  const st = Number(req.body.stock) || 0, tot = Number(req.body.openingTotal) || 0;
  const oc = Number(req.body.openingCost) || (st > 0 && tot > 0 ? Math.round((tot / st) * 10000) / 10000 : 0);
/*   const p = await Product.create({ ...pick(req.body, PF), openingCost: oc, avgCost: oc }); */
const p = await Product.create({ ...pick(req.body, PF), isService: !!(req.body.isService || req.body.isContract), openingCost: oc, avgCost: oc });
  if (p.stock > 0 && !p.isService) await StockMove.create({ product: p._id, type: 'opening', qty: p.stock, cost: oc, ref: 'Opening stock' });
  res.json(p);
}));
/* app.put('/api/products/:id', wrap(async (req, res) =>
  res.json(await Product.findByIdAndUpdate(req.params.id, pick(req.body, PF.filter(k => k !== 'stock')), { new: true, runValidators: true })))); */
app.put('/api/products/:id', wrap(async (req, res) => {
  const d = pick(req.body, PF.filter(k => k !== 'stock'));
  if (d.isContract) d.isService = true;
  res.json(await Product.findByIdAndUpdate(req.params.id, d, { new: true, runValidators: true }));
}));
app.delete('/api/products/:id', wrap(async (req, res) => {
  if ((await Sale.exists({ 'items.product': req.params.id })) || (await Purchase.exists({ 'items.product': req.params.id }))) throw new Error('This item is used in sales or purchases, so it cannot be deleted');
  await Product.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

app.use('/api', require('../server/sales'));
app.use('/api', require('../server/purchases'));
app.use('/api', require('../server/hr'));
app.use('/api', require('../server/reports'));
app.use('/api', require('../server/notify'));
app.use('/api', require('../server/orders'));

module.exports = app;
if (!process.env.VERCEL) app.listen(5000, () => console.log('API on http://localhost:5000'));
