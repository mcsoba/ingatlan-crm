import Link from "next/link";
import { Inbox, Mail, Phone, Check, PhoneCall, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SOURCE_LABELS } from "@/app/dashboard/contacts/constants";
import { dismissLead, markLeadContacted, qualifyLead } from "./actions";

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)} perce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} órája`;
  return `${Math.floor(hours / 24)} napja`;
}

export default async function LeadsInboxPage() {
  const supabase = await createClient();

  const { data: leads, error } = await supabase
    .from("contacts")
    .select("id, name, email, phone, source, notes, created_at")
    .eq("status", "new")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lead-postaláda"
        description="Az új, még feldolgozatlan érdeklődők — a legfrissebb elöl."
        helpText="Ide kerül minden új kontakt (weboldalról, telefonról, importból), amit még senki nem vett fel. Három gyors lehetőséged van: 'Minősítés' (deal nyílik az első szakaszban), 'Felvettem a kapcsolatot' vagy 'Elvetés' — így a postaláda mindig csak a teendőket mutatja."
      />

      {leads.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="A postaláda üres"
          description="Nincs feldolgozatlan lead — minden érdeklődővel foglalkoztál."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {leads.map((lead) => (
            <Card key={lead.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/contacts/${lead.id}`}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {lead.name}
                  </Link>
                  <Badge variant="neutral">{SOURCE_LABELS[lead.source] ?? lead.source}</Badge>
                  <span className="text-xs text-muted-subtle">{timeAgo(lead.created_at)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:text-accent">
                      <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {lead.email}
                    </a>
                  )}
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 hover:text-accent">
                      <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {lead.phone}
                    </a>
                  )}
                </div>
                {lead.notes && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted">{lead.notes}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <form action={qualifyLead.bind(null, lead.id)}>
                  <Button type="submit" size="sm">
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                    Minősítés
                  </Button>
                </form>
                <form action={markLeadContacted.bind(null, lead.id)}>
                  <Button type="submit" size="sm" variant="secondary">
                    <PhoneCall className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Felvettem a kapcsolatot
                  </Button>
                </form>
                <form action={dismissLead.bind(null, lead.id)}>
                  <Button type="submit" size="sm" variant="danger">
                    <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Elvetés
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
