# AI Agency CRM

Egyszerű, saját CRM AI ügynökségeknek: ügyfelek, kapcsolattartók, niche, szolgáltatás és státusz nyomon követése. Sötét, fekete–szürke–lila kinézettel.

## Funkciók
- Ügyfelek listázása táblázatban (cégnév, kapcsolattartó, email, telefon, niche, szolgáltatás, státusz)
- Keresés bármelyik mezőben
- Szűrés státusz szerint
- Új ügyfél felvétele, meglévő szerkesztése/törlése (kattints egy sorra)
- Státuszok: Érdeklődő → Ajánlat kiküldve → Tárgyalás alatt → Aktív ügyfél → Szüneteltetve → Lezárva / Elveszett
  (ezek a `server.js` tetején, a `STATUSES` tömbben szabadon átírhatók)

## Helyi futtatás
```bash
npm install
npm start
```
Ezután nyisd meg: http://localhost:3000

## Telepítés Render.com-ra
1. Told fel ezt a mappát egy GitHub repóba.
2. Render.com → **New +** → **Blueprint**, majd válaszd ki a repót (a `render.yaml` fájlt automatikusan felismeri).
   - Ha inkább kézzel hoznád létre: **New +** → **Web Service**, Build command: `npm install`, Start command: `npm start`.
3. **Fontos:** adj hozzá egy **Persistent Disk**-et `/data` mountPath-szel (a `render.yaml` ezt már tartalmazza), különben minden újratelepítéskor elveszik az adatbázis, mivel az ingyenes Render szolgáltatásoknak nincs alapból tartós tárhelyük.
4. Deploy után a szolgáltatás saját URL-en lesz elérhető (pl. `https://ai-agency-crm.onrender.com`).

## Technikai részletek
- Backend: Node.js + Express
- Adatbázis: SQLite (`better-sqlite3`), fájlban tárolva a `/data/crm.db` útvonalon
- Frontend: sima HTML/CSS/JS, nincs build lépés
- Nincs bejelentkezés/jogosultságkezelés — ha publikusan lenne elérhető, érdemes később alap jelszavas védelmet vagy Render "Private Service" beállítást hozzáadni

## Bővítési ötletek
- Több felhasználó / bejelentkezés
- Ügyfél-történet / interakciós napló (hívások, emailek dátuma)
- Automatikus emlékeztetők lejáró ajánlatokhoz
- Export CSV-be
