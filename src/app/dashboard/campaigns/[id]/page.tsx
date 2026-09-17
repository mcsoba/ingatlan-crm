import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  addStep,
  deleteStep,
  deleteSequence,
  toggleSequenceActive,
  bulkEnrollByTag,
} from "../actions";
import { listAgencyTags } from "../../tags/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  inputClass,
  labelClass,
  fieldGroupClass,
  sectionLabelClass,
} from "@/components/ui/styles";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktív",
  completed: "Befejezve",
  cancelled: "Leiratkozva",
};

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enrolled?: string; skipped?: string; enroll_error?: string }>;
}) {
  const { id } = await params;
  const { enrolled, skipped, enroll_error: enrollError } = await searchParams;
  const supabase = await createClient();

  const [{ data: sequence }, { data: steps, error: stepsError }, { data: enrollments }, tags] =
    await Promise.all([
      supabase
        .from("email_sequences")
        .select("id, name, trigger, active")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("email_sequence_steps")
        .select("id, step_order, delay_days, subject, body")
        .eq("sequence_id", id)
        .order("step_order", { ascending: true }),
      supabase
        .from("email_sequence_enrollments")
        .select("id, status, current_step, next_send_at, contacts(id, name)")
        .eq("sequence_id", id)
        .order("enrolled_at", { ascending: false })
        .limit(20),
      listAgencyTags(),
    ]);

  if (stepsError) throw stepsError;
  if (!sequence) notFound();

  const toggleActive = toggleSequenceActive.bind(null, sequence.id, sequence.active);
  const addStepWithId = addStep.bind(null, sequence.id);
  const bulkEnrollWithId = bulkEnrollByTag.bind(null, sequence.id);
  const enrollmentRows = (enrollments ?? []) as unknown as {
    id: string;
    status: string;
    current_step: number;
    next_send_at: string | null;
    contacts: { id: string; name: string } | null;
  }[];

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <PageHeader
        title={sequence.name}
        description={
          sequence.trigger === "new_lead"
            ? "Automatikus — minden új weboldali érdeklődő beiratkozik"
            : "Kézi beiratkozás a kontakt oldalán"
        }
        action={
          <Link
            href="/dashboard/campaigns"
            className="text-sm text-muted hover:text-accent"
          >
            ← Kampányok
          </Link>
        }
      />

      <Card className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Badge variant={sequence.active ? "success" : "neutral"}>
            {sequence.active ? "Aktív" : "Szüneteltetve"}
          </Badge>
          <span className="text-sm text-muted">
            {sequence.active
              ? "A kampány küldi az esedékes emaileket."
              : "A kampány szünetel, nem küld emailt."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <form action={toggleActive}>
            <Button type="submit" variant="secondary" size="sm">
              {sequence.active ? "Szüneteltetés" : "Aktiválás"}
            </Button>
          </form>
          <form action={deleteSequence}>
            <input type="hidden" name="id" value={sequence.id} />
            <button type="submit" className="text-muted-subtle hover:text-danger">
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>
      </Card>

      <div>
        <h2 className={`mb-2 ${sectionLabelClass}`}>Lépések</h2>
        {(steps ?? []).length === 0 ? (
          <p className="text-sm text-muted">
            Még nincs egyetlen lépés sem — enélkül a beiratkozás nem küld emailt.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {(steps ?? []).map((step) => (
              <Card key={step.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="accent">
                        {step.step_order}. lépés · {step.delay_days === 0
                          ? "azonnal"
                          : `${step.delay_days}. nap`}
                      </Badge>
                    </div>
                    <div className="mt-1.5 text-sm font-medium text-foreground">
                      {step.subject}
                    </div>
                    <div className="mt-0.5 whitespace-pre-line text-xs text-muted">
                      {step.body}
                    </div>
                  </div>
                  <form action={deleteStep}>
                    <input type="hidden" name="id" value={step.id} />
                    <input type="hidden" name="sequenceId" value={sequence.id} />
                    <button
                      type="submit"
                      className="shrink-0 text-muted-subtle hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="p-5">
        <h2 className={`mb-3 ${sectionLabelClass}`}>Új lépés hozzáadása</h2>
        <form action={addStepWithId} className="flex flex-col gap-4">
          <div className={fieldGroupClass}>
            <span className={labelClass}>Hányadik nap után (0 = azonnal)</span>
            <input
              type="number"
              name="delay_days"
              min={0}
              defaultValue={0}
              className={inputClass}
            />
          </div>
          <div className={fieldGroupClass}>
            <span className={labelClass}>Tárgy</span>
            <input name="subject" required className={inputClass} />
          </div>
          <div className={fieldGroupClass}>
            <span className={labelClass}>
              Törzs — a {"{{name}}"} helyére a kontakt neve kerül
            </span>
            <textarea name="body" required rows={5} className={inputClass} />
          </div>
          <Button type="submit" className="mt-1">
            Lépés hozzáadása
          </Button>
        </form>
      </Card>

      {(enrolled !== undefined || enrollError) && (
        <Card
          className={`flex items-center gap-2.5 p-4 text-sm ${
            enrollError
              ? "border-danger/30 bg-danger-soft text-danger"
              : "border-success/30 bg-success-soft text-success"
          }`}
        >
          {enrollError ? (
            <>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {enrollError}
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {enrolled} kontakt beiratkoztatva
              {Number(skipped) > 0
                ? ` (${skipped} kihagyva — már be volt iratkozva)`
                : ""}
              .
            </>
          )}
        </Card>
      )}

      <Card className="p-5">
        <h2 className={`mb-1 ${sectionLabelClass}`}>Tömeges beiratkoztatás címke alapján</h2>
        <p className="mb-3 text-sm text-muted">
          Minden email-címmel rendelkező kontakt beiratkozik, akin a kiválasztott címke szerepel.
        </p>
        {tags.length === 0 ? (
          <p className="text-sm text-muted">
            Még nincs egyetlen címke sem — hozz létre egyet egy kontakt oldalán, utána itt
            célzottan beiratkoztathatod a vele jelölt kontaktokat.
          </p>
        ) : (
          <form action={bulkEnrollWithId} className="flex flex-wrap items-center gap-2">
            <select name="tag_id" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Válassz címkét
              </option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary" size="sm">
              Beiratkoztatás
            </Button>
          </form>
        )}
      </Card>

      <div>
        <h2 className={`mb-2 ${sectionLabelClass}`}>Beiratkozott kontaktok</h2>
        {enrollmentRows.length === 0 ? (
          <p className="text-sm text-muted">Még senki nincs beiratkozva.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {enrollmentRows.map((e) => (
              <Card key={e.id} className="flex items-center justify-between p-3 text-sm">
                <Link
                  href={e.contacts ? `/dashboard/contacts/${e.contacts.id}/edit` : "#"}
                  className="text-foreground hover:text-accent"
                >
                  {e.contacts?.name ?? "Törölt kontakt"}
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Badge
                    variant={
                      e.status === "active"
                        ? "accent"
                        : e.status === "completed"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {STATUS_LABELS[e.status] ?? e.status}
                  </Badge>
                  {e.status === "active" && e.next_send_at && (
                    <span>
                      Köv.: {new Date(e.next_send_at).toLocaleDateString("hu-HU")}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
