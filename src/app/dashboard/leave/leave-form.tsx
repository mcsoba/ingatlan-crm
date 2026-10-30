"use client";

import { useState } from "react";
import { createLeave } from "./actions";
import { countWorkdays } from "./workdays";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/styles";

type Member = { id: string; name: string };

export function LeaveForm({
  members,
  currentProfileId,
  canPickMember,
}: {
  members: Member[];
  currentProfileId: string;
  canPickMember: boolean;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const auto = start ? countWorkdays(start, end && end >= start ? end : start) : null;

  return (
    <Card className="p-3">
      <form
        action={async (fd) => {
          await createLeave(fd);
          setStart("");
          setEnd("");
        }}
        className="flex flex-wrap items-end gap-2"
      >
        {canPickMember && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Munkatárs
            <select name="profile_id" defaultValue={currentProfileId} className={`${inputClass} py-1.5`}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">
          Első nap
          <input
            type="date"
            name="start_date"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={`${inputClass} py-1.5`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Utolsó nap
          <input
            type="date"
            name="end_date"
            min={start || undefined}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={`${inputClass} py-1.5`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Napok
          <input
            name="days"
            inputMode="decimal"
            placeholder={auto !== null ? String(auto) : "auto"}
            title="Üresen hagyva a hétköznapok száma; ünnepnap vagy fél nap esetén írd át (pl. 0,5)"
            className={`${inputClass} w-20 py-1.5`}
          />
        </label>
        <input
          name="note"
          placeholder="Megjegyzés (opcionális)"
          className={`${inputClass} min-w-[180px] flex-1 py-1.5`}
        />
        <Button type="submit" size="sm">
          Szabadság rögzítése
        </Button>
      </form>
    </Card>
  );
}
