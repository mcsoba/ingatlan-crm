import { redirect } from "next/navigation";
import { SIMPLE_MODE } from "@/lib/edition";

// Egyszerű módban elrejtett menüpontok layoutja: közvetlen címről (könyvjelző,
// régi link) is az Áttekintésre visz.
export function HiddenInSimpleMode({ children }: { children: React.ReactNode }) {
  if (SIMPLE_MODE) redirect("/dashboard");
  return children;
}
