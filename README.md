# Ordini Laboratorio Online

Versione online multiutente con:
- login con **username + password**
- ruoli: **admin, ufficio, agente, laboratorio**
- admin può creare utenti
- admin e ufficio possono creare/gestire prodotti
- ordini condivisi tra più utenti contemporaneamente
- ordini multi-riga
- prodotti univoci per ordine
- categoria bloccata sul primo prodotto
- priorità ordine
- PDF ordine e PDF bolla

## 1. Requisiti
- Node.js 20+
- un progetto Supabase

## 2. Configurazione Supabase
Crea un progetto Supabase e poi esegui lo script SQL contenuto in:
- `supabase/schema.sql`

## 3. Variabili ambiente
Copia `.env.example` in `.env.local` e compila:
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4. Crea il primo admin
Dopo aver configurato `.env.local`, esegui:

```bash
npm install
npm run create-admin
```

Questo crea il primo utente admin usando:
- `SEED_ADMIN_USERNAME`
- `SEED_ADMIN_PASSWORD`
- `SEED_ADMIN_FULL_NAME`

## 5. Avvio locale
```bash
npm run dev
```

Poi apri il browser su:
```bash
http://localhost:3000
```

## 6. Deployment
Puoi pubblicarla su:
- Vercel
- Railway
- qualsiasi hosting Node.js

## 7. Note
- Il login è gestito internamente all'app, non tramite Supabase Auth.
- La password viene salvata come hash bcrypt.
- Tutte le operazioni sul database passano dal backend Next.js.
- Il database è condiviso, quindi più utenti possono usare l'app contemporaneamente.

## 8. Tabelle principali
- `app_users`
- `products`
- `orders`
- `order_lines`
