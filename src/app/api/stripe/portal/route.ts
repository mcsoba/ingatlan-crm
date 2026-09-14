import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

export async function POST(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  try {
    const { profile } = await ensureCurrentUserProfile();

    if (profile.role !== "owner") {
      return NextResponse.redirect(
        `${siteUrl}/dashboard/billing?error=${encodeURIComponent("Csak az iroda tulajdonosa kezelheti az előfizetést")}`,
        { status: 303 },
      );
    }

    const supabase = await createClient();
    const { data: agency } = await supabase
      .from("agencies")
      .select("stripe_customer_id")
      .eq("id", profile.agency_id)
      .single();

    if (!agency?.stripe_customer_id) {
      throw new Error("Nincs Stripe-ügyfél ehhez az irodához");
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: agency.stripe_customer_id,
      return_url: `${siteUrl}/dashboard/billing`,
    });

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hiba történt";
    return NextResponse.redirect(
      `${siteUrl}/dashboard/billing?error=${encodeURIComponent(message)}`,
      { status: 303 },
    );
  }
}
