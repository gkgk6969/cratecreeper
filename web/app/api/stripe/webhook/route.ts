import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// Stripe requires the raw, unparsed body for signature verification.
async function readRawBody(request: Request): Promise<string> {
  return await request.text();
}

async function upsertFromSubscription(sub: Stripe.Subscription) {
  const admin = createSupabaseAdminClient();
  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  // Find which user this customer belongs to.
  const { data: row } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  const supabaseUserId =
    row?.user_id ?? (sub.metadata?.supabase_user_id as string | undefined);
  if (!supabaseUserId) return;

  const periodEnd = sub.items.data[0]?.current_period_end ?? null;

  await admin.from('subscriptions').upsert({
    user_id: supabaseUserId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    current_period_end: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const raw = await readRawBody(request);
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return NextResponse.json(
      { error: `Webhook signature failed: ${e instanceof Error ? e.message : ''}` },
      { status: 400 }
    );
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await upsertFromSubscription(event.data.object as Stripe.Subscription);
      break;

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await upsertFromSubscription(sub);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
