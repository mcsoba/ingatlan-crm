import type { TeamMember } from "@/lib/team";
import { inputClass, labelClass, fieldGroupClass } from "@/components/ui/styles";

// „Ki a felelős?” választó a kontakt- és ingatlan-űrlapokhoz. Új elemnél
// alapból a felvevő munkatárs; meglévőnél a jelenlegi felelős (vagy senki).
export function OwnerSelect({
  teamMembers,
  defaultOwnerId,
  currentUserId,
}: {
  teamMembers: TeamMember[];
  defaultOwnerId: string | null;
  currentUserId: string;
}) {
  return (
    <label className={fieldGroupClass}>
      <span className={labelClass}>Felelős munkatárs</span>
      <select name="owner_id" defaultValue={defaultOwnerId ?? ""} className={inputClass}>
        <option value="">— nincs kijelölve —</option>
        {teamMembers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.id === currentUserId ? " (te)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
