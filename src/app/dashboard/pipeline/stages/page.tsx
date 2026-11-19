import Link from "next/link";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { createStage, deleteStage, moveStage, renameStage, updateStageGuidance } from "../actions";
import { DEFAULT_STAGE_GUIDANCE, stageGuidance } from "@/lib/stage-guidance";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";
import { ConfirmDelete } from "../../finance/confirm-delete";

export default async function PipelineStagesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error: errorParam } = await searchParams;
  const { profile } = await ensureCurrentUserProfile();
  const canEdit = profile.role === "owner" || profile.role === "admin";
  const supabase = await createClient();
  const [{ data: stages, error }, { data: dealRows }] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name, position, guidance").order("position"),
    // Csak a szakasz-azonosító kell: hány üzlet (Lomtárban lévővel együtt) tartja meg a szakaszt
    supabase.from("deals").select("stage_id, deleted_at"),
  ]);

  if (error) throw error;
  const dealCount = new Map<string, { active: number; trashed: number }>();
  for (const d of dealRows ?? []) {
    const c = dealCount.get(d.stage_id) ?? { active: 0, trashed: 0 };
    if (d.deleted_at) c.trashed++;
    else c.active++;
    dealCount.set(d.stage_id, c);
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Üzlet-szakaszok"
        description="Az üzletek lépései, és hogy mit kell tenni az egyes lépésekben. Az útmutató az üzlet oldalán, a weben és a mobilon is megjelenik."
        action={
          <Link
            href="/dashboard/pipeline"
            className="text-sm text-muted hover:text-accent"
          >
            ← Üzletek
          </Link>
        }
      />

      {errorParam === "has_deals" && (
        <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          Ez a szakasz nem törölhető, mert üzlet tartozik hozzá (lehet, hogy a Lomtárban). Előbb mozgasd át az üzleteket egy másik szakaszba, vagy
          töröld őket véglegesen a Lomtárból.
        </p>
      )}

      {!canEdit && (
        <p className="mt-4 text-sm text-muted">
          A szakaszok szerkesztéséhez tulajdonosi vagy admin jogosultság szükséges — az alábbi lista csak olvasható.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {(stages ?? []).map((stage, idx) => {
          const moveUp = moveStage.bind(null, stage.id, "up");
          const moveDown = moveStage.bind(null, stage.id, "down");
          const rename = renameStage.bind(null, stage.id);
          const saveGuidance = updateStageGuidance.bind(null, stage.id);
          const guidance = stageGuidance(stage);

          if (!canEdit) {
            return (
              <Card key={stage.id} className="flex flex-col gap-1 p-2.5 text-sm">
                <span className="font-medium text-foreground">{stage.name}</span>
                {guidance && <span className="text-xs text-muted">{guidance}</span>}
              </Card>
            );
          }

          return (
            <Card key={stage.id} className="flex flex-col gap-2 p-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <form action={moveUp}>
                  <button
                    type="submit"
                    disabled={idx === 0}
                    className="text-muted-subtle hover:text-foreground disabled:opacity-20"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                </form>
                <form action={moveDown}>
                  <button
                    type="submit"
                    disabled={idx === (stages?.length ?? 0) - 1}
                    className="text-muted-subtle hover:text-foreground disabled:opacity-20"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>

              <form action={rename} className="flex flex-1 gap-2">
                <input
                  name="name"
                  defaultValue={stage.name}
                  className={`${inputClass} flex-1 py-1.5`}
                />
                <Button type="submit" variant="secondary" size="sm">
                  Mentés
                </Button>
              </form>

              {(() => {
                const c = dealCount.get(stage.id);
                if (c && (c.active || c.trashed)) {
                  const why = c.active
                    ? `${c.active} üzlet van ebben a szakaszban — előbb mozgasd át őket`
                    : `${c.trashed} üzlet a Lomtárban még ehhez a szakaszhoz tartozik`;
                  return (
                    <span title={why} className="flex cursor-not-allowed items-center gap-1 text-xs text-muted-subtle">
                      <Trash2 className="h-3.5 w-3.5 opacity-40" />
                      {c.active || c.trashed}
                    </span>
                  );
                }
                return (
                  <ConfirmDelete
                    action={deleteStage}
                    fields={{ id: stage.id }}
                    label=""
                    question={`Törlöd a(z) „${stage.name}” szakaszt?`}
                  />
                );
              })()}
            </div>
              <form action={saveGuidance} className="flex flex-col gap-1.5 pl-6">
                <label className="text-xs font-medium text-muted" htmlFor={`guidance-${stage.id}`}>
                  Mit kell tenni ebben a szakaszban?
                </label>
                <textarea
                  id={`guidance-${stage.id}`}
                  name="guidance"
                  rows={2}
                  defaultValue={stage.guidance ?? ""}
                  placeholder={DEFAULT_STAGE_GUIDANCE[stage.name.trim().toLowerCase()] ?? "pl. Hívd fel az ügyfelet, és egyeztess időpontot."}
                  className={`${inputClass} text-xs`}
                />
                <Button type="submit" variant="ghost" size="sm" className="self-start">
                  Útmutató mentése
                </Button>
              </form>
            </Card>
          );
        })}
      </div>

      {canEdit && (
        <form
          action={createStage}
          className="mt-4 flex gap-2 border-t border-border-subtle pt-4"
        >
          <input
            name="name"
            required
            placeholder="Új szakasz neve"
            className={`${inputClass} flex-1`}
          />
          <Button type="submit">Hozzáadás</Button>
        </form>
      )}
    </div>
  );
}
