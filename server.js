const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');

const app = express();

// ---------------------------------------------------------------
// Jelszavas védelem
// A Renderen az Environment fülön állítsd be:
//   CRM_PASSWORD  - ezzel a jelszóval lehet belépni (kötelező)
//   CRM_USER      - felhasználónév (nem kötelező, alapból: admin)
// ---------------------------------------------------------------
const CRM_USER = process.env.CRM_USER || 'admin';
const CRM_PASSWORD = process.env.CRM_PASSWORD || '';

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function requireLogin(req, res, next) {
  if (!CRM_PASSWORD) {
    return res
      .status(503)
      .type('text/plain; charset=utf-8')
      .send('A CRM zárolva van, mert nincs beállítva jelszó. A Renderen az Environment fülön adj hozzá egy CRM_PASSWORD nevű változót, és mentsd el.');
  }
  const match = /^Basic\s+(.+)$/i.exec(req.headers.authorization || '');
  if (match) {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    if (sep !== -1) {
      const userOk = safeEqual(decoded.slice(0, sep), CRM_USER);
      const passOk = safeEqual(decoded.slice(sep + 1), CRM_PASSWORD);
      if (userOk && passOk) return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="AI Agency CRM", charset="UTF-8"');
  res.status(401).type('text/plain; charset=utf-8').send('Bejelentkezés szükséges.');
}

app.use(requireLogin);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------
// Adatbázis (Supabase)
// A kapcsolati adatokat a Renderen a DATABASE_URL változó tartalmazza.
// ---------------------------------------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

// Ha a Supabase lezár egy épp nem használt kapcsolatot, a pg "error" eseményt küld.
// Kezelés nélkül ettől az egész szerver leállna.
pool.on('error', (err) => {
  console.error('Megszakadt egy nem használt adatbázis-kapcsolat:', err.message);
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      company_name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      niche TEXT,
      service TEXT,
      status TEXT NOT NULL DEFAULT 'Érdeklődő',
      notes TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );
  `);
  // Sorszintű védelem (RLS): így a Supabase nyilvános Data API-ján keresztül
  // senki nem tudja olvasni a táblát. A szerver továbbra is eléri,
  // mert ő a tábla tulajdonosa.
  try {
    await pool.query('ALTER TABLE clients ENABLE ROW LEVEL SECURITY');
  } catch (err) {
    console.warn('Nem sikerült bekapcsolni a sorszintű védelmet (RLS):', err.message);
  }
  console.log('Adatbázis tábla kész');
}

// Az adatbázist az első kéréskor készíti elő. Ha nem sikerül (pl. a Supabase
// szünetel), a szerver nem áll le, hanem a következő kérésnél újrapróbálja.
let dbReady = null;
function ensureDb() {
  if (!dbReady) {
    dbReady = initDb().catch((err) => {
      dbReady = null;
      throw err;
    });
  }
  return dbReady;
}

const MSG_DB_DOWN = 'Az adatbázis most nem érhető el. Ha napok óta nem használtad a CRM-et, a Supabase valószínűleg szüneteltette a projektet: lépj be a supabase.com-on, nyisd meg a projektet, és kattints a "Resume project" gombra. Pár perc múlva frissítsd ezt az oldalt.';
const MSG_DB_LOGIN = 'Az adatbázis elutasította a belépést. Ha megváltoztattad a Supabase jelszavát, írd be az újat a Renderen a DATABASE_URL-be is.';

function sendError(res, err) {
  console.error(err);
  const code = String((err && err.code) || '');
  const message = String((err && err.message) || '');
  if (code === '28P01' || code === '28000' || /password authentication failed/i.test(message)) {
    return res.status(503).json({ error: MSG_DB_LOGIN });
  }
  if (/^E[A-Z]+$/.test(code) || /^(08|53|57P)/.test(code) || /tenant or user not found|terminat|timeout|connect/i.test(message)) {
    return res.status(503).json({ error: MSG_DB_DOWN });
  }
  return res.status(500).json({ error: 'Váratlan szerverhiba. Próbáld újra, és ha ismétlődik, nézd meg a Render logot.' });
}

app.use('/api/clients', async (req, res, next) => {
  try {
    await ensureDb();
  } catch (err) {
    return sendError(res, err);
  }
  next();
});

const STATUSES = [
  'Érdeklődő',
  'Ajánlat kiküldve',
  'Tárgyalás alatt',
  'Aktív ügyfél',
  'Szüneteltetve',
  'Lezárva / Elveszett'
];

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

app.get('/api/statuses', (req, res) => {
  res.json(STATUSES);
});

app.get('/api/clients', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const conditions = [];
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (q) {
      // A % és _ jelet szó szerint keresi, ne helyettesítő karakterként
      params.push('%' + q.replace(/[\\%_]/g, '\\$&') + '%');
      const p = '$' + params.length;
      conditions.push(`(company_name ILIKE ${p} OR contact_name ILIKE ${p} OR email ILIKE ${p} OR niche ILIKE ${p} OR service ILIKE ${p})`);
    }

    let sql = 'SELECT * FROM clients';
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY updated_at DESC';

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/clients/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Nincs ilyen ügyfél' });
    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nincs ilyen ügyfél' });
    res.json(result.rows[0]);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const body = req.body || {};
    const companyName = str(body.company_name);
    if (!companyName) {
      return res.status(400).json({ error: 'A vállalkozás neve kötelező' });
    }
    const status = STATUSES.includes(body.status) ? body.status : STATUSES[0];
    const result = await pool.query(
      `INSERT INTO clients (company_name, contact_name, email, phone, niche, service, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        companyName,
        str(body.contact_name),
        str(body.email),
        str(body.phone),
        str(body.niche),
        str(body.service),
        status,
        str(body.notes)
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    sendError(res, err);
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Nincs ilyen ügyfél' });
    const existingResult = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) return res.status(404).json({ error: 'Nincs ilyen ügyfél' });

    const body = req.body || {};
    const updated = { ...existingResult.rows[0] };
    ['company_name', 'contact_name', 'email', 'phone', 'niche', 'service', 'notes'].forEach((f) => {
      if (body[f] !== undefined) updated[f] = str(body[f]);
    });
    // Csak a listában szereplő státusz menthető; más érték esetén a régi marad
    if (STATUSES.includes(body.status)) updated.status = body.status;
    if (!updated.company_name) {
      return res.status(400).json({ error: 'A vállalkozás neve kötelező' });
    }

    const result = await pool.query(
      `UPDATE clients SET
        company_name = $1, contact_name = $2, email = $3, phone = $4,
        niche = $5, service = $6, status = $7, notes = $8, updated_at = now()
       WHERE id = $9 RETURNING *`,
      [
        updated.company_name, updated.contact_name, updated.email, updated.phone,
        updated.niche, updated.service, updated.status, updated.notes, id
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    sendError(res, err);
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Nincs ilyen ügyfél' });
    const result = await pool.query('DELETE FROM clients WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Nincs ilyen ügyfél' });
    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Agency CRM fut a ${PORT} porton`);
  if (!CRM_PASSWORD) {
    console.warn('FIGYELEM: nincs beállítva CRM_PASSWORD, ezért a CRM zárolva van.');
  }
  ensureDb().catch((err) => {
    console.error('Most nem sikerült kapcsolódni az adatbázishoz, a következő kérésnél újrapróbálom:', err.message);
  });
});
