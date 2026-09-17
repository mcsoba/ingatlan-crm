import Link from "next/link";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { createStage, deleteStage, moveStage, renameStage } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";

export default async function PipelineStagesPage() {
  const { profile } = await ensureCurrentUserProfile();
  const canEdit = profile.role === "owner" || profile.role === "admin";
  const supabase = await createClient();
  const { data: stages, error } = await supabase
    .from("pipeline_stages")
    .select("id, name, position")
    .order("position");

  if (error) throw error;

  return (
    <div className="max-w-md">
      <PageHeader
        title="Pipeline szakaszok"
        action={
          <Link
            href="/dashboard/pipeline"
            className="text-sm text-muted hover:text-accent"
          >
            ← Pipeline
          </Link>
        }
      />

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

          if (!canEdit) {
            return (
              <Card key={stage.id} className="p-2.5 text-sm text-foreground">
                {stage.name}
              </Card>
            );
          }

          return (
            <Card key={stage.id} className="flex items-center gap-2 p-2">
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

              <form action={deleteStage}>
                <input type="hidden" name="id" value={stage.id} />
                <button type="submit" className="text-muted-subtle hover:text-danger">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
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
