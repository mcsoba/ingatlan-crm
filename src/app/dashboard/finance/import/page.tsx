import { Lock } from "lucide-react";
import { listImports } from "../import-actions";
import { ImportUploader } from "./upload-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/** Ideiglenes oldal: a meglévő Excel-táblázat feltöltése, hogy az adatokat be lehessen dolgozni a CRM-be. */
export default async function ImportPage() {
  const files = await listImports();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Fájl feltöltése"
        description="Excel-nyilvántartás vagy bankkivonat (MBH NetBank export: CSV / Excel / PDF) — az adatokat bedolgozzuk a CRM-be."
      />
      <Card className="flex items-start gap-2 p-3 text-xs text-muted">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        A fájl privát tárolóba kerül, nyilvános link nincs hozzá; csak az iroda tulajdonosa/adminja látja. A feldolgozás után törölhető (kuka ikon).
      </Card>
      <ImportUploader files={files} />
    </div>
  );
}
