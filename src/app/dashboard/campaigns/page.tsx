import Link from "next/link";
import { Mail, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Kézi beiratkozás",
  new_lead: "Automatikus — új weboldali érdeklődő",
};

export default async function CampaignsPage() {
  const supabase = await createClient();

  const [{ data: sequences, error }, { data: steps }, { data: enrollments }] =
    await Promise.all([
      supabase
        .from("email_sequences")
        .select("id, name, trigger, active")
        .order("created_at", { ascending: false }),
      supabase.from("email_sequence_steps").select("sequence_id"),
      supabase
        .from("email_sequence_enrollments")
        .select("sequence_id")
        .eq("status", "active"),
    ]);

  if (error) throw error;

  const stepCounts = new Map<string, number>();
  for (const s of steps ?? []) {
    stepCounts.set(s.sequence_id, (stepCounts.get(s.sequence_id) ?? 0) + 1);
  }
  const enrollmentCounts = new Map<string, number>();
  for (const e of enrollments ?? []) {
    enrollmentCounts.set(e.sequence_id, (enrollmentCounts.get(e.sequence_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Email-kampányok"
        description="Automatikus follow-up email-sorozatok kontaktoknak."
        action={
          <Link href="/dashboard/campaigns/new">
            <Button>
              <Plus className="h-3.5 w-3.5" />
              Új kampány
            </Button>
          </Link>
        }
      />

      {(sequences ?? []).length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Még nincs kampány"
          description="Hozz létre egy email-sorozatot, ami napokra ütemezve, automatikusan küld emaileket a beiratkozott kontaktoknak."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {(sequences ?? []).map((seq) => (
            <Link key={seq.id} href={`/dashboard/campaigns/${seq.id}`}>
              <Card className="flex items-center justify-between gap-4 p-4 hover:border-accent/40">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{seq.name}</span>
                    <Badge variant={seq.active ? "success" : "neutral"}>
                      {seq.active ? "Aktív" : "Szüneteltetve"}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {TRIGGER_LABELS[seq.trigger] ?? seq.trigger} ·{" "}
                    {stepCounts.get(seq.id) ?? 0} lépés ·{" "}
                    {enrollmentCounts.get(seq.id) ?? 0} aktív beiratkozás
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
