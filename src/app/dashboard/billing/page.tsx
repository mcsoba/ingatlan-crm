import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { PRO_PLAN_PRICE_HUF } from "@/lib/stripe";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FREE_FEATURES = [
  "Kontaktok és ingatlanok kezelése",
  "Pipeline kanban tábla",
  "AI ingatlanleírás és follow-up email",
];

const PRO_FEATURES = [
  "Minden az Ingyenes csomagból",
  "Korlátlan csapattag-meghívás",
  "AI lead-pontozás és 'Kérdezd a CRM-et' asszisztens",
  "Csapat-teljesítmény riportok",
  "Nyilvános ingatlan-oldalak és lead-befogó űrlap",
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { success, error } = await searchParams;
  const { profile } = await ensureCurrentUserProfile();
  const isPro = profile.agencies.plan_tier === "pro";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Előfizetés"
        description={`Jelenlegi csomag: ${isPro ? "Pro" : "Ingyenes"}`}
      />

      {success && (
        <Card className="flex items-center gap-2.5 border-success/30 bg-success-soft p-4 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          Sikeres előfizetés! A Pro csomag már aktív.
        </Card>
      )}

      {error && (
        <Card className="flex items-center gap-2.5 border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className={`p-5 ${!isPro ? "border-accent/40" : ""}`}>
          <div className="text-sm font-medium text-muted">Ingyenes</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">0 Ft</div>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-muted">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-subtle" />
                {f}
              </li>
            ))}
          </ul>
          {!isPro && (
            <div className="mt-4 text-xs font-medium text-accent">
              Ez az aktuális csomagod
            </div>
          )}
        </Card>

        <Card className={`p-5 ${isPro ? "border-accent/40 bg-accent-soft/40" : ""}`}>
          <div className="flex items-center gap-1.5 text-sm font-medium text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Pro
          </div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            {PRO_PLAN_PRICE_HUF.toLocaleString("hu-HU")} Ft{" "}
            <span className="text-sm font-normal text-muted">/ hó</span>
          </div>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-muted">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                {f}
              </li>
            ))}
          </ul>

          {profile.role === "owner" ? (
            isPro ? (
              <form action="/api/stripe/portal" method="POST" className="mt-4">
                <Button type="submit" variant="secondary">
                  Előfizetés kezelése
                </Button>
              </form>
            ) : (
              <form action="/api/stripe/checkout" method="POST" className="mt-4">
                <Button type="submit">Frissítés Pro-ra</Button>
              </form>
            )
          ) : (
            <p className="mt-4 text-xs text-muted">
              Csak az iroda tulajdonosa válthat csomagot.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
