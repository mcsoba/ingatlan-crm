# Ingatlan CRM

AI-alapú CRM ingatlanos ügynököknek és irodáknak (Next.js + Supabase + Claude API).
Ideiglenes munkacím — a végleges márkanév/domain még nincs eldöntve.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind)
- **Supabase** (Postgres, Auth, Row Level Security, Realtime, Storage) — multi-tenant adatréteg
- **Anthropic Claude API** (`claude-haiku-4-5`) — AI-funkciókhoz (ingatlanleírás, follow-up draft)

## Első indítás

1. Hozz létre egy új projektet a [supabase.com](https://supabase.com) oldalon.
2. Az SQL Editorban futtasd le sorban a `supabase/migrations/` alatti fájlokat (jelenleg: `0001_agencies_and_profiles.sql`).
3. Project Settings → API alatt másold ki a Project URL-t és az anon key-t.
4. Másold `.env.local.example`-t `.env.local` névre, töltsd ki:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY` (csak a 4. fejlesztési szelettől szükséges)
5. Fejlesztés közbeni gyorsításhoz kapcsold ki az email-megerősítést: Supabase Dashboard → Authentication → Providers → Email → "Confirm email" kikapcsolva. Éles környezetben ezt vissza kell kapcsolni.
6. `npm install`
7. `npm run dev` → http://localhost:3000

## Projekt struktúra

- `src/app/` — oldalak (landing, `/login`, `/signup`, `/dashboard`, `/auth/callback`)
- `src/lib/supabase/` — Supabase kliens-utilok (browser/server/proxy)
- `src/lib/agency.ts` — bejelentkezett felhasználó profiljának/ügynökségének betöltése, első belépéskor az ügynökség automatikus létrehozása
- `src/proxy.ts` — session-frissítés + `/dashboard` védelme (Next.js 16-ban ez a `middleware.ts` utódja)
- `supabase/migrations/` — adatbázis-séma és RLS-policy-k, sorrendben futtatandó

## Fejlesztési státusz

Lásd a projekt tervét: 1. szelet (auth + agency onboarding) kész. Következő: contacts + properties CRUD.
