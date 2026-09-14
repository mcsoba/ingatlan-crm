import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createStage, deleteStage, moveStage, renameStage } from "../actions";

export default async function PipelineStagesPage() {
  const supabase = await createClient();
  const { data: stages, error } = await supabase
    .from("pipeline_stages")
    .select("id, name, position")
    .order("position");

  if (error) throw error;

  return (
    <div className="max-w-md">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pipeline szakaszok</h1>
        <Link
          href="/dashboard/pipeline"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Pipeline
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {(stages ?? []).map((stage, idx) => {
          const moveUp = moveStage.bind(null, stage.id, "up");
          const moveDown = moveStage.bind(null, stage.id, "down");
          const rename = renameStage.bind(null, stage.id);

          return (
            <div
              key={stage.id}
              className="flex items-center gap-2 rounded border border-neutral-200 p-2"
            >
              <div className="flex flex-col">
                <form action={moveUp}>
                  <button
                    type="submit"
                    disabled={idx === 0}
                    className="px-1 text-xs text-neutral-500 hover:text-neutral-900 disabled:opacity-20"
                  >
                    ▲
                  </button>
                </form>
                <form action={moveDown}>
                  <button
                    type="submit"
                    disabled={idx === (stages?.length ?? 0) - 1}
                    className="px-1 text-xs text-neutral-500 hover:text-neutral-900 disabled:opacity-20"
                  >
                    ▼
                  </button>
                </form>
              </div>

              <form action={rename} className="flex flex-1 gap-2">
                <input
                  name="name"
                  defaultValue={stage.name}
                  className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
                />
                <button
                  type="submit"
                  className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                >
                  Mentés
                </button>
              </form>

              <form action={deleteStage}>
                <input type="hidden" name="id" value={stage.id} />
                <button
                  type="submit"
                  className="text-xs text-red-600 hover:underline"
                >
                  Törlés
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <form
        action={createStage}
        className="mt-4 flex gap-2 border-t border-neutral-200 pt-4"
      >
        <input
          name="name"
          required
          placeholder="Új szakasz neve"
          className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
        >
          Hozzáadás
        </button>
      </form>
    </div>
  );
}
