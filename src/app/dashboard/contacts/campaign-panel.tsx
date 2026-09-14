"use client";

import { useEffect, useState, useTransition } from "react";
import { Mail, Loader2, X } from "lucide-react";
import {
  listActiveSequences,
  listContactEnrollments,
  enrollContact,
  cancelEnrollment,
  type SequenceOption,
  type Enrollment,
} from "../campaigns/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { inputClass } from "@/components/ui/styles";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktív",
  completed: "Befejezve",
  cancelled: "Leiratkozva",
};

export function CampaignPanel({
  contactId,
  hasEmail,
}: {
  contactId: string;
  hasEmail: boolean;
}) {
  const [sequences, setSequences] = useState<SequenceOption[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isEnrolling, startEnrolling] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isCancelling, startCancelling] = useTransition();

  function refresh() {
    Promise.all([listActiveSequences(), listContactEnrollments(contactId)]).then(
      ([seqs, enr]) => {
        setSequences(seqs);
        setEnrollments(enr);
        setLoaded(true);
      },
    );
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  function handleEnroll() {
    if (!selected) return;
    setError(null);
    startEnrolling(async () => {
      try {
        await enrollContact(contactId, selected);
        setSelected("");
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  function handleCancel(enrollmentId: string) {
    setCancellingId(enrollmentId);
    startCancelling(async () => {
      try {
        await cancelEnrollment(enrollmentId, contactId);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hiba történt");
      } finally {
        setCancellingId(null);
      }
    });
  }

  if (!loaded) return null;

  const enrolledSequenceIds = new Set(
    enrollments.filter((e) => e.status === "active").map((e) => e.email_sequences?.id),
  );
  const availableSequences = sequences.filter((s) => !enrolledSequenceIds.has(s.id));

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Mail className="h-3.5 w-3.5 text-accent" />
        Email-kampányok
      </div>

      {enrollments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {enrollments.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-2 text-xs text-muted"
            >
              <span className="truncate text-foreground">
                {e.email_sequences?.name ?? "Törölt kampány"}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant={
                    e.status === "active"
                      ? "accent"
                      : e.status === "completed"
                        ? "success"
                        : "neutral"
                  }
                >
                  {STATUS_LABELS[e.status] ?? e.status}
                </Badge>
                {e.status === "active" && (
                  <button
                    onClick={() => handleCancel(e.id)}
                    disabled={isCancelling && cancellingId === e.id}
                    className="text-muted-subtle hover:text-danger"
                    title="Leiratkoztatás"
                  >
                    {isCancelling && cancellingId === e.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasEmail ? (
        <p className="text-xs text-muted">
          Adj meg egy email címet a kontakthoz a kampányba iratkoztatáshoz.
        </p>
      ) : availableSequences.length === 0 ? (
        <p className="text-xs text-muted">
          {sequences.length === 0
            ? "Még nincs egyetlen kampány sem létrehozva."
            : "Minden aktív kampányba be van már iratkoztatva."}
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className={`${inputClass} flex-1 py-1.5`}
          >
            <option value="">Válassz kampányt…</option>
            {availableSequences.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleEnroll}
            disabled={!selected || isEnrolling}
          >
            {isEnrolling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Beiratkoztatás"}
          </Button>
        </div>
      )}

      {error && <span className="text-xs text-danger">{error}</span>}
    </Card>
  );
}
