const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const { db, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'webr48-dev-secret-change-me';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://ultimmatenexatech-hugging8n.hf.space/webhook/dropshipping-form';

// ---------- middleware ----------
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// rate limiter for lead form
const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions, please try again later.' }
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, try again later.' }
});

// static uploads
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = Date.now() + '-' + Math.round(Math.random()*1e6) + ext;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// auth helper
function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized — please login again' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    // distinguish expiry for better UX
    const msg = e && e.name === 'TokenExpiredError' ? 'Session expired — please login again' : 'Invalid token — please logout and login again';
    return res.status(401).json({ error: msg });
  }
}

// ---------- helpers ----------
async function getAllContent() {
  const rows = await db.prepare('SELECT key, value FROM content').all();
  const obj = {};
  for (const r of rows) {
    try { obj[r.key] = JSON.parse(r.value); } catch { obj[r.key] = r.value; }
  }
  return obj;
}
async function getContentValue(key) {
  const row = await db.prepare('SELECT value FROM content WHERE key = ?').get(key);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

// ---------- API: content ----------
app.get('/api/content', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.json(await getAllContent());
});

app.put('/api/content', authMiddleware, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid body' });
  for (const [k, v] of Object.entries(body)) {
    const val = typeof v === 'string' ? v : JSON.stringify(v);
    await db.prepare('INSERT OR REPLACE INTO content (key, value) VALUES (?, ?)').run(k, val);
  }
  res.json({ ok: true, content: await getAllContent() });
});

// publish — marks content as live and stamps time
app.post('/api/content/publish', authMiddleware, async (req, res) => {
  const now = new Date().toISOString();
  const by = req.user?.username || 'admin';
  await db.prepare('INSERT OR REPLACE INTO content (key, value) VALUES (?, ?)').run('site_published_at', now);
  await db.prepare('INSERT OR REPLACE INTO content (key, value) VALUES (?, ?)').run('site_published_by', by);
  await db.prepare('INSERT OR REPLACE INTO content (key, value) VALUES (?, ?)').run('site_publish_status', 'published');
  res.json({ ok: true, published_at: now, published_by: by });
});
app.get('/api/content/publish', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const at = await getContentValue('site_published_at');
  const by = await getContentValue('site_published_by');
  const status = await getContentValue('site_publish_status');
  res.json({ published_at: at || null, published_by: by || null, status: status || 'draft' });
});

// single key update
app.put('/api/content/:key', authMiddleware, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'Missing value' });
  const val = typeof value === 'string' ? value : JSON.stringify(value);
  await db.prepare('INSERT OR REPLACE INTO content (key, value) VALUES (?, ?)').run(key, val);
  res.json({ ok: true, key, value });
});

// ---------- API: media ----------
app.get('/api/media', async (req, res) => {
  const { category } = req.query;
  let rows;
  if (category) rows = await db.prepare('SELECT * FROM media WHERE category = ? ORDER BY sort_order ASC').all(category);
  else rows = await db.prepare('SELECT * FROM media ORDER BY category, sort_order ASC').all();
  res.json(rows);
});

app.post('/api/media', authMiddleware, upload.single('image'), async (req, res) => {
  const { category, caption } = req.body;
  if (!category || !['portfolio','sales_proof'].includes(category)) return res.status(400).json({ error: 'Invalid category' });
  let url = req.body.url;
  if (req.file) url = '/uploads/' + req.file.filename;
  if (!url) return res.status(400).json({ error: 'Missing image url or file' });
  const all = await db.prepare('SELECT * FROM media WHERE category = ?').all(category);
  const maxOrder = all.length ? Math.max(...all.map(m=>m.sort_order||0)) : 0;
  const result = await db.prepare('INSERT INTO media (category, url, caption, sort_order) VALUES (?, ?, ?, ?)').run(category, url, caption||'', maxOrder+1);
  const id = result.lastInsertRowid;
  const row = await db.prepare('SELECT * FROM media WHERE id = ?').get(id) || { id, category, url, caption, sort_order: maxOrder+1 };
  res.json(row);
});

app.delete('/api/media/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  await db.prepare('DELETE FROM media WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.put('/api/media/reorder', authMiddleware, async (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds required' });
  for (let idx = 0; idx < orderedIds.length; idx++) {
    await db.prepare('UPDATE media SET sort_order = ? WHERE id = ?').run(idx+1, Number(orderedIds[idx]));
  }
  res.json({ ok: true });
});

// ---------- API: generic upload for logo/favicon ----------
app.post('/api/upload', authMiddleware, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Field name must be \"image\"' });
  const url = '/uploads/' + req.file.filename;
  res.json({ ok: true, url, filename: req.file.filename });
});

// ---------- API: leads ----------
app.post('/api/leads', leadLimiter, async (req, res) => {
  const {
    name, storeName, budget, storeStatus, wasScammed, scamDetails,
    whatsapp, email, source, consent, website,
    pageUrl, contactTime, hearAbout
  } = req.body;

  if (website) {
    return res.status(200).json({ ok: true, message: 'Thanks! We will be in touch.' });
  }

  const errors = [];
  if (!name || String(name).trim().length < 2) errors.push('Full name required');
  if (!storeName || String(storeName).trim().length < 1) errors.push('Preferred store name required');
  if (!budget) errors.push('Budget required');
  if (!storeStatus || !['already_have_store','just_starting'].includes(storeStatus)) errors.push('Current status required');
  if (!wasScammed || !['yes','no'].includes(wasScammed)) errors.push('Scam history required');
  if (!whatsapp || !/^\+?[0-9\s\-()]{8,20}$/.test(String(whatsapp).trim())) errors.push('Valid WhatsApp number required');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) errors.push('Valid email required');
  if (!consent) errors.push('Consent required');
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const clean = {
    name: String(name).trim(),
    storeName: String(storeName).trim(),
    budget: String(budget).trim(),
    storeStatus,
    wasScammed,
    scamDetails: wasScammed === 'yes' ? String(scamDetails||'').trim().slice(0,2000) : '',
    whatsapp: String(whatsapp).trim(),
    email: String(email).trim().toLowerCase(),
    source: String(source || hearAbout || '').trim(),
    consent: !!consent,
    pageUrl: String(pageUrl || req.headers.referer || '').trim(),
    submittedAt: new Date().toISOString()
  };

  const esc = (s) => String(s).replace(/[<>]/g, '');

  let leadId;
  try {
    const r = await db.prepare(`INSERT INTO leads (name, store_name, budget, store_status, was_scammed, scam_details, whatsapp, email, source, consent, page_url, webhook_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      esc(clean.name), esc(clean.storeName), esc(clean.budget), clean.storeStatus, clean.wasScammed, esc(clean.scamDetails), esc(clean.whatsapp), esc(clean.email), esc(clean.source), clean.consent ? 1 : 0, esc(clean.pageUrl), 'pending'
    );
    leadId = r.lastInsertRowid;
  } catch (e) {
    console.error('lead insert failed', e);
    return res.status(500).json({ error: 'Failed to save lead' });
  }

  const payload = {
    name: clean.name,
    storeName: clean.storeName,
    budget: clean.budget,
    storeStatus: clean.storeStatus,
    wasScammed: clean.wasScammed,
    scamDetails: clean.scamDetails,
    whatsapp: clean.whatsapp,
    email: clean.email,
    source: clean.source,
    consent: clean.consent,
    submittedAt: clean.submittedAt,
    pageUrl: clean.pageUrl,
    contactTime: contactTime || '',
    hearAbout: hearAbout || ''
  };

  (async () => {
    let status = 'failed';
    for (let attempt=1; attempt<=3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(()=>controller.abort(), 8000);
        const resp = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (resp.ok) { status='sent'; break; }
        console.warn(`[webhook] attempt ${attempt} failed status ${resp.status}`);
      } catch (e) {
        console.warn(`[webhook] attempt ${attempt} error: ${e.message}`);
      }
      if (attempt < 3) await new Promise(r=>setTimeout(r, attempt*1500));
    }
    try { await db.prepare('UPDATE leads SET webhook_status = ? WHERE id = ?').run(status, leadId); } catch {}
  })();

  try { await db.prepare('INSERT INTO events (event_type, element_id, session_id, page_url, meta) VALUES (?, ?, ?, ?, ?)').run('form_submit', 'lead_form', req.headers['x-session-id']||'unknown', clean.pageUrl, JSON.stringify({ leadId })); } catch {}

  res.json({ ok: true, message: "Thanks! We'll reach out on WhatsApp within 24 hours", leadId });
});

app.get('/api/leads', authMiddleware, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  res.json(rows);
});

app.patch('/api/leads/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const { status, webhook_status } = req.body;
  if (status) await db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(String(status), id);
  if (webhook_status) await db.prepare('UPDATE leads SET webhook_status = ? WHERE id = ?').run(String(webhook_status), id);
  const row = await db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  res.json(row || { ok: true });
});

app.post('/api/leads/:id/retry-webhook', authMiddleware, async (req,res)=>{
  const id = Number(req.params.id);
  const lead = await db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const payload = {
    name: lead.name,
    storeName: lead.store_name,
    budget: lead.budget,
    storeStatus: lead.store_status,
    wasScammed: lead.was_scammed,
    scamDetails: lead.scam_details,
    whatsapp: lead.whatsapp,
    email: lead.email,
    source: lead.source,
    consent: !!lead.consent,
    submittedAt: lead.submitted_at,
    pageUrl: lead.page_url
  };
  try {
    const resp = await fetch(WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const status = resp.ok ? 'sent' : 'failed';
    await db.prepare('UPDATE leads SET webhook_status = ? WHERE id = ?').run(status, id);
    res.json({ ok: resp.ok, webhook_status: status });
  } catch(e){
    await db.prepare('UPDATE leads SET webhook_status = ? WHERE id = ?').run('failed', id);
    res.status(502).json({ error: e.message, webhook_status: 'failed' });
  }
});

app.get('/api/leads/export/csv', authMiddleware, async (req,res)=>{
  const rows = await db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  const headers = ['id','name','store_name','budget','store_status','was_scammed','scam_details','whatsapp','email','source','consent','page_url','webhook_status','status','submitted_at','created_at'];
  const escCsv = v=> `"${String(v??'').replace(/"/g,'""')}"`;
  let csv = headers.join(',')+'\n';
  for(const r of rows){ csv += headers.map(h=>escCsv(r[h])).join(',')+'\n'; }
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="webr48-leads.csv"');
  res.send(csv);
});

// ---------- API: events / analytics ----------
app.post('/api/events', async (req, res)=>{
  const { event_type, element_id, sessionId, pageUrl, meta } = req.body;
  if (!event_type) return res.status(400).json({ error: 'event_type required' });
  const sid = String(sessionId || req.headers['x-session-id'] || 'anon').slice(0,100);
  const eid = String(element_id || '').slice(0,200);
  const purl = String(pageUrl || req.headers.referer || '').slice(0,500);
  const m = meta ? JSON.stringify(meta).slice(0,2000) : null;
  await db.prepare('INSERT INTO events (event_type, element_id, session_id, page_url, meta) VALUES (?, ?, ?, ?, ?)').run(String(event_type).slice(0,50), eid, sid, purl, m);
  res.json({ ok: true });
});

app.get('/api/analytics', authMiddleware, async (req,res)=>{
  const events = await db.prepare('SELECT * FROM events').all();
  const leads = await db.prepare('SELECT * FROM leads').all();

  const byDay = {};
  const byType = {};
  const byElement = {};
  const bySource = {};
  const sessions = new Set();
  for(const e of events){
    const day = (e.created_at || '').slice(0,10) || new Date().toISOString().slice(0,10);
    byDay[day] = (byDay[day]||0)+1;
    byType[e.event_type] = (byType[e.event_type]||0)+1;
    if(e.element_id) byElement[e.element_id]=(byElement[e.element_id]||0)+1;
    if(e.session_id) sessions.add(e.session_id);
  }
  for(const l of leads){
    const src = (l.source||'unknown')||'unknown';
    bySource[src]=(bySource[src]||0)+1;
  }
  const pageviews = byType['pageview'] || 0;
  const ctaClicks = Object.entries(byElement).filter(([k])=>k.includes('cta')||k.includes('whatsapp')||k.includes('book')).reduce((a,[,v])=>a+v,0);
  const formStarts = byType['form_start'] || 0;
  const formSubmits = byType['form_submit'] || 0;
  const totalLeads = leads.length;

  res.json({
    totals: {
      pageviews,
      uniqueVisitors: sessions.size,
      totalEvents: events.length,
      ctaClicks,
      formStarts,
      formSubmits,
      totalLeads,
      funnelDropOff: formStarts ? Math.round((1 - formSubmits/Math.max(formStarts,1))*100) : 0
    },
    byDay, byType, byElement, bySource,
    recentEvents: events.slice(-50).reverse(),
    recentLeads: leads.slice(0,10)
  });
});

// ---------- API: auth ----------
app.post('/api/auth/login', loginLimiter, async (req,res)=>{
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = await db.prepare('SELECT * FROM admin_users WHERE username = ?').get(String(username));
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, username: user.username });
});

app.get('/api/auth/me', authMiddleware, (req,res)=>{
  res.json({ user: req.user });
});

app.post('/api/auth/change-password', authMiddleware, async (req,res)=>{
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const user = await db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!bcrypt.compareSync(String(currentPassword||''), user.password_hash)) return res.status(401).json({ error: 'Current password incorrect' });
  const hash = bcrypt.hashSync(String(newPassword), 10);
  try {
    await db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
    if (db._store) {
      const u = db._store.admin_users.find(x=>x.id===req.user.id);
      if (u) u.password_hash = hash;
      fs.writeFileSync(path.join(__dirname,'data','fallback.json'), JSON.stringify(db._store,null,2));
    }
  } catch(e){
    if (db._store) {
      const u = db._store.admin_users.find(x=>x.id===req.user.id);
      if (u) { u.password_hash = hash; fs.writeFileSync(path.join(__dirname,'data','fallback.json'), JSON.stringify(db._store,null,2)); }
    }
  }
  res.json({ ok: true });
});

// ---------- static ----------
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/admin')) return res.sendFile(path.join(__dirname, '..', 'admin', 'index.html'));
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function start() {
  try {
    await initDb();
    app.listen(PORT, ()=> {
      console.log(`[webr48] Server running on http://localhost:${PORT}`);
      console.log(`[webr48] Frontend: http://localhost:${PORT}/`);
      console.log(`[webr48] Admin:    http://localhost:${PORT}/admin  (admin / admin123)`);
      if (process.env.DATABASE_URL) console.log('[DB] Postgres persistent storage enabled');
    });
  } catch (e) {
    console.error('[DB] init failed', e);
    process.exit(1);
  }
}
start();

module.exports = app;
