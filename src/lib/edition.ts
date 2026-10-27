// Kiadások (ugyanaz a kódbázis, telepítésenként env-változóval választva):
// - "saas" (alapértelmezett): nyilvános nyitóoldal, árazás, regisztráció, Stripe-előfizetés
// - "private": egy irodának átadott, saját telepítés (pl. Bluegate) — nincs
//   előfizetés, csomag-felirat, árazás és nyilvános regisztráció; minden funkció elérhető.
//   Új munkatárs a Csapat oldalon meghívással kerül be.
//
// NEXT_PUBLIC_, hogy a kliens-komponensek (pl. oldalsáv) is lássák.
export const PRIVATE_EDITION = process.env.NEXT_PUBLIC_APP_EDITION === "private";

// Privát kiadásban az első (tulajdonosi) fiók létrehozásához ideiglenesen
// engedélyezhető a regisztráció (ALLOW_SIGNUP=1), utána érdemes kivenni.
export const SIGNUP_ENABLED = !PRIVATE_EDITION || process.env.ALLOW_SIGNUP === "1";

// Az oldalsávban / kezdőlapon megjelenő csomag-felirat (privát kiadásban nincs)
export function planLabel(planTier: string): string | null {
  if (PRIVATE_EDITION) return null;
  return planTier === "pro" ? "Pro csomag" : "Ingyenes csomag";
}
