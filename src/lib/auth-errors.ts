/**
 * Supabase Auth errors come back as raw English strings — this app is
 * otherwise fully Hungarian, so surfacing them as-is breaks that. Matches
 * on substrings (Supabase's exact wording varies by SDK version) and falls
 * back to a generic message rather than ever leaking English to the user.
 */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "Hibás email cím vagy jelszó.";
  }
  if (m.includes("email not confirmed")) {
    return "Az email cím még nincs megerősítve — nézd meg a postaládád.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Már létezik fiók ezzel az email címmel.";
  }
  if (m.includes("password should be at least") || m.includes("password is too short")) {
    return "A jelszónak legalább 6 karakter hosszúnak kell lennie.";
  }
  if (m.includes("should be different from the old password")) {
    return "Az új jelszónak különböznie kell a jelenlegitől.";
  }
  if (m.includes("is invalid") && m.includes("email")) {
    return "Érvénytelen email cím formátum.";
  }
  if (m.includes("for security purposes") || m.includes("rate limit")) {
    return "Túl sok próbálkozás — várj egy kicsit, és próbáld újra.";
  }
  if (m.includes("network") || m.includes("fetch failed")) {
    return "Nem sikerült kapcsolódni a szerverhez. Ellenőrizd az internetkapcsolatot.";
  }

  return "Hiba történt. Próbáld újra, és ha nem múlik el, jelezd a fejlesztőnek.";
}
