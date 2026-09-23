# Ingatlan CRM

AI-alapú CRM ingatlanos ügynököknek és irodáknak (Next.js + Supabase + Claude API).
Ideiglenes munkacím — a végleges márkanév/domain még nincs eldöntve.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind)
- **Supabase** (Postgres, Auth, Row Level Security, Realtime, Storage) — multi-tenant adatréteg
- **Anthropic Claude API** (`claude-haiku-4-5`) — AI-funkciókhoz (ingatlanleírás, follow-up draft)

## Első indítás (fejlesztés)

1. Hozz létre egy új projektet a [supabase.com](https://supabase.com) oldalon.
2. Az SQL Editorban futtasd le sorban a `supabase/migrations/` alatti fájlokat (jelenleg 36 db, `0001`-től `0036`-ig — mindegyiket egyenként, sorrendben).
3. Project Settings → API alatt másold ki a Project URL-t és az anon + service_role key-eket.
4. Hozz létre egy `.env.local` fájlt a projekt gyökerében, töltsd ki (ld. a teljes listát + prioritásokat lejjebb, az "Éles telepítés" szekcióban).
5. Fejlesztés közbeni gyorsításhoz kapcsold ki az email-megerősítést: Supabase Dashboard → Authentication → Providers → Email → "Confirm email" kikapcsolva. **Éles környezetben ezt vissza kell kapcsolni** (ld. lejjebb).
6. `npm install`
7. `npm run dev` → http://localhost:3000

## Projekt struktúra

- `src/app/` — oldalak (landing, `/login`, `/signup`, `/dashboard`, `/auth/callback`)
- `src/lib/supabase/` — Supabase kliens-utilok (browser/server/proxy/admin)
- `src/lib/agency.ts` — bejelentkezett felhasználó profiljának/ügynökségének betöltése, első belépéskor az ügynökség automatikus létrehozása
- `src/proxy.ts` — session-frissítés + `/dashboard` védelme (Next.js 16-ban ez a `middleware.ts` utódja)
- `supabase/migrations/` — adatbázis-séma és RLS-policy-k, sorrendben futtatandó

## Éles telepítés (Vercel)

A projekt eddig kizárólag `localhost:3000`-en futott. Ez a checklist a tényleges élesítéshez.

### 1. Supabase

A meglévő dev Supabase-projekt (minden migráció már lefutott rajta) újrahasználható élesnek is — nem kell külön prod projektet indítani, csak a teszt-adatokat (pl. "Teszt Attachment Iroda" fiók) kell kitakarítani, mielőtt valódi ügyfelek regisztrálnak.

### 2. Vercel import

[vercel.com/new](https://vercel.com/new) → a `github.com/mcsoba/ingatlan-crm` repo importálása. A framework Next.js-ként automatikusan felismerésre kerül, build-parancs módosítás nem szükséges (`npm run build` már zöld).

### 3. Környezeti változók (Vercel → Settings → Environment Variables)

| Prioritás | Változó | Miért |
|---|---|---|
| **Kötelező** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `ANTHROPIC_API_KEY` | Ezek nélkül semmi nem működik — alap adatréteg + AI-funkciók |
| **Hamarosan ajánlott** | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET` | Follow-up email, kampányok, napi digest |
| **Ráér** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | SMS, naptár-szinkron, előfizetés-kezelés — hiányukban az app barátságos "nincs beállítva" üzenetet mutat, nem crashel. A Stripe-ra kifejezetten csak akkor van szükség, ha külső (fizető) ügyfelek is lesznek. |

`NEXT_PUBLIC_SITE_URL`-t a tényleges Vercel-URL (vagy egyedi domain) ismeretében kell kitölteni — ez a Google OAuth redirect és a publikus linkek (pl. `/p/[propertyId]`) alapja. Az egyes kulcsok pontos beszerzési helyéhez (mely dashboard, milyen lépések) ld. a `.env.local.example` fájl kommentjeit — az fel van fűzve mind a 15 változóra.

### 4. Cron-gyakoriság (`vercel.json`)

6 cron-bejegyzés van, ebből több 30 perc–4 óránként fut (naptár-szinkron, SMS-emlékeztető, drip-kampány). A Vercel **Hobby (ingyenes) csomag ezt nem engedi** — max 2 cron, napi 1x. Két lehetőség, döntés még nyitott:
- **Vercel Pro** ($20/hó) — a jelenlegi gyakoriságok megmaradnak.
- **`vercel.json` átírása napi 1x-es cronokra** — ingyenes marad, de a "valós idejű" élmény (pl. 30 percenkénti naptár-szinkron) elvész.

### 5. Élesítés utáni teendők

- Supabase email-megerősítés visszakapcsolása (Authentication → Providers → Email → "Confirm email").
- Teszt-adatok törlése ("Teszt Attachment Iroda" fiók és tartalma).
- Első valódi ügynökségek (pl. Bluegate Housing, Interprop) regisztrálása és meglévő ingatlan/kontakt adataik bevitele (CSV import mindkét listánál elérhető: Kontaktok/Ingatlanok oldal → "Importálás CSV-ből", elvárt fejléc az Ingatlanoknál `address,price,size_sqm,status,notes`).
