const { Schema, model, models } = require('mongoose');

const Order = models.Order || model('Order', new Schema({
  orderNo: { type: String, unique: true },
  client: { type: Schema.Types.ObjectId, ref: 'Client' },
  clientName: String, phone: String, siteAddress: String,
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['Draft', 'In progress', 'Done'], default: 'Draft' },
  note: String,
  items: [{
    service: String, qty: Number,
    specs: [{ brand: String, grade: String, thickness: String, product: String, color: String, size: String, productId: String, lth: String, wth: String }],
  }],
}, { timestamps: true }));

module.exports = { Order };