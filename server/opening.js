// Opening due (clients) and opening payable (suppliers): money that was already owed before this system started.
// It is NOT a sale or a purchase, so it never appears in the income statement. Money received or paid against it
// is stored as a Payment / SupplierPayment with no invoice (sale / purchase = null), so cash flow counts it.
const mongoose = require('mongoose');
const { Client } = require('./models');
const { Payment } = require('./saleModels');
const { Supplier, SupplierPayment } = require('./purchaseModels');

const r2 = n => Math.round(n * 100) / 100;
const oid = id => new mongoose.Types.ObjectId(String(id));

async function build(Owner, Pay, field, openField, ids) {
  const f = { [openField]: { $gt: 0 } };
  if (ids) f._id = { $in: ids.map(oid) };
  const owners = await Owner.find(f);
  const paidRows = owners.length
    ? await Pay.aggregate([
        { $match: { [field]: { $in: owners.map(o => o._id) }, [field === 'client' ? 'sale' : 'purchase']: null } },
        { $group: { _id: '$' + field, paid: { $sum: '$amount' } } },
      ])
    : [];
  const paidOf = Object.fromEntries(paidRows.map(p => [String(p._id), p.paid]));
  const map = new Map();
  for (const o of owners) {
    const opening = r2(o[openField] || 0), paid = r2(paidOf[String(o._id)] || 0);
    map.set(String(o._id), { owner: o, opening, paid, left: r2(Math.max(0, opening - paid)), date: o.openingDate });
  }
  return map;
}

// Map of id -> { owner, opening, paid, left, date } for clients / suppliers that have an opening amount
const clientOpening = ids => build(Client, Payment, 'client', 'openingDue', ids);
const supplierOpening = ids => build(Supplier, SupplierPayment, 'supplier', 'openingPayable', ids);

// Amount already received / paid against one owner's opening amount (also for owners whose opening was set to 0)
async function paidAgainstOpening(Pay, field, id) {
  const [r] = await Pay.aggregate([
    { $match: { [field]: oid(id), [field === 'client' ? 'sale' : 'purchase']: null } },
    { $group: { _id: null, v: { $sum: '$amount' } } },
  ]);
  return r2(r?.v || 0);
}

const sumLeft = map => r2([...map.values()].reduce((t, x) => t + x.left, 0));

// Reads and checks "opening" values sent from a form. Returns only the fields that were sent.
function readOpening(body, openField) {
  const out = {};
  if (body[openField] !== undefined) {
    const v = body[openField] === '' || body[openField] === null ? 0 : Number(body[openField]);
    if (!Number.isFinite(v) || v < 0) throw new Error('Opening amount cannot be negative');
    out[openField] = r2(v);
  }
  if (body.openingDate !== undefined) {
    if (body.openingDate === '' || body.openingDate === null) out.openingDate = null;
    else {
      const d = new Date(body.openingDate);
      if (isNaN(d)) throw new Error('Opening date is not valid');
      out.openingDate = d;
    }
  }
  return out;
}

module.exports = { clientOpening, supplierOpening, paidAgainstOpening, sumLeft, readOpening };
