# AI Agency CRM

Egyszerű, saját CRM AI ügynökségeknek: ügyfelek, kapcsolattartók, niche, szolgáltatás és státusz nyomon követése. Sötét, fekete–szürke–lila kinézettel.

## Funkciók
- Ügyfelek listázása (cégnév, kapcsolattartó, email, telefon, niche, szolgáltatás, státusz); tableten és telefonon kártyás nézet
- Keresés cégnév, kapcsolattartó, email, niche és szolgáltatás alapján
- Szűrés státusz szerint
- Új ügyfél felvétele, meglévő szerkesztése/törlése (kattints egy sorra)
- Jelszavas belépés
- Státuszok: Érdeklődő → Ajánlat kiküldve → Tárgyalás alatt → Aktív ügyfél → Szüneteltetve → Lezárva / Elveszett
  (ezek a `server.js`-ben, a `STATUSES` listában átírhatók; a régi státuszú ügyfelek ettől nem vesztik el a státuszukat)

## Hogyan épül fel
- **GitHub**: itt van a kód.
- **Render.com**: futtatja a szervert (Node.js + Express), és innen érhető el a CRM.
- **Supabase**: itt vannak az adatok (Postgres adatbázis). A `clients` táblát a szerver magától létrehozza.

## Beállítások a Renderen (Environment fül)
| Változó | Kötelező | Mire való |
| --- | --- | --- |
| `DATABASE_URL` | igen | A Supabase **Session pooler** kapcsolati címe (Connect → Session pooler → URI), benne a jelszóval, szögletes zárójelek nélkül |
| `CRM_PASSWORD` | igen | Ezzel a jelszóval lehet belépni a CRM-be. Ha nincs beállítva, a CRM zárolva marad. |
| `CRM_USER` | nem | Belépési felhasználónév, alapból `admin` |

Belépéskor a böngésző kéri a felhasználónevet és a jelszót.

## Ha valami nem működik
- **„Az adatbázis most nem érhető el”**: az ingyenes Supabase-projekt szünetel, ha egy hétig nincs elég forgalom. A supabase.com-on nyisd meg a projektet, és kattints a **Resume project** gombra (az adatok megmaradnak).
- **„Az adatbázis elutasította a belépést”**: ha megváltoztattad a Supabase jelszavát, írd be az újat a `DATABASE_URL`-be is.
- **„A CRM zárolva van”**: hiányzik a `CRM_PASSWORD` a Renderen.
- A Render ingyenes csomagjában a szerver 15 perc tétlenség után elalszik; ilyenkor az első betöltés fél–egy percig tarthat.

## Technikai részletek
- Backend: Node.js + Express, `pg` csomag
- Adatbázis: Postgres (Supabase), sorszintű védelemmel (RLS), hogy a Supabase nyilvános API-ján ne legyen olvasható
- Frontend: sima HTML/CSS/JS, nincs build lépés

## Bővítési ötletek
- Ügyfél-történet / interakciós napló (hívások, emailek dátuma)
- Automatikus emlékeztetők lejáró ajánlatokhoz
- Export CSV-be
- Potenciális ügyfelek automatikus felkutatása
