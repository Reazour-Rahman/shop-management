// Attendance sync program for the shop computer.
// It reads the punches that the Hikvision fingerprint/face machine stored, and sends them to the website.
// The machine keeps its own records while this computer is off, so when the computer is on again this program
// catches up from where it stopped. No packages to install: only Node.js 18 or newer.
'use strict';
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const CONFIG_FILE = process.env.AGENT_CONFIG || path.join(DIR, 'config.json');
const STATE_FILE = process.env.AGENT_STATE || path.join(DIR, 'state.json');
const LOG_FILE = path.join(DIR, 'agent.log');

// ---------- small helpers ----------
const log = (...a) => {
  const line = `[${new Date().toLocaleString('en-GB')}] ${a.join(' ')}`;
  console.log(line);
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 1e6) fs.renameSync(LOG_FILE, LOG_FILE + '.old');
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch { /* the log is only a convenience */ }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) throw new Error(`config.json not found. Copy config.example.json to config.json and fill it in. (${CONFIG_FILE})`);
  const c = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  for (const k of ['deviceUrl', 'deviceUser', 'devicePassword', 'websiteUrl', 'apiKey'])
    if (!c[k] || /^PUT_|^CHANGE_/.test(String(c[k]))) throw new Error(`config.json: "${k}" is not filled in`);
  return {
    timezone: '+06:00', intervalSeconds: 120, initialDays: 30, pageSize: 30, minor: 0, batchSize: 200, ...c,
    deviceUrl: c.deviceUrl.replace(/\/+$/, ''), websiteUrl: c.websiteUrl.replace(/\/+$/, ''),
  };
}
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } };
const writeState = s => fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));

// ---------- HTTP Digest authentication (what the machine uses) ----------
const hash = (alg, s) => crypto.createHash(alg === 'SHA-256' ? 'sha256' : 'md5').update(s).digest('hex');

function parseChallenge(h) {
  const out = {};
  String(h || '').replace(/^Digest\s+/i, '').replace(/(\w+)=(?:"([^"]*)"|([^\s,]*))/g, (_, k, q, u) => { out[k.toLowerCase()] = q ?? u; });
  return out;
}
function digestHeader(ch, method, uri, user, pass) {
  const alg = (ch.algorithm || 'MD5').toUpperCase().replace('SHA-256-SESS', 'SHA-256');
  const nc = '00000001', cnonce = crypto.randomBytes(8).toString('hex');
  const qop = (ch.qop || '').split(',').map(s => s.trim()).includes('auth') ? 'auth' : '';
  const ha1 = hash(alg, `${user}:${ch.realm}:${pass}`), ha2 = hash(alg, `${method}:${uri}`);
  const response = qop ? hash(alg, `${ha1}:${ch.nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : hash(alg, `${ha1}:${ch.nonce}:${ha2}`);
  let h = `Digest username="${user}", realm="${ch.realm}", nonce="${ch.nonce}", uri="${uri}", response="${response}"`;
  if (ch.algorithm) h += `, algorithm=${ch.algorithm}`;
  if (qop) h += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  if (ch.opaque) h += `, opaque="${ch.opaque}"`;
  return h;
}
function rawRequest(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), mod = u.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, method, headers,
      rejectUnauthorized: false, // the machine uses its own certificate; this only talks to the machine on the shop network
      timeout: 25000,
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('The machine did not answer (timeout)')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
async function deviceRequest(cfg, method, pathAndQuery, json) {
  const url = cfg.deviceUrl + pathAndQuery, body = json ? JSON.stringify(json) : undefined;
  const base = { 'Content-Type': 'application/json', ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}) };
  let r = await rawRequest(url, method, base, body);
  if (r.status === 401) {
    const ch = parseChallenge(r.headers['www-authenticate']);
    if (!ch.nonce) throw new Error('The machine asked for a login in a way this program does not understand');
    r = await rawRequest(url, method, { ...base, Authorization: digestHeader(ch, method, pathAndQuery, cfg.deviceUser, cfg.devicePassword) }, body);
    if (r.status === 401) throw new Error('The machine refused the user name or password (config.json)');
  }
  return r;
}

// ---------- reading punches from the machine ----------
const stamp = (d, tz) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}${tz}`;
const tzMs = tz => { const m = /^([+-])(\d{2}):(\d{2})$/.exec(tz); if (!m) throw new Error('config.json: timezone must look like +06:00'); return (m[1] === '-' ? -1 : 1) * (m[2] * 60 + +m[3]) * 60000; };

// All access events of the machine between two instants (paged). Returns only the ones that identify a person.
async function fetchWindow(cfg, from, to) {
  const off = tzMs(cfg.timezone), out = [];
  let minor = cfg.minor, pos = 0;
  const searchID = crypto.randomUUID();
  for (let guard = 0; guard < 2000; guard++) {
    const cond = { AcsEventCond: { searchID, searchResultPosition: pos, maxResults: cfg.pageSize, major: 5, minor,
      startTime: stamp(new Date(from.getTime() + off), cfg.timezone), endTime: stamp(new Date(to.getTime() + off), cfg.timezone) } };
    const r = await deviceRequest(cfg, 'POST', '/ISAPI/AccessControl/AcsEvent?format=json', cond);
    let j = {}; try { j = JSON.parse(r.body); } catch { /* not json */ }
    if (r.status !== 200) {
      if (minor === 0 && pos === 0 && /badParameters|Invalid/i.test(r.body)) { minor = 75; continue; } // some firmware wants a specific event type
      throw new Error(`The machine replied ${r.status}: ${String(r.body).slice(0, 200)}`);
    }
    const ev = j.AcsEvent || {}, list = ev.InfoList || [];
    for (const e of list) {
      const no = String(e.employeeNoString ?? '').trim();
      if (e.major === 5 && no && no !== '0') out.push({ employeeNo: no, time: e.time, serialNo: e.serialNo, name: e.name });
    }
    pos += list.length;
    if (!list.length || ev.responseStatusStrg !== 'MORE') break;
  }
  return out;
}

// ---------- sending to the website ----------
async function website(cfg, method, p, body) {
  const r = await fetch(cfg.websiteUrl + '/api' + p, {
    method, headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey }, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Website replied ${r.status}: ${j.error || 'error'}`);
  return j;
}
async function send(cfg, events) {
  let total = { saved: 0, duplicates: 0, rejected: 0 };
  for (let i = 0; i < events.length; i += cfg.batchSize) {
    const r = await website(cfg, 'POST', '/attendance/ingest', { events: events.slice(i, i + cfg.batchSize) });
    for (const k of Object.keys(total)) total[k] += r[k] || 0;
  }
  return total;
}

// ---------- one catch-up round ----------
async function syncOnce(cfg) {
  const state = readState(), OVERLAP = 15 * 60000, now = new Date();
  let from;
  if (state.lastTime) from = new Date(new Date(state.lastTime).getTime() - OVERLAP);
  else {
    const l = await website(cfg, 'GET', '/attendance/last'); // first run, or state.json was deleted: continue from what the website already has
    from = l.last ? new Date(new Date(l.last).getTime() - OVERLAP) : new Date(now.getTime() - cfg.initialDays * 864e5);
  }
  const DAY = 864e5;
  let cursor = from, newest = state.lastTime ? new Date(state.lastTime) : null, saved = 0, dup = 0, seen = 0;
  while (cursor < now) {
    const to = new Date(Math.min(cursor.getTime() + DAY, now.getTime()));
    const events = await fetchWindow(cfg, cursor, to);
    if (events.length) {
      const r = await send(cfg, events);
      saved += r.saved; dup += r.duplicates; seen += events.length;
      for (const e of events) { const t = new Date(e.time); if (!newest || t > newest) newest = t; }
      if (r.rejected) log(`Warning: the website rejected ${r.rejected} events`);
    }
    // everything up to "to" is now sent (the next round starts 15 minutes earlier, so nothing near the edge is missed)
    writeState({ ...readState(), lastTime: to.toISOString() });
    cursor = to;
  }
  return { seen, saved, dup };
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 18) { console.error('Node.js 18 or newer is needed. Install the LTS version from nodejs.org'); process.exit(1); }
  const once = process.argv.includes('--once');
  log('Attendance sync started' + (once ? ' (one round)' : ''));
  for (;;) {
    let wait = 120;
    try {
      const cfg = readConfig(); wait = cfg.intervalSeconds;
      const r = await syncOnce(cfg);
      log(r.seen ? `Sent ${r.seen} punches: ${r.saved} new, ${r.dup} already on the website` : 'No new punches');
    } catch (e) {
      log('Problem: ' + e.message + (once ? '' : ' (will try again)'));
      if (once) process.exitCode = 1;
    }
    if (once) break;
    await sleep(wait * 1000);
  }
}
if (require.main === module) main();
module.exports = { parseChallenge, digestHeader, syncOnce, fetchWindow, readConfig };
