import {
  CheckCircle2,
  CircleAlert,
  Sparkles,
  CreditCard,
  Mail,
  MessageSquare,
  CalendarDays,
  UserRound,
  Building2,
  Link2,
  Webhook,
  Download,
  Shuffle,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import {
  disconnectGoogleCalendar,
  updateAgencyBranding,
  updateAgencyPublicSlug,
  updateAgencyWebhook,
  updateAutoAssignLeads,
  updateMyName,
} from "./actions";
import { ACCENT_PRESETS, getAccentPreset } from "@/lib/accent-presets";
import { MfaPanel } from "./mfa-panel";
import { PasswordPanel } from "./password-panel";
import { PageHeader } from "@/components/ui/page-header";
import { PRIVATE_EDITION } from "@/lib/edition";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { inputClass, labelClass, fieldGroupClass } from "@/components/ui/styles";

type Integration = {
  key: string;
  name: string;
  icon: typeof Sparkles;
  description: string;
  whatBreaks: string;
  configured: boolean;
  setupUrl: string;
  setupLabel: string;
};

const TABS = [
  { id: "profil", label: "Profil" },
  { id: "iroda", label: "Iroda" },
  { id: "integraciok", label: "Integrációk" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; google?: string; tab?: string }>;
}) {
  const { error, google, tab } = await searchParams;
  const activeTab: TabId = TABS.some((t) => t.id === tab) ? (tab as TabId) : "profil";
  const { user, profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data: mfaFactors } = await supabase.auth.mfa.listFactors();
  const verifiedMfaFactor = mfaFactors?.totp.find((f) => f.status === "verified") ?? null;

  const [{ data: googleConnection }, { data: agencyBranding }] = await Promise.all([
    supabase
      .from("google_calendar_connections")
      .select("connected_at")
      .eq("profile_id", profile.id)
      .maybeSingle(),
    supabase
      .from("agencies")
      .select("logo_path, accent_preset, slug, lead_webhook_url, auto_assign_leads")
      .eq("id", profile.agency_id)
      .single(),
  ]);

  const logoUrl = agencyBranding?.logo_path
    ? supabase.storage.from("agency-logos").getPublicUrl(agencyBranding.logo_path).data.publicUrl
    : null;
  const currentPreset = getAccentPreset(agencyBranding?.accent_preset);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const catalogUrl = `${siteUrl}/a/${agencyBranding?.slug ?? ""}`;

  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  const integrations: Integration[] = [
    {
      key: "anthropic",
      name: "AI-funkciók (Claude)",
      icon: Sparkles,
      description:
        "Ingatlanleírás-generálás, lead-pontozás, follow-up email/SMS vázlat, „Kérdezd a CRM-et” asszisztens.",
      whatBreaks: "Az összes Sparkles-ikonos AI-gomb hibát ad.",
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
      setupUrl: "https://platform.claude.com/settings/billing",
      setupLabel: "platform.claude.com",
    },
    {
      key: "stripe",
      name: "Stripe (előfizetés)",
      icon: CreditCard,
      description: "A Pro csomagra váltás, számlázás és előfizetés-kezelés a /dashboard/billing oldalon.",
      whatBreaks: "\"Frissítés Pro-ra\" gombra kattintva barátságos hibaüzenet jelenik meg, de a fizetés nem működik.",
      configured: Boolean(process.env.STRIPE_SECRET_KEY),
      setupUrl: "https://dashboard.stripe.com/test/apikeys",
      setupLabel: "dashboard.stripe.com",
    },
    {
      key: "resend",
      name: "Resend (email-küldés)",
      icon: Mail,
      description:
        "Follow-up email tényleges elküldése, új lead értesítés, napi összefoglaló, email-kampányok (drip).",
      whatBreaks: "Az email-küldő gombok és a napi/kampány-cron barátságos hibaüzenetet ad, de nem küld.",
      configured: Boolean(process.env.RESEND_API_KEY),
      setupUrl: "https://resend.com/api-keys",
      setupLabel: "resend.com",
    },
    {
      key: "twilio",
      name: "Twilio (SMS-küldés)",
      icon: MessageSquare,
      description: "Gyors SMS kontaktnak, csapat SMS-értesítés új leadről, megtekintés-emlékeztető SMS.",
      whatBreaks: "Az SMS-küldő gombok és az emlékeztető-cron barátságos hibaüzenetet ad, de nem küld.",
      configured: Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
          process.env.TWILIO_AUTH_TOKEN &&
          process.env.TWILIO_FROM_NUMBER,
      ),
      setupUrl: "https://console.twilio.com",
      setupLabel: "console.twilio.com",
    },
  ].filter((i) => !(PRIVATE_EDITION && i.key === "stripe"));

  const missingCount = integrations.filter((i) => !i.configured).length;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Beállítások"
        description="Fiók, iroda és külső szolgáltatások kezelése."
      />

      {google === "connected" && (
        <Card className="flex items-center gap-2.5 border-success/30 bg-success-soft p-4 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Google Naptár sikeresen csatlakoztatva.
        </Card>
      )}

      {error && (
        <Card className="flex items-center gap-2.5 border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {error}
        </Card>
      )}

      {missingCount > 0 && (
        <Card className="flex items-center gap-2.5 border-warning/30 bg-warning-soft p-4 text-sm text-warning">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {missingCount} integráció még nincs beállítva — a hozzájuk tartozó funkciók a kódban készen állnak,
          csak a hitelesítő adatokra várnak.
        </Card>
      )}

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard/settings?tab=${t.id}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "profil" && (
      <div>
        <div className="mb-2 text-sm font-medium text-foreground">Saját profil</div>
        <Card className="flex items-start gap-3.5 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover">
            <UserRound className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <form action={updateMyName} className="flex flex-col gap-3">
              <div className={fieldGroupClass}>
                <span className={labelClass}>Megjelenített név</span>
                <input
                  name="full_name"
                  defaultValue={profile.full_name ?? ""}
                  placeholder={user.email ?? "Név"}
                  className={`${inputClass} max-w-xs`}
                />
                <span className="text-xs text-muted-subtle">
                  Ez jelenik meg a köszöntésben és a csapat-listában {user.email} helyett.
                </span>
              </div>
              <Button type="submit" variant="secondary" size="sm" className="self-start">
                Mentés
              </Button>
            </form>
            <PasswordPanel email={user.email ?? ""} />
            <MfaPanel initialFactor={verifiedMfaFactor} />
          </div>
        </Card>
      </div>
      )}

      {activeTab === "iroda" && (
      <>
      <div>
        <div className="mb-2">
          <div className="text-sm font-medium text-foreground">Iroda branding</div>
          <p className="text-xs text-muted">
            A logó és a kiemelő szín megjelenik a publikus ingatlan-oldalakon.
          </p>
        </div>
        <Card className="flex items-start gap-3.5 p-4">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full"
            style={{ background: currentPreset.soft, color: currentPreset.hover }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-4 w-4" strokeWidth={1.75} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {profile.role === "owner" || profile.role === "admin" ? (
              <form action={updateAgencyBranding} className="flex flex-col gap-3">
                <div className={fieldGroupClass}>
                  <span className={labelClass}>Logó (négyzetes kép ajánlott)</span>
                  <input
                    type="file"
                    name="logo"
                    accept="image/*"
                    className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent-hover"
                  />
                </div>
                <div className={fieldGroupClass}>
                  <span className={labelClass}>Kiemelő szín</span>
                  <div className="flex flex-wrap gap-2">
                    {ACCENT_PRESETS.map((preset) => (
                      <label
                        key={preset.id}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs has-[:checked]:border-accent"
                      >
                        <input
                          type="radio"
                          name="accent_preset"
                          value={preset.id}
                          defaultChecked={preset.id === currentPreset.id}
                          className="sr-only"
                        />
                        <span
                          className="h-3.5 w-3.5 rounded-full"
                          style={{ background: preset.accent }}
                        />
                        {preset.label}
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="submit" variant="secondary" size="sm" className="self-start">
                  Mentés
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted">
                A branding beállítását csak az iroda tulajdonosa vagy admin tagja módosíthatja. Jelenlegi szín:{" "}
                {currentPreset.label}.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div>
        <div className="mb-2">
          <div className="text-sm font-medium text-foreground">Nyilvános ingatlan-katalógus</div>
          <p className="text-xs text-muted">
            Egy link, ami az iroda összes elérhető ingatlanát felsorolja — Facebookra, weboldalra vagy
            email-aláírásba illeszthető, mindig friss listát mutat.
          </p>
        </div>
        <Card className="flex items-start gap-3.5 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover">
            <Link2 className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <a
              href={`/a/${agencyBranding?.slug ?? ""}`}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm font-medium text-accent hover:underline"
            >
              {catalogUrl}
            </a>
            {profile.role === "owner" ? (
              <form action={updateAgencyPublicSlug} className="mt-3 flex flex-col gap-1.5">
                <span className={labelClass}>Link szerkesztése</span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-subtle">{siteUrl}/a/</span>
                  <input
                    name="slug"
                    defaultValue={agencyBranding?.slug ?? ""}
                    pattern="[a-z0-9-]+"
                    className={`${inputClass} max-w-[200px]`}
                  />
                  <Button type="submit" variant="secondary" size="sm">
                    Mentés
                  </Button>
                </div>
                <span className="text-xs text-muted-subtle">
                  Csak kisbetű, szám és kötőjel. Csak az „Elérhető” státuszú ingatlanok jelennek meg rajta.
                </span>
              </form>
            ) : (
              <p className="mt-1 text-sm text-muted">
                A link szerkesztését csak az iroda tulajdonosa végezheti.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div>
        <div className="mb-2">
          <div className="text-sm font-medium text-foreground">Webhook érdeklődőkhöz</div>
          <p className="text-xs text-muted">
            Minden új, publikus lead-űrlapról érkező érdeklődőnél a rendszer POST kérést küld erre
            a címre (az email/SMS-értesítés MELLETT, nem helyette) — pl. Zapier/Make automatizáláshoz.
          </p>
        </div>
        <Card className="flex items-start gap-3.5 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover">
            <Webhook className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            {profile.role === "owner" || profile.role === "admin" ? (
              <form action={updateAgencyWebhook} className="flex flex-col gap-1.5">
                <span className={labelClass}>Webhook URL</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    name="webhook_url"
                    type="url"
                    placeholder="https://..."
                    defaultValue={agencyBranding?.lead_webhook_url ?? ""}
                    className={`${inputClass} max-w-sm`}
                  />
                  <Button type="submit" variant="secondary" size="sm">
                    Mentés
                  </Button>
                </div>
                <span className="text-xs text-muted-subtle">
                  Csak nyilvánosan elérhető http(s) cím adható meg — localhost/belső hálózati cím nem
                  fogadható el. Üresen hagyva kikapcsolja a webhookot.
                </span>
              </form>
            ) : (
              <p className="text-sm text-muted">
                A webhook beállítását csak az iroda tulajdonosa vagy admin tagja végezheti.
                {agencyBranding?.lead_webhook_url ? " Jelenleg be van kapcsolva." : " Jelenleg nincs beállítva."}
              </p>
            )}
          </div>
        </Card>
      </div>

      <div>
        <div className="mb-2">
          <div className="text-sm font-medium text-foreground">Automatikus lead-kiosztás</div>
          <p className="text-xs text-muted">
            Bekapcsolva minden új, publikus lead-űrlapról érkező érdeklődő automatikusan egy
            csapattaghoz kerül (körbeosztással, a legkevesebb hozzárendelt kontakttal rendelkező
            kapja) — az értesítés is elsődlegesen neki megy. Kikapcsolva senkihez sincs kiosztva,
            az egész csapat egyszerre kap értesítést, mint eddig.
          </p>
        </div>
        <Card className="flex items-start gap-3.5 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover">
            <Shuffle className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            {profile.role === "owner" || profile.role === "admin" ? (
              <form action={updateAutoAssignLeads} className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    name="auto_assign_leads"
                    defaultChecked={agencyBranding?.auto_assign_leads ?? false}
                    className="h-4 w-4 rounded border-border"
                  />
                  Új lead-ek automatikus kiosztása csapattagok között
                </label>
                <Button type="submit" variant="secondary" size="sm" className="self-start">
                  Mentés
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted">
                Ezt csak az iroda tulajdonosa vagy admin tagja állíthatja.
                {agencyBranding?.auto_assign_leads ? " Jelenleg be van kapcsolva." : " Jelenleg nincs beállítva."}
              </p>
            )}
          </div>
        </Card>
      </div>

      <div>
        <div className="mb-2">
          <div className="text-sm font-medium text-foreground">Adataim exportálása</div>
          <p className="text-xs text-muted">
            Az iroda összes kontaktja, ingatlana, dealje és aktivitása egy letölthető JSON-fájlban
            (adathordozhatósághoz, biztonsági mentéshez).
          </p>
        </div>
        <Card className="flex items-start gap-3.5 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover">
            <Download className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            {profile.role === "owner" || profile.role === "admin" ? (
              <a href="/dashboard/export" className={buttonVariants("secondary", "sm")}>
                Exportálás JSON-ba
              </a>
            ) : (
              <p className="text-sm text-muted">
                Az adatexportálást csak az iroda tulajdonosa vagy admin tagja végezheti.
              </p>
            )}
          </div>
        </Card>
      </div>
      </>
      )}

      {activeTab === "integraciok" && (
      <>
      <div className="mb-2 text-sm font-medium text-foreground">Külső szolgáltatások</div>
      <div className="flex flex-col gap-3">
        {integrations.map((integration) => (
          <Card key={integration.key} className="flex items-start gap-3.5 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover">
              <integration.icon className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{integration.name}</span>
                <Badge variant={integration.configured ? "success" : "neutral"}>
                  {integration.configured ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Beállítva
                    </>
                  ) : (
                    "Nincs beállítva"
                  )}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{integration.description}</p>
              {!integration.configured && (
                <p className="mt-1.5 text-xs text-muted-subtle">
                  {integration.whatBreaks} Kulcs beszerzése:{" "}
                  <a
                    href={integration.setupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    {integration.setupLabel}
                  </a>
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>
      </>
      )}

      {activeTab === "profil" && (
      <div>
        <div className="mb-2">
          <div className="text-sm font-medium text-foreground">Személyes integrációk</div>
          <p className="text-xs text-muted">
            Ezek csak a saját fiókodra vonatkoznak, minden csapattag külön csatlakoztatja a sajátját.
          </p>
        </div>
        <Card className="flex items-start gap-3.5 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover">
            <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">Google Naptár</span>
              <Badge variant={googleConnection ? "success" : "neutral"}>
                {googleConnection ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Csatlakoztatva
                  </>
                ) : (
                  "Nincs csatlakoztatva"
                )}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted">
              A nyitott, dátumos teendőid (hívás, megtekintés, emlékeztető) automatikusan megjelennek a saját
              Google Naptáradban.
            </p>
            {googleConnection ? (
              <form action={disconnectGoogleCalendar} className="mt-2.5">
                <Button type="submit" variant="secondary" size="sm">
                  Kapcsolat bontása
                </Button>
              </form>
            ) : googleConfigured ? (
              <a href="/api/google/auth" className="mt-2.5 inline-block">
                <Button type="button" variant="secondary" size="sm">
                  Csatlakoztatás
                </Button>
              </a>
            ) : (
              <p className="mt-1.5 text-xs text-muted-subtle">
                Az irodának be kell állítania a GOOGLE_CLIENT_ID és GOOGLE_CLIENT_SECRET kulcsokat, mielőtt
                bárki csatlakoztathatná a saját naptárát. Beszerzés:{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  console.cloud.google.com
                </a>
              </p>
            )}
          </div>
        </Card>
      </div>
      )}
    </div>
  );
}
