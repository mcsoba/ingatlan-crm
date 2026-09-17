"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { deleteContact, bulkDeleteContacts, bulkUpdateContactStatus } from "./actions";
import { SOURCE_LABELS, STATUS_LABELS, STATUS_VARIANTS } from "./constants";

type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  lead_score: number | null;
  tags: { id: string; name: string; color: string }[];
  isNeglected: boolean;
  daysSinceActivity: number;
};

const tagVariant = (color: string) =>
  (["neutral", "accent", "success", "warning", "danger"].includes(color)
    ? color
    : "neutral") as "neutral" | "accent" | "success" | "warning" | "danger";

export function ContactsTable({ contacts }: { contacts: ContactRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const allSelected = contacts.length > 0 && selected.size === contacts.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(contacts.map((c) => c.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setConfirmDelete(false);
    setBulkStatus("");
  }

  function handleBulkDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkDeleteContacts(ids);
      clearSelection();
    });
  }

  function handleBulkStatus() {
    if (!bulkStatus) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkUpdateContactStatus(ids, bulkStatus);
      clearSelection();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm">
          <span className="font-medium text-accent-hover">
            {selected.size} kiválasztva
          </span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            disabled={isPending}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
          >
            <option value="">Státusz módosítása…</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkStatus}
            disabled={!bulkStatus || isPending}
            className={buttonVariants("secondary", "sm")}
          >
            Alkalmaz
          </button>
          <button
            type="button"
            onClick={handleBulkDelete}
            onBlur={() => setConfirmDelete(false)}
            disabled={isPending}
            className={`${buttonVariants("danger", "sm")} ml-auto`}
          >
            {confirmDelete ? "Biztos? Kattints újra" : "Kijelöltek törlése"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={isPending}
            className={buttonVariants("ghost", "sm")}
          >
            Mégse
          </button>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-muted">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Összes kijelölése"
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <span className="inline-flex items-center gap-1">
                  Név
                  <HelpTooltip text="Az óra-ikon azt jelzi, hogy egy felvett/minősített kontaktnak 14+ napja nem volt aktivitása (jegyzet, hívás, megtekintés) — érdemes utánanézni, mielőtt kihűl." />
                </span>
              </th>
              <th className="px-4 py-3 font-medium">Elérhetőség</th>
              <th className="px-4 py-3 font-medium">Címkék</th>
              <th className="px-4 py-3 font-medium">Forrás</th>
              <th className="px-4 py-3 font-medium">Státusz</th>
              <th className="px-4 py-3 font-medium">
                <span className="inline-flex items-center gap-1">
                  Pontszám
                  <HelpTooltip text="AI-alapú becslés 0-100 között arra, mennyire valószínű, hogy ez a kontakt hamarosan vásárol/elad. A kontakt oldalán a 'Pontozás frissítése' gombbal számolható újra." />
                </span>
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                className="border-b border-border-subtle last:border-0 hover:bg-background"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(contact.id)}
                    onChange={() => toggleOne(contact.id)}
                    aria-label={`${contact.name} kijelölése`}
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/dashboard/contacts/${contact.id}/edit`}
                      className="font-medium text-foreground hover:text-accent"
                    >
                      {contact.name}
                    </Link>
                    {contact.isNeglected && (
                      <span title={`${contact.daysSinceActivity} napja nincs aktivitás`}>
                        <Clock
                          className="h-3.5 w-3.5 shrink-0 text-warning"
                          strokeWidth={1.75}
                        />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">
                  {contact.email || contact.phone || "—"}
                </td>
                <td className="px-4 py-3">
                  {contact.tags.length === 0 ? (
                    <span className="text-muted-subtle">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((t) => (
                        <Badge key={t.id} variant={tagVariant(t.color)}>
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">
                  {SOURCE_LABELS[contact.source] ?? contact.source}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANTS[contact.status] ?? "neutral"}>
                    {STATUS_LABELS[contact.status] ?? contact.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {contact.lead_score != null ? (
                    <Badge
                      variant={
                        contact.lead_score >= 70
                          ? "success"
                          : contact.lead_score >= 40
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {contact.lead_score}
                    </Badge>
                  ) : (
                    <span className="text-muted-subtle">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteContact}>
                    <input type="hidden" name="id" value={contact.id} />
                    <button
                      type="submit"
                      className="text-xs text-muted hover:text-danger"
                    >
                      Törlés
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
