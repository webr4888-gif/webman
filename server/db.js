const path = require('path');
const fs = require('fs');

let db;
let useSQLite = true;

try {
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, 'data', 'webr48.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
} catch (e) {
  console.warn('[DB] better-sqlite3 not available, falling back to JSON file store:', e.message);
  useSQLite = false;
}

// ---------- JSON fallback ----------
const jsonPath = path.join(__dirname, 'data', 'fallback.json');
function loadFallback() {
  try {
    if (fs.existsSync(jsonPath)) return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {}
  return { content: {}, media: [], leads: [], events: [], admin_users: [] };
}
function saveFallback(data) {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
}

if (!useSQLite) {
  // create in-memory wrapper mimicking needed methods
  let store = loadFallback();
  // ensure defaults exist
  const defaultContent = require('./seed-content.json');
  if (!store.content || Object.keys(store.content).length === 0) {
    store.content = defaultContent;
    saveFallback(store);
  }
  if (!store.admin_users || store.admin_users.length === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    store.admin_users = [{ id: 1, username: 'admin', password_hash: hash, created_at: new Date().toISOString() }];
    saveFallback(store);
  }
  if (!store.media || store.media.length === 0) {
    store.media = [
      { id: 1, category: 'portfolio', url: 'https://images.unsplash.com/photo-1555529771-7888783a18da?w=800&q=80', caption: 'Minimal fashion store — 3.2% conversion', sort_order: 1, created_at: new Date().toISOString() },
      { id: 2, category: 'portfolio', url: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80', caption: 'Beauty & skincare — 28 orders/day avg', sort_order: 2, created_at: new Date().toISOString() },
      { id: 3, category: 'portfolio', url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80', caption: 'Electronics niche — ₦1.2M monthly revenue', sort_order: 3, created_at: new Date().toISOString() },
      { id: 4, category: 'portfolio', url: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800&q=80', caption: 'Sneakers & streetwear — launched in 7 days', sort_order: 4, created_at: new Date().toISOString() },
      { id: 5, category: 'sales_proof', url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80', caption: 'Shopify payout — ₦847,500 (7 days)', sort_order: 1, created_at: new Date().toISOString() },
      { id: 6, category: 'sales_proof', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80', caption: 'Stripe dashboard — 142 orders this month', sort_order: 2, created_at: new Date().toISOString() },
      { id: 7, category: 'sales_proof', url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80', caption: 'Ad spend vs revenue — 3.4x ROAS', sort_order: 3, created_at: new Date().toISOString() },
    ];
    saveFallback(store);
    console.log('[DB] Seeded fallback media (7 images)');
  }

  db = {
    _store: store,
    prepare(sql) {
      const s = sql.trim().toLowerCase();
      return {
        get: (...params) => {
          if (s.includes('count(*)')) {
            if (s.includes('from content')) return { c: Object.keys(store.content).length };
            if (s.includes('from admin_users')) return { c: store.admin_users.length };
            if (s.includes('from media')) return { c: store.media.length };
            if (s.includes('from leads')) return { c: store.leads.length };
            if (s.includes('from events')) return { c: store.events.length };
            return { c: 0 };
          }
          if (s.includes('from content where key')) {
            const key = params[0];
            const v = store.content[key];
            return v !== undefined ? { value: typeof v === 'string' ? v : JSON.stringify(v), key } : undefined;
          }
          if (s.includes('from media where id')) {
            const id = params[0];
            return store.media.find(m=>m.id===id);
          }
          if (s.includes('from admin_users where username')) {
            return store.admin_users.find(u => u.username === params[0]);
          }
          if (s.includes('from admin_users where id')) {
            return store.admin_users.find(u => u.id === params[0]);
          }
          if (s.includes('from leads where id')) {
            return store.leads.find(l => l.id === params[0]);
          }
          return undefined;
        },
        all: (...params) => {
          if (s.includes('from content')) {
            return Object.entries(store.content).map(([k, v]) => ({ key: k, value: typeof v === 'string' ? v : JSON.stringify(v) }));
          }
          if (s.includes('from media')) {
            let rows = [...store.media].sort((a,b)=>a.sort_order-b.sort_order);
            if (s.includes("where category")) {
              const cat = params[0];
              rows = rows.filter(r=>r.category===cat);
            }
            return rows;
          }
          if (s.includes('from leads')) {
            return [...store.leads].sort((a,b)=> new Date(b.created_at)-new Date(a.created_at));
          }
          if (s.includes('from events')) {
            return [...store.events];
          }
          return [];
        },
        run: (...params) => {
          if (s.startsWith('insert or replace into content') || s.startsWith('insert into content')) {
            const [key, value] = params;
            try { store.content[key] = JSON.parse(value); } catch { store.content[key] = value; }
            saveFallback(store);
            return { changes: 1 };
          }
          if (s.startsWith('insert into media')) {
            const [category, url, caption, sort_order] = params;
            const id = store.media.length ? Math.max(...store.media.map(m=>m.id))+1 : 1;
            store.media.push({ id, category, url, caption, sort_order, created_at: new Date().toISOString() });
            saveFallback(store);
            return { lastInsertRowid: id, changes: 1 };
          }
          if (s.startsWith('delete from media where id')) {
            const id = params[0];
            const before = store.media.length;
            store.media = store.media.filter(m=>m.id!==id);
            saveFallback(store);
            return { changes: before - store.media.length };
          }
          if (s.includes('update media set sort_order')) {
            const [order, id] = params;
            const m = store.media.find(x=>x.id===id);
            if (m) m.sort_order = order;
            saveFallback(store);
            return { changes: 1 };
          }
          if (s.startsWith('insert into leads')) {
            const [name, storeName, budget, storeStatus, wasScammed, scamDetails, whatsapp, email, source, consent, pageUrl, webhook_status] = params;
            const id = store.leads.length ? Math.max(...store.leads.map(l=>l.id))+1 : 1;
            const lead = { id, name, store_name: storeName, budget, store_status: storeStatus, was_scammed: wasScammed, scam_details: scamDetails, whatsapp, email, source, consent: consent?1:0, page_url: pageUrl, webhook_status, status: 'new', created_at: new Date().toISOString(), submitted_at: new Date().toISOString() };
            store.leads.push(lead);
            saveFallback(store);
            return { lastInsertRowid: id, changes: 1 };
          }
          if (s.includes('update leads set webhook_status')) {
            const [ws, id] = params;
            const l = store.leads.find(x=>x.id===id);
            if (l) l.webhook_status = ws;
            saveFallback(store);
            return { changes: 1 };
          }
          if (s.includes('update leads set status')) {
            const [st, id] = params;
            const l = store.leads.find(x=>x.id===id);
            if (l) l.status = st;
            saveFallback(store);
            return { changes: 1 };
          }
          if (s.startsWith('insert into events')) {
            const [event_type, element_id, session_id, page_url, meta] = params;
            const id = store.events.length ? Math.max(...store.events.map(e=>e.id))+1 : 1;
            store.events.push({ id, event_type, element_id, session_id, page_url, meta, created_at: new Date().toISOString() });
            saveFallback(store);
            return { lastInsertRowid: id, changes: 1 };
          }
          if (s.includes('update admin_users set password_hash')) {
            const [hash, id] = params;
            const u = store.admin_users.find(x=>x.id===id);
            if (u) u.password_hash = hash;
            saveFallback(store);
            return { changes: 1 };
          }
          if (s.includes('select count(*)')) {
            // fallback for COUNT queries — return via get not all, so handle in get too
            return { changes: 0 };
          }
          return { changes: 0 };
        }
      };
    },
    exec(sql) {
      // no-op for fallback; tables already "exist"
    },
    pragma() {}
  };
}

function initDb() {
  if (!useSQLite) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS content (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      url TEXT NOT NULL,
      caption TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      store_name TEXT NOT NULL,
      budget TEXT NOT NULL,
      store_status TEXT NOT NULL,
      was_scammed TEXT NOT NULL,
      scam_details TEXT,
      whatsapp TEXT NOT NULL,
      email TEXT NOT NULL,
      source TEXT,
      consent INTEGER DEFAULT 0,
      page_url TEXT,
      webhook_status TEXT DEFAULT 'pending',
      status TEXT DEFAULT 'new',
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      element_id TEXT,
      session_id TEXT,
      page_url TEXT,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // seed content
  const seed = require('./seed-content.json');
  const existing = db.prepare('SELECT COUNT(*) as c FROM content').get();
  if (existing.c === 0) {
    const stmt = db.prepare('INSERT OR REPLACE INTO content (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(seed)) {
      stmt.run(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  }
  // seed admin
  const adminCount = db.prepare('SELECT COUNT(*) as c FROM admin_users').get();
  if (adminCount.c === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', hash);
    console.log('[DB] Default admin created: admin / admin123 — CHANGE THIS IN PRODUCTION');
  }
  // seed media if empty
  const mediaCount = db.prepare('SELECT COUNT(*) as c FROM media').get();
  if (mediaCount.c === 0) {
    const ins = db.prepare('INSERT INTO media (category, url, caption, sort_order) VALUES (?, ?, ?, ?)');
    const portfolio = [
      ['portfolio', 'https://images.unsplash.com/photo-1555529771-7888783a18da?w=800&q=80', 'Minimal fashion store — 3.2% conversion', 1],
      ['portfolio', 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80', 'Beauty & skincare — 28 orders/day avg', 2],
      ['portfolio', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80', 'Electronics niche — ₦1.2M monthly revenue', 3],
      ['portfolio', 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800&q=80', 'Sneakers & streetwear — launched in 7 days', 4],
      ['sales_proof', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80', 'Shopify payout — ₦847,500 (7 days)', 1],
      ['sales_proof', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80', 'Stripe dashboard — 142 orders this month', 2],
      ['sales_proof', 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80', 'Ad spend vs revenue — 3.4x ROAS', 3],
    ];
    for (const r of portfolio) ins.run(...r);
  }
}

module.exports = { db, initDb, useSQLite };
