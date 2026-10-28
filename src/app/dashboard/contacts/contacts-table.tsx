"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import {
  deleteContact,
  bulkDeleteContacts,
  bulkUpdateContactStatus,
  bulkUpdateContactOwner,
} from "./actions";
import { bulkAssignContactTag, type TagRow } from "../tags/actions";
import { restoreRecord } from "../trash/actions";
import { SOURCE_LABELS, STATUS_LABELS, STATUS_VARIANTS } from "./constants";
import { ColumnPicker, useVisibleColumns } from "./column-picker";
import { useToast } from "@/components/ui/toast";
import { SIMPLE_MODE } from "@/lib/edition";

type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  lead_score: number | null;
  ownerName: string | null;
  tags: { id: string; name: string; color: string }[];
  isNeglected: boolean;
  daysSinceActivity: number;
  created_at: string;
};

const tagVariant = (color: string) =>
  (["neutral", "accent", "success", "warning", "danger"].includes(color)
    ? color
    : "neutral") as "neutral" | "accent" | "success" | "warning" | "danger";

export function ContactsTable({
  contacts,
  allTags,
  owners,
}: {
  contacts: ContactRow[];
  allTags: TagRow[];
  owners: { id: string; label: string }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkTag, setBulkTag] = useState("");
  const [bulkOwner, setBulkOwner] = useState("");
  const [isPending, startTransition] = useTransition();
  const visible = useVisibleColumns();
  const toast = useToast();

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
    setBulkTag("");
    setBulkOwner("");
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
      toast({
        title: `${ids.length} kontakt törölve`,
        variant: "success",
        action: {
          label: "Visszavonás",
          onClick: () =>
            startTransition(() => {
              ids.forEach((id) => restoreRecord("contacts", id));
            }),
        },
      });
    });
  }

  function handleSingleDelete(id: string, name: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await deleteContact(fd);
      toast({
        title: `${name} törölve`,
        variant: "success",
        action: {
          label: "Visszavonás",
          onClick: () => startTransition(() => restoreRecord("contacts", id)),
        },
      });
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

  function handleBulkTag() {
    if (!bulkTag) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkAssignContactTag(ids, bulkTag);
      clearSelection();
    });
  }

  function handleBulkOwner() {
    if (!bulkOwner) return;
    const ids = Array.from(selected);
    const ownerId = bulkOwner === "__none__" ? "" : bulkOwner;
    const label =
      bulkOwner === "__none__"
        ? "nincs hozzárendelve"
        : (owners.find((o) => o.id === bulkOwner)?.label ?? "");
    startTransition(async () => {
      await bulkUpdateContactOwner(ids, ownerId);
      clearSelection();
      toast({ title: `${ids.length} kontakt hozzárendelve: ${label}`, variant: "success" });
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
          {allTags.length > 0 && (
            <>
              <select
                value={bulkTag}
                onChange={(e) => setBulkTag(e.target.value)}
                disabled={isPending}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
              >
                <option value="">Címke hozzáadása…</option>
                {allTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkTag}
                disabled={!bulkTag || isPending}
                className={buttonVariants("secondary", "sm")}
              >
                Alkalmaz
              </button>
            </>
          )}
          {owners.length > 0 && (
            <>
              <select
                value={bulkOwner}
                onChange={(e) => setBulkOwner(e.target.value)}
                disabled={isPending}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
              >
                <option value="">Ügynök hozzárendelése…</option>
                <option value="__none__">— nincs hozzárendelve —</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkOwner}
                disabled={!bulkOwner || isPending}
                className={buttonVariants("secondary", "sm")}
              >
                Alkalmaz
              </button>
            </>
          )}
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

      {!SIMPLE_MODE && (
        <div className="flex justify-end">
          <ColumnPicker />
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-muted">
              {!SIMPLE_MODE && (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Összes kijelölése"
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
              </th>
              )}
              <th className="px-4 py-3 font-medium">
                <span className="inline-flex items-center gap-1">
                  Név
                  <HelpTooltip text="Az óra-ikon azt jelzi, hogy egy felvett/minősített kontaktnak 14+ napja nem volt aktivitása (jegyzet, hívás, megtekintés) — érdemes utánanézni, mielőtt kihűl." />
                </span>
              </th>
              {visible.has("email") && <th className="px-4 py-3 font-medium">Elérhetőség</th>}
              {visible.has("tags") && <th className="px-4 py-3 font-medium">Címkék</th>}
              {visible.has("source") && <th className="px-4 py-3 font-medium">Forrás</th>}
              {visible.has("owner") && (
                <th className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    Ügynök
                    <HelpTooltip text="Automatikus érdeklődő-kiosztás esetén az a csapattag, akihez a kontakt körbeosztással került. Kikapcsolt kiosztásnál, vagy kézzel felvett kontaktnál üres." />
                  </span>
                </th>
              )}
              {visible.has("status") && <th className="px-4 py-3 font-medium">Státusz</th>}
              {visible.has("score") && (
                <th className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    Pontszám
                    <HelpTooltip text="AI-alapú becslés 0-100 között arra, mennyire valószínű, hogy ez a kontakt hamarosan vásárol/elad. A kontakt oldalán a 'Pontozás frissítése' gombbal számolható újra." />
                  </span>
                </th>
              )}
              {visible.has("created") && <th className="px-4 py-3 font-medium">Létrehozva</th>}
              {visible.has("lastActivity") && (
                <th className="px-4 py-3 font-medium">Utolsó aktivitás</th>
              )}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                className="border-b border-border-subtle last:border-0 hover:bg-background"
              >
                {!SIMPLE_MODE && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(contact.id)}
                    onChange={() => toggleOne(contact.id)}
                    aria-label={`${contact.name} kijelölése`}
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                  />
                </td>
                )}
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
                {visible.has("email") && (
                  <td className="px-4 py-3 text-muted">
                    {contact.email || contact.phone ? (
                      <div className="flex flex-col gap-0.5">
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="hover:text-accent">
                            {contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <a href={`tel:${contact.phone}`} className="hover:text-accent">
                            {contact.phone}
                          </a>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                {visible.has("tags") && (
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
                )}
                {visible.has("source") && (
                  <td className="px-4 py-3 text-muted">
                    {SOURCE_LABELS[contact.source] ?? contact.source}
                  </td>
                )}
                {visible.has("owner") && (
                  <td className="px-4 py-3 text-muted">
                    {contact.ownerName ?? <span className="text-muted-subtle">—</span>}
                  </td>
                )}
                {visible.has("status") && (
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[contact.status] ?? "neutral"}>
                      {STATUS_LABELS[contact.status] ?? contact.status}
                    </Badge>
                  </td>
                )}
                {visible.has("score") && (
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
                )}
                {visible.has("created") && (
                  <td className="px-4 py-3 text-muted">
                    {new Date(contact.created_at).toLocaleDateString("hu-HU")}
                  </td>
                )}
                {visible.has("lastActivity") && (
                  <td className="px-4 py-3 text-muted">
                    {contact.daysSinceActivity === 0
                      ? "Ma"
                      : `${contact.daysSinceActivity} napja`}
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleSingleDelete(contact.id, contact.name)}
                    className="text-xs text-muted hover:text-danger disabled:opacity-50"
                  >
                    Törlés
                  </button>
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
