import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

// Lazy — constructing Stripe with a missing key throws immediately, which
// would crash any page that merely imports this module (e.g. the billing
// page, which only needs PRO_PLAN_PRICE_HUF). Only routes that actually
// call Stripe should call this.
export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error(
        "STRIPE_SECRET_KEY nincs beállítva — add meg a .env.local-ban a Stripe funkciók használatához",
      );
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeInstance;
}

export const PRO_PLAN_PRICE_HUF = 14900;
