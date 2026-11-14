const mongoose = require('mongoose');
const { Schema, model, models } = mongoose;

const Counter = models.Counter || model('Counter', new Schema({ _id: String, seq: { type: Number, default: 0 } }));
// Auto IDs like C-0001. Reused later for invoices (INV-0001), employees, etc.
// Which collection and field each counter belongs to, so a number that is already used is skipped
const CHECK = {
  client: () => [Client, 'clientId'],
  employee: () => [require('./hrModels').Employee, 'empId'],
  invoice: () => [require('./saleModels').Sale, 'invoiceNo'],
  purchase: () => [require('./purchaseModels').Purchase, 'purchaseNo'],
  order: () => [require('./orderModels').Order, 'orderNo'],
};
const nextId = async (key, prefix) => {
  for (let i = 0; i < 2000; i++) {
    const c = await Counter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { new: true, upsert: true });
    const id = prefix + String(c.seq).padStart(4, '0');
    const [Model, field] = CHECK[key] ? CHECK[key]() : [];
    if (!Model || !(await Model.exists({ [field]: id }))) return id;
  }
  throw new Error('Could not generate a free ID');
};

const Client = models.Client || model('Client', new Schema({
  clientId: { type: String, unique: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, trim: true },
  note: { type: String, trim: true },
}, { timestamps: true }));

const productSchema = new Schema({
  name: { type: String, required: true, trim: true },
  brand: { type: String, trim: true, default: '' }, thickness: { type: String, trim: true, default: '' },
  color: { type: String, trim: true, default: '' }, size: { type: String, trim: true, default: '' },
  unit: { type: String, default: 'sq ft', trim: true },
  price: { type: Number, default: 0, min: 0 },
  stock: { type: Number, default: 0 },
  avgCost: { type: Number, default: 0 },     // weighted average cost per unit
  openingCost: { type: Number, default: 0 }, // cost per unit of the opening stock
  lowStock: { type: Number, default: 10, min: 0 },
  isService: { type: Boolean, default: false }, // installation/labor: no stock impact
  isContract: { type: Boolean, default: false }, // contract + service item: materials are added later
}, { timestamps: true, toJSON: { virtuals: true } });
// Each Name + Brand + Thickness + Color + Size combination is its own product with its own stock
productSchema.virtual('label').get(function () { return [this.name, this.brand, this.color, this.size, this.thickness].filter(Boolean).join(' - '); });
productSchema.index({ name: 1, brand: 1, thickness: 1, color: 1, size: 1 }, { unique: true });
const Product = models.Product || model('Product', productSchema);

module.exports = { Client, Product, nextId };
