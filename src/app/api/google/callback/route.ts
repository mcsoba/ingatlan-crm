import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { exchangeCodeForTokens } from "@/lib/google";

export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get("google_oauth_state")?.value;

  const redirectWithError = (message: string) =>
    NextResponse.redirect(`${siteUrl}/dashboard/settings?error=${encodeURIComponent(message)}`);

  if (!code) {
    return redirectWithError("A Google nem küldött engedélyezési kódot");
  }
  if (!state || !cookieState || state !== cookieState) {
    return redirectWithError("Érvénytelen vagy lejárt kérés, próbáld újra a csatlakoztatást");
  }

  try {
    const { profile } = await ensureCurrentUserProfile();
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      throw new Error(
        "A Google nem adott vissza frissítő tokent — vond vissza a hozzáférést a Google-fiókodban (myaccount.google.com/permissions), majd próbáld újra",
      );
    }

    const supabase = await createClient();
    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error } = await supabase.from("google_calendar_connections").upsert({
      profile_id: profile.id,
      agency_id: profile.agency_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiry,
    });

    if (error) throw error;

    const response = NextResponse.redirect(`${siteUrl}/dashboard/settings?google=connected`);
    response.cookies.delete("google_oauth_state");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hiba történt";
    return redirectWithError(message);
  }
}
