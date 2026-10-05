const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// A Supabase kapcsolati stringjét a Renderen a DATABASE_URL
// környezeti változóban kell megadni.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
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
  console.log('Adatbázis tábla kész');
}

const STATUSES = [
  'Érdeklődő',
  'Ajánlat kiküldve',
  'Tárgyalás alatt',
  'Aktív ügyfél',
  'Szüneteltetve',
  'Lezárva / Elveszett'
];

app.get('/api/statuses', (req, res) => {
  res.json(STATUSES);
});

app.get('/api/clients', async (req, res) => {
  try {
    const { q, status } = req.query;
    let sql = 'SELECT * FROM clients WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    if (q) {
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
      const base = params.length - 4;
      sql += ` AND (company_name ILIKE $${base + 1} OR contact_name ILIKE $${base + 2} OR email ILIKE $${base + 3} OR niche ILIKE $${base + 4} OR service ILIKE $${base + 5})`;
    }
    sql += ' ORDER BY updated_at DESC';

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Szerver hiba' });
  }
});

app.get('/api/clients/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nincs ilyen ügyfél' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Szerver hiba' });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const { company_name, contact_name, email, phone, niche, service, status, notes } = req.body;
    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ error: 'A vállalkozás neve kötelező' });
    }
    const result = await pool.query(
      `INSERT INTO clients (company_name, contact_name, email, phone, niche, service, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        company_name.trim(),
        contact_name || '',
        email || '',
        phone || '',
        niche || '',
        service || '',
        status || STATUSES[0],
        notes || ''
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Szerver hiba' });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const existingResult = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (existingResult.rows.length === 0) return res.status(404).json({ error: 'Nincs ilyen ügyfél' });
    const existing = existingResult.rows[0];

    const fields = ['company_name', 'contact_name', 'email', 'phone', 'niche', 'service', 'status', 'notes'];
    const updated = { ...existing };
    fields.forEach(f => {
      if (req.body[f] !== undefined) updated[f] = req.body[f];
    });

    const result = await pool.query(
      `UPDATE clients SET
        company_name = $1, contact_name = $2, email = $3, phone = $4,
        niche = $5, service = $6, status = $7, notes = $8, updated_at = now()
       WHERE id = $9 RETURNING *`,
      [
        updated.company_name, updated.contact_name, updated.email, updated.phone,
        updated.niche, updated.service, updated.status, updated.notes, req.params.id
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Szerver hiba' });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Nincs ilyen ügyfél' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Szerver hiba' });
  }
});

const PORT = process.env.PORT || 3000;
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`AI Agency CRM fut a ${PORT} porton`);
    });
  })
  .catch(err => {
    console.error('Nem sikerült kapcsolódni az adatbázishoz:', err);
    process.exit(1);
  });
