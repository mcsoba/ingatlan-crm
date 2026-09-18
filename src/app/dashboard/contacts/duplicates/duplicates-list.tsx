"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mergeClusterContacts } from "../actions";

export type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
};

export type Cluster = {
  reasons: ("email" | "phone" | "name")[];
  members: ContactRow[];
};

const REASON_LABELS: Record<string, string> = {
  email: "azonos email",
  phone: "azonos telefonszám",
  name: "azonos név",
};

function ClusterCard({ cluster }: { cluster: Cluster }) {
  const [keepId, setKeepId] = useState(cluster.members[0].id);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) return null;

  const others = cluster.members.filter((m) => m.id !== keepId);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {cluster.reasons.map((r) => (
          <Badge key={r} variant="accent">
            {REASON_LABELS[r]}
          </Badge>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {cluster.members.map((m) => (
          <label
            key={m.id}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
              m.id === keepId
                ? "border-accent bg-accent-soft"
                : "border-border bg-background"
            }`}
          >
            <input
              type="radio"
              name={`keep-${cluster.members[0].id}`}
              checked={m.id === keepId}
              onChange={() => {
                setKeepId(m.id);
                setConfirming(false);
              }}
              className="h-4 w-4"
            />
            <div className="flex-1">
              <Link
                href={`/dashboard/contacts/${m.id}/edit`}
                className="font-medium text-foreground hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {m.name}
              </Link>
              <div className="text-muted-subtle">
                {[m.email, m.phone].filter(Boolean).join(" · ") || "Nincs elérhetőség megadva"}
              </div>
            </div>
            {m.id === keepId && <Badge variant="success">Ezt tartsd meg</Badge>}
          </label>
        ))}
      </div>

      <div>
        <Button
          variant={confirming ? "danger" : "secondary"}
          size="sm"
          disabled={isPending}
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            startTransition(async () => {
              await mergeClusterContacts(
                keepId,
                others.map((o) => o.id),
              );
              setDone(true);
            });
          }}
        >
          {isPending
            ? "Összevonás…"
            : confirming
              ? "Biztos? Kattints újra"
              : `Összevonás (${others.length} törlődik)`}
        </Button>
      </div>
    </Card>
  );
}

export function DuplicatesList({ clusters }: { clusters: Cluster[] }) {
  return (
    <div className="flex flex-col gap-4">
      {clusters.map((cluster) => (
        <ClusterCard key={cluster.members.map((m) => m.id).join("-")} cluster={cluster} />
      ))}
    </div>
  );
}
