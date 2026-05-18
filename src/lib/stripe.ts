import Stripe from 'stripe'

// Single switch: STRIPE_MODE=test toggles to test keys + test webhook secret.
// Default is 'live' so production behaviour is unchanged unless explicitly opted in.
//
// To run end-to-end payment tests:
//   1. In Stripe Dashboard, switch to TEST MODE (top-right toggle)
//   2. Get your test API key (sk_test_…) and add as STRIPE_SECRET_KEY_TEST in Vercel
//   3. Add a Webhook endpoint pointing to https://shapi.io/api/stripe/webhook,
//      copy its signing secret (whsec_…) and add as STRIPE_WEBHOOK_SECRET_TEST in Vercel
//   4. Set STRIPE_MODE=test in Vercel → redeploy
//   5. Use test cards (4242 4242 4242 4242) at checkout — no real charges
//   6. To go back to live: set STRIPE_MODE=live (or remove the var) → redeploy

export const stripeMode: 'test' | 'live' =
  (process.env.STRIPE_MODE === 'test' ? 'test' : 'live')

export function getStripe(): Stripe {
  const key = stripeMode === 'test'
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(`Stripe secret key not configured for mode "${stripeMode}". Set ${stripeMode === 'test' ? 'STRIPE_SECRET_KEY_TEST' : 'STRIPE_SECRET_KEY'} in env.`)
  }
  return new Stripe(key)
}

export function getWebhookSecret(): string {
  const secret = stripeMode === 'test'
    ? process.env.STRIPE_WEBHOOK_SECRET_TEST
    : process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error(`Stripe webhook secret not configured for mode "${stripeMode}". Set ${stripeMode === 'test' ? 'STRIPE_WEBHOOK_SECRET_TEST' : 'STRIPE_WEBHOOK_SECRET'} in env.`)
  }
  return secret
}

export const isTestMode = stripeMode === 'test'
