"use client";

import { useMemo, useState, useTransition } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { addCashPerson, assignCashPerson, createCashTransfer, deleteCashTransfer } from "../cash-actions";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";
import { formatDate, formatMoney } from "@/lib/finance";

type Person = { id: string; name: string };
export type UnassignedRow = { id: string; date: string; label: string; detail: string; amount: number; kind: string };

function ErrorText({ error }: { error: string | null }) {
  return error ? <span className="text-xs text-danger">{error}</span> : null;
}

/** Hozzárendelésre váró készpénzes tételek: kijelölés + „kinél van / ki fizette” egyszerre több sorra. */
export function UnassignedPanel({ rows, people }: { rows: UnassignedRow[]; people: Person[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [person, setPerson] = useState(people[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const total = useMemo(() => rows.filter((r) => selected.has(r.id)).reduce((s, r) => s + r.amount, 0), [rows, selected]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} />
          Mind ({rows.length})
        </label>
        <span className="text-xs text-muted">
          {selected.size} kijelölve{selected.size ? ` · ${formatMoney(total)}` : ""}
        </span>
        <span className="flex-1" />
        <select value={person} onChange={(e) => setPerson(e.target.value)} className={`${inputClass} w-auto py-1.5`}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={isPending || !selected.size || !person}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                await assignCashPerson([...selected], person);
                setSelected(new Set());
              } catch (e) {
                setError(e instanceof Error ? e.message : "Nem sikerült");
              }
            })
          }
        >
          {isPending ? "Mentés…" : "Hozzárendelés"}
        </Button>
      </div>
      <ErrorText error={error} />
      <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border-subtle last:border-0 hover:bg-background/60">
                <td className="w-8 px-3 py-1.5">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={r.label} />
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-muted">{formatDate(r.date)}</td>
                <td className="px-2 py-1.5">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-xs text-muted"> · {r.kind}{r.detail ? ` · ${r.detail}` : ""}</span>
                </td>
                <td className={`whitespace-nowrap px-3 py-1.5 text-right font-medium tabular-nums ${r.amount < 0 ? "" : "text-success"}`}>
                  {r.amount > 0 ? "+" : ""}
                  {formatMoney(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Egy tétel kezelőjének átírása a mozgáslistában. */
export function PersonSelect({ invoiceId, value, people }: { invoiceId: string; value: string | null; people: Person[] }) {
  const [isPending, startTransition] = useTransition();
  return (
    <select
      value={value ?? ""}
      disabled={isPending}
      onChange={(e) => startTransition(() => assignCashPerson([invoiceId], e.target.value || null))}
      className="rounded border border-transparent bg-transparent py-0.5 text-xs text-muted hover:border-border"
    >
      <option value="">— nincs megadva —</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

export function TransferDelete({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  if (!confirming)
    return (
      <button type="button" title="Átadás törlése" onClick={() => setConfirming(true)} className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  return (
    <span className="flex items-center justify-end gap-1.5 text-xs">
      <button type="button" disabled={isPending} onClick={() => startTransition(() => deleteCashTransfer(id))} className="rounded bg-danger px-1.5 py-0.5 font-medium text-white">
        Törlöm
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-muted">
        Nem
      </button>
    </span>
  );
}

/** Készpénz átadása + új pénzkezelő felvétele. */
export function TransferForm({ companyId, people, today }: { companyId: string; people: Person[]; today: string }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <form
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6"
        action={(fd) =>
          startTransition(async () => {
            setError(null);
            setSaved(null);
            try {
              await createCashTransfer(fd);
              setSaved("Átadás rögzítve");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Nem sikerült");
            }
          })
        }
      >
        <input type="hidden" name="company_id" value={companyId} />
        <label className="flex flex-col gap-1 text-xs text-muted">
          Ki adta?
          <select name="from_person_id" className={inputClass} defaultValue="">
            <option value="">— máshonnan (pl. saját pénzéből) —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Kinek?
          <select name="to_person_id" className={inputClass} defaultValue={people[0]?.id ?? ""}>
            <option value="">— elszámolva / visszaadva —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Összeg (Ft)
          <input name="amount" inputMode="decimal" required placeholder="0" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Dátum
          <input type="date" name="transfer_date" defaultValue={today} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Mire / megjegyzés
          <input name="note" placeholder="pl. tankolásra" className={inputClass} />
        </label>
        <div className="flex items-end">
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Mentés…" : "Átadás rögzítése"}
          </Button>
        </div>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <ErrorText error={error} />
        {saved && <span className="text-xs text-success">{saved}</span>}
        <span className="flex-1" />
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Új pénzkezelő neve" className={`${inputClass} w-48 py-1.5`} />
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending || !newName.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                await addCashPerson(companyId, newName);
                setNewName("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Nem sikerült");
              }
            })
          }
        >
          <UserPlus className="h-3.5 w-3.5" />
          Felvétel
        </Button>
      </div>
    </div>
  );
}
