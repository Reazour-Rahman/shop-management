const router = require('express').Router();
const mongoose = require('mongoose');
const { Client } = require('./models');
const { Sale } = require('./saleModels');

const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));

// Accepts 01XXXXXXXXX, 8801XXXXXXXXX, +8801XXXXXXXXX
const normalize = p => {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('880')) d = '0' + d.slice(3);
  return /^01\d{9}$/.test(d) ? d : null;
};

const SMS_URL = process.env.SMS_API_URL || 'https://a2p.cdclbd.net/functions/v1/transactional-sms';
const VOICE_URL = process.env.VOICE_API_URL || 'https://a2p.cdclbd.net/functions/v1/voice-sms-api';

async function post(url, key, body) {
  if (!key) throw new Error('API key is missing in .env');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify(body),
  });
  const full = await r.text();
  let j = {}; try { j = JSON.parse(full); } catch {}
  if (!r.ok || j.success === false) throw new Error(j.error || j.message || 'Gateway replied: ' + full.slice(0, 200));
  return j;
}

async function sendSms(phone, message) {
  const body = { serviceType: process.env.SMS_SERVICE_TYPE || 'non_masking_sms', message, recipients: [phone] };
  if (process.env.SMS_SENDER_ID) body.senderId = process.env.SMS_SENDER_ID;
  const j = await post(SMS_URL, process.env.SMS_API_KEY, body);
  return `Parts: ${j.smsPartsPerMessage ?? '?'} · Balance left: ${j.remainingBalance ?? '?'}`;
}

// One campaign for all selected clients, playing the saved audio template
async function startVoiceCampaign(phones) {
  if (!process.env.VOICE_TEMPLATE_ID) throw new Error('VOICE_TEMPLATE_ID is missing in .env');
  const j = await post(VOICE_URL, process.env.VOICE_API_KEY, {
    action: 'start-campaign', templateId: process.env.VOICE_TEMPLATE_ID,
    campaignName: 'Dues reminder ' + new Date().toISOString().slice(0, 10), recipients: phones,
  });
  return JSON.stringify(j).slice(0, 200);
}

router.post('/dues/notify', wrap(async (req, res) => {
  const { clientIds = [], channel, template = '' } = req.body;
  if (!['sms', 'call'].includes(channel)) throw new Error('Choose SMS or call');
  if (channel === 'sms' && !template.trim()) throw new Error('Write the message first');
  if (!clientIds.length) throw new Error('Select at least one client');
  if (clientIds.length > 30) throw new Error('Select at most 30 clients at a time');

  const [clients, dues] = await Promise.all([
    Client.find({ _id: { $in: clientIds } }),
    Sale.aggregate([
      { $match: { client: { $in: clientIds.map(id => new mongoose.Types.ObjectId(id)) }, due: { $gt: 0 } } },
      { $group: { _id: '$client', due: { $sum: '$due' } } },
    ]),
  ]);
  const dueOf = Object.fromEntries(dues.map(d => [String(d._id), Math.round(d.due * 100) / 100]));
  const rows = clients.map(c => ({ c, due: dueOf[String(c._id)] || 0, phone: normalize(c.phone), row: { client: c.name, phone: c.phone } }));
  const bad = r => (!r.due ? 'This client has no due' : !r.phone ? 'Invalid mobile number' : null);

  let results;
  if (channel === 'sms') {
    results = await Promise.all(rows.map(async r => {
      try {
        const b = bad(r); if (b) throw new Error(b);
        const text = template.replaceAll('{name}', r.c.name).replaceAll('{due}', String(r.due));
        return { ...r.row, ok: true, detail: await sendSms(r.phone, text) };
      } catch (e) { return { ...r.row, ok: false, error: e.message }; }
    }));
  } else {
    const good = rows.filter(r => !bad(r));
    let detail, err;
    if (good.length) { try { detail = await startVoiceCampaign(good.map(r => r.phone)); } catch (e) { err = e.message; } }
    results = rows.map(r => bad(r) ? { ...r.row, ok: false, error: bad(r) }
      : err ? { ...r.row, ok: false, error: err } : { ...r.row, ok: true, detail });
  }
  res.json({ results });
}));

router.get('/sms-balance', wrap(async (req, res) => {
  const out = {};
  try { out.sms = (await post(SMS_URL, process.env.SMS_API_KEY, { action: 'check-balance' })).walletBalance ?? null; }
  catch (e) { out.smsError = e.message; }
  try { out.voice = JSON.stringify(await post(VOICE_URL, process.env.VOICE_API_KEY, { action: 'check-balance' })).slice(0, 150); }
  catch (e) { out.voiceError = e.message; }
  res.json(out);
}));

module.exports = router;