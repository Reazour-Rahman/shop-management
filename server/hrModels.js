const { Schema, model, models } = require('mongoose');
const ref = n => ({ type: Schema.Types.ObjectId, ref: n });

const Employee = models.Employee || model('Employee', new Schema({
  empId: { type: String, unique: true },
  name: { type: String, required: true, trim: true },
  father: String, mother: String, address: String, nid: String,
  phones: [String],
  salary: { type: Number, default: 0, min: 0 },
  joinDate: Date,
  deviceId: { type: String, trim: true }, // the number the attendance machine knows this person by (empty = digits of the employee ID)
  active: { type: Boolean, default: true },
}, { timestamps: true }));

// One record per employee per month: what is owed for that period
const recSchema = new Schema({
  employee: { ...ref('Employee'), required: true },
  month: String, from: Date, to: Date,
  amount: Number, paid: { type: Number, default: 0 }, due: Number,
  status: { type: String, enum: ['Paid', 'Partial', 'Due'], default: 'Due' },
}, { timestamps: true });
recSchema.index({ employee: 1, month: 1 }, { unique: true });
const SalaryRecord = models.SalaryRecord || model('SalaryRecord', recSchema);

const SalaryPayment = models.SalaryPayment || model('SalaryPayment', new Schema({
  employee: ref('Employee'), record: ref('SalaryRecord'), amount: Number, method: String, date: { type: Date, default: Date.now },
}, { timestamps: true }));

const Expense = models.Expense || model('Expense', new Schema({
  category: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now }, note: String, method: String,
}, { timestamps: true }));

module.exports = { Employee, SalaryRecord, SalaryPayment, Expense };
