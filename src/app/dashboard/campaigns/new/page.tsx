import Link from "next/link";
import { createSequence } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass, fieldGroupClass } from "@/components/ui/styles";

export default function NewCampaignPage() {
  return (
    <div className="max-w-md">
      <PageHeader
        title="Új email-kampány"
        action={
          <Link
            href="/dashboard/campaigns"
            className="text-sm text-muted hover:text-accent"
          >
            ← Kampányok
          </Link>
        }
      />

      <Card className="mt-6 p-5">
        <form action={createSequence} className="flex flex-col gap-4">
          <div className={fieldGroupClass}>
            <span className={labelClass}>Kampány neve</span>
            <input
              name="name"
              required
              placeholder="pl. Új weboldali érdeklődő nurture"
              className={inputClass}
            />
          </div>

          <div className={fieldGroupClass}>
            <span className={labelClass}>Indítás</span>
            <select name="trigger" defaultValue="manual" className={inputClass}>
              <option value="manual">Kézi beiratkozás (kontakt oldalon)</option>
              <option value="new_lead">
                Automatikus — minden új weboldali érdeklődő
              </option>
            </select>
          </div>

          <Button type="submit" className="mt-1">
            Létrehozás, lépések hozzáadása
          </Button>
        </form>
      </Card>
    </div>
  );
}
