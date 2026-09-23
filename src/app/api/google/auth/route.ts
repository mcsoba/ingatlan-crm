import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { getGoogleAuthUrl } from "@/lib/google";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  await ensureCurrentUserProfile();

  try {
    const state = randomUUID();
    const url = getGoogleAuthUrl(state);
    const response = NextResponse.redirect(url);
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hiba történt";
    return NextResponse.redirect(
      `${siteUrl}/dashboard/settings?tab=profil&error=${encodeURIComponent(message)}`,
    );
  }
}
