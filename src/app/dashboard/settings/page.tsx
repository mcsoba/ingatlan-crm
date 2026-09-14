import {
  CheckCircle2,
  CircleAlert,
  Sparkles,
  CreditCard,
  Mail,
  MessageSquare,
  CalendarDays,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { disconnectGoogleCalendar } from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; google?: string }>;
}) {
  const { error, google } = await searchParams;
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data: googleConnection } = await supabase
    .from("google_calendar_connections")
    .select("connected_at")
    .eq("profile_id", profile.id)
    .maybeSingle();

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
  ];

  const missingCount = integrations.filter((i) => !i.configured).length;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Beállítások"
        description="Külső szolgáltatások állapota — a kulcsokat a szerver .env.local fájljába kell megadni, itt csak az állapotuk látszik."
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
    </div>
  );
}
