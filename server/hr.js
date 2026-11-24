const router = require('express').Router();
const { nextId } = require('./models');
const { Employee, SalaryRecord, SalaryPayment, Expense } = require('./hrModels');

const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));
const num = v => Number(v) || 0;
const r2 = n => Math.round(n * 100) / 100;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pick = (o, ks) => Object.fromEntries(ks.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
const sum = (a, k) => r2(a.reduce((s, x) => s + x[k], 0));

// ---- Employees ----
const clean = b => {
  const o = pick(b, ['name', 'father', 'mother', 'address', 'phones', 'salary', 'nid', 'joinDate', 'active', 'deviceId']);
  if (typeof o.deviceId === 'string') o.deviceId = o.deviceId.trim().replace(/^0+(?=\d)/, '');
  if (typeof o.phones === 'string') o.phones = o.phones.split(',').map(x => x.trim()).filter(Boolean);
  if (!o.joinDate) delete o.joinDate;
  return o;
};
// Two people must never share one machine ID, or their punches would be mixed up
const checkDevice = async (o, selfId) => {
  if (!o.deviceId) return;
  if (!/^\d{1,32}$/.test(o.deviceId)) throw new Error('Machine ID must be a number, the same number you enrolled on the attendance machine');
  const all = await Employee.find(selfId ? { _id: { $ne: selfId } } : {});
  const norm = s => String(s || '').replace(/^0+/, '');
  const clash = all.find(e => norm(e.deviceId || String(e.empId || '').replace(/\D/g, '')) === norm(o.deviceId));
  if (clash) throw new Error(`Machine ID ${o.deviceId} is already used by ${clash.name} (${clash.empId})`);
};
router.post('/employees', wrap(async (req, res) => {
  const o = clean(req.body); await checkDevice(o);
  res.json(await Employee.create({ ...o, empId: await nextId('employee', 'E-') }));
}));
router.put('/employees/:id', wrap(async (req, res) => {
  const o = clean(req.body); await checkDevice(o, req.params.id);
  res.json(await Employee.findByIdAndUpdate(req.params.id, o, { new: true, runValidators: true }));
}));
router.delete('/employees/:id', wrap(async (req, res) => {
  if (await SalaryRecord.exists({ employee: req.params.id })) throw new Error('This employee has salary records. Mark the employee Inactive instead of deleting.');
  await Employee.findByIdAndDelete(req.params.id); res.json({ ok: true });
}));
router.get('/employees', wrap(async (req, res) => res.json(await Employee.find().sort('empId'))));
router.get('/employees-summary', wrap(async (req, res) => {
  const [emps, recs] = await Promise.all([Employee.find().sort('empId'), SalaryRecord.find()]);
  res.json(emps.map(e => {
    const rs = recs.filter(r => String(r.employee) === String(e._id));
    return { employee: e, months: rs.length, paid: sum(rs, 'paid'), due: sum(rs, 'due') };
  }));
}));
router.get('/employees/:id/history', wrap(async (req, res) => {
  const [records, payments] = await Promise.all([
    SalaryRecord.find({ employee: req.params.id }).sort('from'), SalaryPayment.find({ employee: req.params.id }).sort('date createdAt')]);
  res.json({ records, payments });
}));

// ---- Salary ----
function period(m) {
  if (!/^\d{4}-\d{2}$/.test(m || '')) throw new Error('Choose a month');
  const [y, mo] = m.split('-').map(Number);
  return { month: m, from: new Date(Date.UTC(y, mo - 1, 1)), to: new Date(Date.UTC(y, mo, 0)) };
}
async function addRecord(emp, m, amount) {
  const a = r2(num(amount ?? emp.salary));
  if (a < 0) throw new Error('Salary cannot be negative');
  try { return await SalaryRecord.create({ employee: emp._id, ...period(m), amount: a, due: a, paid: 0, status: a === 0 ? 'Paid' : 'Due' }); }
  catch (e) { throw e.code === 11000 ? new Error(`Salary for ${m} is already added for ${emp.name}`) : e; }
}
router.post('/salary-records', wrap(async (req, res) => {
  const emp = await Employee.findById(req.body.employee);
  if (!emp) throw new Error('Choose an employee');
  res.json(await addRecord(emp, req.body.month, req.body.amount));
}));
router.post('/salary-records/bulk', wrap(async (req, res) => {
  period(req.body.month);
  let added = 0;
  for (const e of await Employee.find({ active: true })) {
    if (await SalaryRecord.exists({ employee: e._id, month: req.body.month })) continue;
    await addRecord(e, req.body.month); added++;
  }
  res.json({ added });
}));
router.get('/salary-records', wrap(async (req, res) => {
  const { month, onlyDue } = req.query, f = {};
  if (month) f.month = month;
  if (onlyDue === '1') f.due = { $gt: 0 };
  res.json(await SalaryRecord.find(f).sort('-from').populate('employee'));
}));
router.delete('/salary-records/:id', wrap(async (req, res) => {
  await SalaryPayment.deleteMany({ record: req.params.id });
  await SalaryRecord.findByIdAndDelete(req.params.id); res.json({ ok: true });
}));
router.post('/salary-records/:id/payments', wrap(async (req, res) => {
  const rec = await SalaryRecord.findById(req.params.id);
  if (!rec) throw new Error('Salary record not found');
  const amount = r2(num(req.body.amount));
  if (amount <= 0) throw new Error('Enter an amount greater than 0');
  if (amount > rec.due) throw new Error(`Amount is more than the salary due (${rec.due})`);
  await SalaryPayment.create({ employee: rec.employee, record: rec._id, amount, method: req.body.method, date: req.body.date ? new Date(req.body.date) : new Date() });
  rec.paid = r2(rec.paid + amount); rec.due = r2(rec.amount - rec.paid); rec.status = rec.due <= 0 ? 'Paid' : 'Partial';
  await rec.save(); res.json(rec);
}));
// Salary expense = salary actually paid, grouped by the month it was paid
router.get('/salary-expense', wrap(async (req, res) => {
  const m = {};
  for (const p of await SalaryPayment.find()) { const k = p.date.toISOString().slice(0, 7); m[k] = r2((m[k] || 0) + p.amount); }
  res.json(Object.entries(m).map(([month, total]) => ({ month, total })).sort((a, b) => b.month.localeCompare(a.month)));
}));

// ---- Other expenses ----
const DEFAULT_CATS = ['Shop rent', 'Electricity & utility bill', 'Internet / phone bill', 'Transport / delivery', 'Repair & maintenance', 'miscellaneous', 'Marketing / advertising', 'Employee Snacks', 'Client Snacks', 'Other'];
router.get('/expense-categories', wrap(async (req, res) =>
  res.json([...new Set([...DEFAULT_CATS, ...(await Expense.distinct('category'))])].sort())));
router.get('/expenses', wrap(async (req, res) => {
  const { q = '', from, to, category } = req.query, f = {};
  if (q.trim()) { const rx = new RegExp(esc(q.trim()), 'i'); f.$or = [{ category: rx }, { note: rx }]; }
  if (category) f.category = category;
  if (from || to) f.date = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to + 'T23:59:59.999Z') }) };
  res.json(await Expense.find(f).sort('-date -createdAt').limit(500));
}));
router.post('/expenses', wrap(async (req, res) => {
  const b = pick(req.body, ['category', 'amount', 'date', 'note', 'method']);
  if (num(b.amount) <= 0) throw new Error('Enter an amount greater than 0');
  if (!b.date) delete b.date;
  res.json(await Expense.create(b));
}));
router.delete('/expenses/:id', wrap(async (req, res) => { await Expense.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

module.exports = router;
