-- Számlázz.hu Számla Agent: kimenő számla / díjbekérő kiállítása közvetlenül a CRM-ből.
-- Cégenként egy Agent-kulcs (Számlázz.hu → Beállítások → Számla Agent kulcsok).
-- A kulcs titok: a tábla RLS-sel le van zárva és NINCS rá policy, így a böngésző
-- (anon / bejelentkezett kliens) se olvasni, se írni nem tudja — csak a szerver
-- éri el a service-role klienssel, irodavezetői jogosultság-ellenőrzés után.

create table public.finance_company_szamlazz (
  company_id uuid primary key references public.finance_companies (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  agent_key text not null,
  key_hint text,                         -- a kulcs utolsó 4 karaktere, a felületen ez látszik
  invoice_prefix text,                   -- számlaszám-előtag (pl. WRKR), üresen a fiók alapértelmezése
  e_invoice boolean not null default true,  -- e-számla (PDF, hitelesített) vagy papír alapú
  updated_at timestamptz not null default now()
);

create index finance_company_szamlazz_agency_idx on public.finance_company_szamlazz (agency_id);

alter table public.finance_company_szamlazz enable row level security;
-- szándékosan nincs policy

-- Dupla kiállítás elleni zár: a kérés indításakor beírt időpont (sikeres válasz
-- után a számlaszám kerül be, hiba esetén visszaáll null-ra).
alter table public.finance_invoices
  add column szamlazz_requested_at timestamptz;
