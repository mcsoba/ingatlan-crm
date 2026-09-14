import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Server-only, never import from a
 * "use client" file. Used for cross-tenant auth admin operations
 * (inviting/removing team members) that the anon-key client can't do.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
