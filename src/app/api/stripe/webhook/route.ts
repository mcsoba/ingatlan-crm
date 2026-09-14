import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const agencyId = session.metadata?.agency_id;
      if (agencyId && session.subscription) {
        await admin
          .from("agencies")
          .update({
            plan_tier: "pro",
            stripe_subscription_id: String(session.subscription),
          })
          .eq("id", agencyId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const isActive = ["active", "trialing"].includes(subscription.status);
      await admin
        .from("agencies")
        .update({ plan_tier: isActive ? "pro" : "free" })
        .eq("stripe_customer_id", String(subscription.customer));
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await admin
        .from("agencies")
        .update({ plan_tier: "free", stripe_subscription_id: null })
        .eq("stripe_customer_id", String(subscription.customer));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
