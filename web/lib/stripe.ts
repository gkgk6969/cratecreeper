import Stripe from 'stripe';

// Lazily-created server-side Stripe client. Created on first use rather than at
// module load so that builds (which evaluate modules without runtime env) don't
// fail when STRIPE_SECRET_KEY is absent. Secret key never reaches the browser.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-05-27.dahlia',
      typescript: true,
    });
  }
  return _stripe;
}
