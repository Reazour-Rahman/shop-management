// Attendance: punches that arrive from the fingerprint / face machine (through the small program on the shop computer),
// plus daily and monthly reports. Times are stored as real instants (UTC) and shown in Bangladesh time (UTC+6, no daylight saving).
const crypto = require('crypto');
const router = require('express').Router();
const { Schema, model, models } = require('mongoose');
const { Employee } = require('./hrModels');

const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));
const BD = 6 * 3600e3;
const r2 = n => Math.round(n * 100) / 100;

const Punch = models.Punch || model('Punch', new Schema({
  uid: { type: String, unique: true }, // deviceNo + time, so the same punch can never be saved twice
  deviceNo: { type: String, required: true, index: true }, // the number the machine knows this person by
  time: { type: Date, required: true, index: true },
  source: { type: String, enum: ['device', 'manual'], default: 'device' },
  name: String, serialNo: Number,
}, { timestamps: true }));

const Setting = models.AttendanceSetting || model('AttendanceSetting', new Schema({
  key: { type: String, default: 'main', unique: true },
  workStart: { type: String, default: '09:00' }, // HH:MM
  graceMin: { type: Number, default: 10 }, // minutes after workStart that still count as on time
  weekOff: { type: [Number], default: [5] }, // 0 = Sunday ... 5 = Friday
  minWorkMin: { type: Number, default: 30 }, // two punches closer than this count as one (no Out time)
  lastIngestAt: Date,
}, { timestamps: true }));
const settings = async () => (await Setting.findOne({ key: 'main' })) || (await Setting.create({ key: 'main' }));

// ---------- helpers ----------
const dayKey = d => new Date(new Date(d).getTime() + BD).toISOString().slice(0, 10); // Bangladesh calendar day
const dayStart = key => new Date(Date.parse(key + 'T00:00:00Z') - BD);
const addDays = (key, n) => new Date(Date.parse(key + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const minutesOfDay = d => { const t = new Date(new Date(d).getTime() + BD); return t.getUTCHours() * 60 + t.getUTCMinutes(); };
const dow = key => new Date(key + 'T00:00:00Z').getUTCDay();
const hhmm = d => { const t = new Date(new Date(d).getTime() + BD); return String(t.getUTCHours()).padStart(2, '0') + ':' + String(t.getUTCMinutes()).padStart(2, '0'); };
const norm = s => String(s ?? '').trim().replace(/^0+/, '') || (String(s ?? '').trim() ? '0' : '');
// The machine number of an employee: the "Machine ID" typed on the employee, otherwise the digits of the employee ID (E-0007 -> 7)
const keyOf = e => norm(e.deviceId || String(e.empId || '').replace(/\D/g, ''));
const validDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const todayKey = () => dayKey(new Date());

// One employee's day from that day's punches (sorted by time)
function judge(times, set, key) {
  const off = set.weekOff.includes(dow(key));
  if (!times.length) return { status: off ? 'Off' : key === todayKey() ? 'Not yet' : key > todayKey() ? '' : 'Absent', punches: 0 };
  const first = times[0], last = times[times.length - 1];
  const out = times.length > 1 && last - first >= set.minWorkMin * 60e3 ? last : null;
  const [h, m] = set.workStart.split(':').map(Number);
  const late = !off && minutesOfDay(first) > h * 60 + m + set.graceMin;
  return { status: late ? 'Late' : 'Present', punches: times.length, in: first, out, hours: out ? r2((out - first) / 3.6e6) : 0 };
}

async function loadDay(from, to) { // from, to: day keys, inclusive
  const [emps, punches, set] = await Promise.all([
    Employee.find({ active: true }).sort('empId'),
    Punch.find({ time: { $gte: dayStart(from), $lt: dayStart(addDays(to, 1)) } }).sort('time'),
    settings(),
  ]);
  const byKey = new Map(emps.map(e => [keyOf(e), e]));
  const grid = new Map(); // employee id -> day -> [times]
  const unknown = {};
  for (const p of punches) {
    const e = byKey.get(norm(p.deviceNo));
    if (!e) { unknown[p.deviceNo] = (unknown[p.deviceNo] || 0) + 1; continue; }
    const g = grid.get(String(e._id)) || new Map(), k = dayKey(p.time);
    g.set(k, [...(g.get(k) || []), p.time]); grid.set(String(e._id), g);
  }
  return { emps, grid, set, unknown };
}

// ---------- reports ----------
router.get('/attendance/day', wrap(async (req, res) => {
  const date = validDay(req.query.date) ? req.query.date : todayKey();
  const { emps, grid, set, unknown } = await loadDay(date, date);
  res.json({
    date, settings: set, unknown,
    rows: emps.map(e => {
      const j = judge(grid.get(String(e._id))?.get(date) || [], set, date);
      return { employee: { _id: e._id, empId: e.empId, name: e.name, deviceKey: keyOf(e) }, ...j, inText: j.in ? hhmm(j.in) : '', outText: j.out ? hhmm(j.out) : '' };
    }),
  });
}));

router.get('/attendance/month', wrap(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : todayKey().slice(0, 7);
  const first = month + '-01', next = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 1)).toISOString().slice(0, 10);
  const last = addDays(next, -1), until = last < todayKey() ? last : todayKey();
  const { emps, grid, set, unknown } = await loadDay(first, last);
  const days = []; for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  res.json({
    month, days, settings: set, unknown,
    rows: emps.map(e => {
      const from = e.joinDate && dayKey(e.joinDate) > first ? dayKey(e.joinDate) : first;
      const t = { present: 0, late: 0, absent: 0, off: 0, hours: 0 }, cells = {};
      for (const d of days) {
        if (d < from || d > until) { cells[d] = ''; continue; }
        const j = judge(grid.get(String(e._id))?.get(d) || [], set, d);
        cells[d] = j.status === 'Present' ? 'P' : j.status === 'Late' ? 'L' : j.status === 'Absent' ? 'A' : j.status === 'Off' ? 'O' : '';
        if (j.status === 'Present') t.present++; else if (j.status === 'Late') t.late++; else if (j.status === 'Absent') t.absent++; else if (j.status === 'Off') t.off++;
        t.hours = r2(t.hours + (j.hours || 0));
      }
      return { employee: { _id: e._id, empId: e.empId, name: e.name }, ...t, cells };
    }),
  });
}));

// ---------- punches of one person on one day (to correct mistakes) ----------
router.get('/attendance/punches', wrap(async (req, res) => {
  const e = await Employee.findById(req.query.employee);
  if (!e || !validDay(req.query.date)) throw new Error('Choose an employee and a date');
  const list = await Punch.find({ time: { $gte: dayStart(req.query.date), $lt: dayStart(addDays(req.query.date, 1)) } }).sort('time');
  res.json(list.filter(p => norm(p.deviceNo) === keyOf(e)).map(p => ({ _id: p._id, time: p.time, text: hhmm(p.time), source: p.source })));
}));
router.post('/attendance/manual', wrap(async (req, res) => {
  const { employee, date, time } = req.body;
  const e = await Employee.findById(employee);
  if (!e) throw new Error('Choose an employee');
  if (!validDay(date) || !/^\d{2}:\d{2}$/.test(String(time))) throw new Error('Enter a date and a time');
  const [h, m] = time.split(':').map(Number);
  if (h > 23 || m > 59) throw new Error('Time is not valid');
  const at = new Date(dayStart(date).getTime() + (h * 60 + m) * 60e3);
  if (at > new Date()) throw new Error('A punch cannot be in the future');
  const no = keyOf(e);
  if (!no) throw new Error('This employee has no machine ID');
  await Punch.updateOne({ uid: `${no}|${at.toISOString()}` }, { $setOnInsert: { deviceNo: no, time: at, source: 'manual', name: e.name } }, { upsert: true });
  res.json({ ok: true });
}));
router.delete('/attendance/punches/:id', wrap(async (req, res) => { await Punch.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

// ---------- settings and machine status ----------
router.get('/attendance/settings', wrap(async (req, res) => res.json(await settings())));
router.put('/attendance/settings', wrap(async (req, res) => {
  const b = req.body, s = await settings();
  if (b.workStart !== undefined) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.workStart)) throw new Error('Start time must look like 09:00'); s.workStart = b.workStart; }
  if (b.graceMin !== undefined) { const v = Number(b.graceMin); if (!(v >= 0 && v <= 240)) throw new Error('Grace minutes must be 0 to 240'); s.graceMin = v; }
  if (b.minWorkMin !== undefined) { const v = Number(b.minWorkMin); if (!(v >= 0 && v <= 600)) throw new Error('Minimum work minutes must be 0 to 600'); s.minWorkMin = v; }
  if (b.weekOff !== undefined) { if (!Array.isArray(b.weekOff) || b.weekOff.some(d => !(d >= 0 && d <= 6))) throw new Error('Weekly off days are not valid'); s.weekOff = b.weekOff.map(Number); }
  await s.save(); res.json(s);
}));
router.get('/attendance/status', wrap(async (req, res) => {
  const [s, last, today] = await Promise.all([settings(), Punch.findOne({ source: 'device' }).sort('-time'), Punch.countDocuments({ time: { $gte: dayStart(todayKey()) } })]);
  res.json({ lastIngestAt: s.lastIngestAt, lastPunchAt: last?.time, punchesToday: today, keySet: !!process.env.ATTENDANCE_KEY });
}));

// ---------- the shop computer program talks to these two (no login cookie: it sends the secret key) ----------
function keyOk(req) {
  const want = process.env.ATTENDANCE_KEY || '', got = String(req.get('x-api-key') || '');
  if (want.length < 16) return false; // a short key is refused, so the endpoint is never left open by a weak value
  const a = crypto.createHash('sha256').update(want).digest(), b = crypto.createHash('sha256').update(got).digest();
  return crypto.timingSafeEqual(a, b);
}
const guard = fn => async (req, res) => {
  try {
    if (!process.env.ATTENDANCE_KEY || process.env.ATTENDANCE_KEY.length < 16) return res.status(503).json({ error: 'ATTENDANCE_KEY is not set (at least 16 characters) on the website' });
    if (!keyOk(req)) return res.status(401).json({ error: 'Wrong key' });
    await fn(req, res);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

const ingest = guard(async (req, res) => {
  const list = Array.isArray(req.body?.events) ? req.body.events : null;
  if (!list) throw new Error('events must be a list');
  if (list.length > 500) throw new Error('Send at most 500 events at a time');
  const now = Date.now(), ops = [], bad = [];
  for (const ev of list) {
    const no = String(ev?.employeeNo ?? '').trim(), t = new Date(ev?.time);
    if (!no || no.length > 32 || isNaN(t) || t.getTime() > now + 864e5 || t.getTime() < now - 800 * 864e5) { bad.push(ev?.serialNo ?? null); continue; }
    ops.push({ updateOne: { filter: { uid: `${norm(no)}|${t.toISOString()}` }, update: { $setOnInsert: { deviceNo: norm(no), time: t, source: 'device', name: String(ev.name || '').slice(0, 80), serialNo: Number(ev.serialNo) || undefined } }, upsert: true } });
  }
  const r = ops.length ? await Punch.bulkWrite(ops, { ordered: false }) : { upsertedCount: 0 };
  await Setting.updateOne({ key: 'main' }, { $set: { lastIngestAt: new Date() } }, { upsert: true });
  res.json({ received: list.length, saved: r.upsertedCount, duplicates: ops.length - r.upsertedCount, rejected: bad.length });
});
const lastPunch = guard(async (req, res) => {
  const l = await Punch.findOne({ source: 'device' }).sort('-time');
  res.json({ last: l ? l.time : null });
});

module.exports = router;
module.exports.ingest = ingest;
module.exports.lastPunch = lastPunch;
module.exports._t = { judge, dayKey, keyOf, norm, hhmm, dayStart };
