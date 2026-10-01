const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Adatbázis helye: Render "Persistent Disk"-et /data útvonalra érdemes csatolni,
// hogy az adatok újratelepítés (deploy) után is megmaradjanak.
// Ha nincs /data mappa (pl. helyi futtatásnál), akkor a projekt mappájába ír.
const DATA_DIR = fs.existsSync('/data') ? '/data' : __dirname;
const DB_PATH = path.join(DATA_DIR, 'crm.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    niche TEXT,
    service TEXT,
    status TEXT NOT NULL DEFAULT 'Érdeklődő',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

const STATUSES = [
  'Érdeklődő',
  'Ajánlat kiküldve',
  'Tárgyalás alatt',
  'Aktív ügyfél',
  'Szüneteltetve',
  'Lezárva / Elveszett'
];

// --- API végpontok ---

// Elérhető státuszok lekérése (a frontend legördülő menüjéhez)
app.get('/api/statuses', (req, res) => {
  res.json(STATUSES);
});

// Összes ügyfél lekérése (kereséssel és státusz szerinti szűréssel)
app.get('/api/clients', (req, res) => {
  const { q, status } = req.query;
  let sql = 'SELECT * FROM clients WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (q) {
    sql += ` AND (company_name LIKE ? OR contact_name LIKE ? OR email LIKE ? OR niche LIKE ? OR service LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  sql += ' ORDER BY updated_at DESC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Egy ügyfél lekérése
app.get('/api/clients/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Nincs ilyen ügyfél' });
  res.json(row);
});

// Új ügyfél létrehozása
app.post('/api/clients', (req, res) => {
  const { company_name, contact_name, email, phone, niche, service, status, notes } = req.body;
  if (!company_name || !company_name.trim()) {
    return res.status(400).json({ error: 'A vállalkozás neve kötelező' });
  }
  const stmt = db.prepare(`
    INSERT INTO clients (company_name, contact_name, email, phone, niche, service, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    company_name.trim(),
    contact_name || '',
    email || '',
    phone || '',
    niche || '',
    service || '',
    status || STATUSES[0],
    notes || ''
  );
  const created = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// Ügyfél módosítása
app.put('/api/clients/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Nincs ilyen ügyfél' });

  const fields = ['company_name', 'contact_name', 'email', 'phone', 'niche', 'service', 'status', 'notes'];
  const updated = { ...existing };
  fields.forEach(f => {
    if (req.body[f] !== undefined) updated[f] = req.body[f];
  });

  db.prepare(`
    UPDATE clients SET
      company_name = ?, contact_name = ?, email = ?, phone = ?,
      niche = ?, service = ?, status = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    updated.company_name, updated.contact_name, updated.email, updated.phone,
    updated.niche, updated.service, updated.status, updated.notes, req.params.id
  );

  const result = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  res.json(result);
});

// Ügyfél törlése
app.delete('/api/clients/:id', (req, res) => {
  const result = db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Nincs ilyen ügyfél' });
  res.status(204).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Agency CRM fut a ${PORT} porton (adatbázis: ${DB_PATH})`);
});
