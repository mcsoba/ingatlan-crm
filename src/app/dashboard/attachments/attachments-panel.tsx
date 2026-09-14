import { Paperclip, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { uploadAttachment, deleteAttachment } from "./actions";
import { DownloadButton } from "./download-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function AttachmentsPanel({
  contactId,
  dealId,
}: {
  contactId?: string;
  dealId?: string;
}) {
  const supabase = await createClient();
  const query = supabase
    .from("attachments")
    .select("id, filename, size_bytes, path, created_at")
    .order("created_at", { ascending: false });

  const { data: attachments, error } = contactId
    ? await query.eq("contact_id", contactId)
    : await query.eq("deal_id", dealId as string);

  if (error) throw error;

  return (
    <div className="flex flex-col gap-2">
      {(attachments ?? []).length === 0 ? (
        <EmptyState icon={Paperclip} title="Még nincs csatolt fájl" />
      ) : (
        <div className="flex flex-col gap-2">
          {(attachments ?? []).map((a) => (
            <Card key={a.id} className="flex items-center justify-between gap-2 p-2.5 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-subtle" />
                <span className="truncate text-foreground">{a.filename}</span>
                <span className="shrink-0 text-xs text-muted-subtle">{formatSize(a.size_bytes)}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <DownloadButton path={a.path} />
                <form action={deleteAttachment}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="path" value={a.path} />
                  {contactId && <input type="hidden" name="contactId" value={contactId} />}
                  {dealId && <input type="hidden" name="dealId" value={dealId} />}
                  <button type="submit" className="text-muted-subtle hover:text-danger" title="Törlés">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      <form action={uploadAttachment} className="flex items-center gap-2 pt-1">
        {contactId && <input type="hidden" name="contactId" value={contactId} />}
        {dealId && <input type="hidden" name="dealId" value={dealId} />}
        <input type="file" name="file" required className="flex-1 text-xs" />
        <Button type="submit" size="sm" variant="secondary">
          Feltöltés
        </Button>
      </form>
    </div>
  );
}
