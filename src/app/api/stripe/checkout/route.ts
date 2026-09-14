import { NextResponse } from "next/server";
import { getStripe, PRO_PLAN_PRICE_HUF } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

export async function POST(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  try {
    const { user, profile } = await ensureCurrentUserProfile();

    if (profile.role !== "owner") {
      return NextResponse.redirect(
        `${siteUrl}/dashboard/billing?error=${encodeURIComponent("Csak az iroda tulajdonosa válthat csomagot")}`,
        { status: 303 },
      );
    }

    const supabase = await createClient();
    const { data: agency } = await supabase
      .from("agencies")
      .select("stripe_customer_id")
      .eq("id", profile.agency_id)
      .single();

    let customerId = agency?.stripe_customer_id ?? null;
    const stripe = getStripe();

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { agency_id: profile.agency_id },
      });
      customerId = customer.id;

      await supabase
        .from("agencies")
        .update({ stripe_customer_id: customerId })
        .eq("id", profile.agency_id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "huf",
            product_data: { name: "Ingatlan CRM — Pro csomag" },
            unit_amount: PRO_PLAN_PRICE_HUF * 100,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      metadata: { agency_id: profile.agency_id },
      success_url: `${siteUrl}/dashboard/billing?success=1`,
      cancel_url: `${siteUrl}/dashboard/billing`,
    });

    if (!session.url) {
      throw new Error("Nem sikerült a checkout létrehozása");
    }

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hiba történt";
    return NextResponse.redirect(
      `${siteUrl}/dashboard/billing?error=${encodeURIComponent(message)}`,
      { status: 303 },
    );
  }
}
