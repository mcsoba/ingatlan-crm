import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { registerForPush, unregisterPush } from "../lib/push";

export type Profile = {
  id: string;
  agency_id: string;
  role: "owner" | "admin" | "agent";
  full_name: string | null;
  agencyName: string | null;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, agency_id, role, full_name, agencies(name)")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  const agency = data.agencies as { name?: string } | { name?: string }[] | null;
  const agencyName = Array.isArray(agency) ? agency[0]?.name : agency?.name;
  return {
    id: data.id,
    agency_id: data.agency_id,
    role: data.role,
    full_name: data.full_name,
    agencyName: agencyName ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) setProfile(await loadProfile(data.session.user.id));
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) loadProfile(next.user.id).then(setProfile);
      else setProfile(null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) return null;
    if (/invalid login/i.test(error.message)) return "Hibás e-mail cím vagy jelszó.";
    if (/email not confirmed/i.test(error.message)) return "Az e-mail címed még nincs megerősítve.";
    return "Nem sikerült a bejelentkezés. Ellenőrizd az internetkapcsolatot.";
  }

  // Bejelentkezett felhasználónál az eszköz regisztrálása push-értesítésekre
  useEffect(() => {
    if (profile) registerForPush().catch(() => {});
  }, [profile]);

  async function signOut() {
    await unregisterPush().catch(() => {});
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth: hiányzó AuthProvider");
  return ctx;
}
