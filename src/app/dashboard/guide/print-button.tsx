"use client";

import { Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonVariants("secondary", "sm")}>
      <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
      Nyomtatás
    </button>
  );
}
