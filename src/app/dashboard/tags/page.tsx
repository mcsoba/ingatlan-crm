import { PageHeader } from "@/components/ui/page-header";
import { listAgencyTagsWithUsage } from "./actions";
import { TagsManager } from "./tags-manager";

export default async function TagsPage() {
  const tags = await listAgencyTagsWithUsage();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Címkék"
        description="Az összes iroda-szintű címke egy helyen — átnevezés, szín módosítása, végleges törlés."
        helpText="A címkéket a kontakt/ingatlan szerkesztő oldalon hozhatod létre először. Itt átnevezheted, színt válthatsz nekik, vagy véglegesen törölheted — a törlés minden kontaktról és ingatlanról eltávolítja a címkét."
      />
      <TagsManager initialTags={tags} />
    </div>
  );
}
