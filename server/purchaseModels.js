const { Schema, model, models } = require('mongoose');
const ref = n => ({ type: Schema.Types.ObjectId, ref: n });

const Supplier = models.Supplier || model('Supplier', new Schema({
  name: { type: String, required: true, trim: true }, phone: { type: String, trim: true }, address: { type: String, trim: true },
}, { timestamps: true }));

const Purchase = models.Purchase || model('Purchase', new Schema({
  purchaseNo: { type: String, unique: true },
  supplier: { ...ref('Supplier'), required: true },
  date: { type: Date, default: Date.now },
  items: [{ product: ref('Product'), name: String, unit: String, qty: Number, cost: Number, total: Number }],
  total: Number, paid: { type: Number, default: 0 }, due: Number,
  status: { type: String, enum: ['Paid', 'Partial', 'Due'], default: 'Due' },
  note: String,
}, { timestamps: true }));

const SupplierPayment = models.SupplierPayment || model('SupplierPayment', new Schema({
  supplier: ref('Supplier'), purchase: ref('Purchase'), amount: Number, method: String, date: { type: Date, default: Date.now },
}, { timestamps: true }));

module.exports = { Supplier, Purchase, SupplierPayment };
