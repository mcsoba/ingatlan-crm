"use client";

import { createActivity } from "../activities/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/styles";
import { SIMPLE_MODE } from "@/lib/edition";

export function TaskQuickAdd() {
  return (
    <Card className="p-3">
      <form action={createActivity} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="redirect_to" value="/dashboard/tasks" />
        <select name="type" defaultValue="reminder" className={`${inputClass} py-1.5`}>
          {!SIMPLE_MODE && <option value="note">Jegyzet</option>}
          <option value="call">Hívás</option>
          <option value="viewing">Megtekintés</option>
          <option value="reminder">Emlékeztető</option>
        </select>
        <input type="date" name="due_at" className={`${inputClass} py-1.5`} />
        <input type="time" name="due_time" title="Időpont (ha üres: reggel 9)" className={`${inputClass} py-1.5`} />
        {!SIMPLE_MODE && (
          <select
            name="recurrence"
            defaultValue="none"
            title="Ismétlődés"
            className={`${inputClass} py-1.5`}
          >
            <option value="none">Nem ismétlődik</option>
            <option value="daily">Naponta</option>
            <option value="weekly">Hetente</option>
            <option value="monthly">Havonta</option>
          </select>
        )}
        <input
          name="content"
          required
          placeholder="Új önálló teendő (nem kötött kontakthoz/üzlethez)…"
          className={`${inputClass} min-w-[240px] flex-1 py-1.5`}
        />
        <Button type="submit" size="sm">
          Hozzáadás
        </Button>
      </form>
    </Card>
  );
}
