// ============================================================================
// test-pricing.mjs — verify every checkout creates a Stripe session with the
// CORRECT amount + interval. Creating a Checkout Session charges NOTHING (money
// only moves if a customer completes it at the URL); these expire unused.
//
// It mirrors the exact price_data each route builds, so a mismatch here = a
// mismatch in production. Run: node scripts/test-pricing.mjs
// ============================================================================
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim()
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const URLS = { success_url: 'https://shapi.io/x', cancel_url: 'https://shapi.io/x' }
let failed = 0
const ok = (m) => console.log('  ✅ ' + m)
const bad = (m) => { console.log('  ❌ ' + m); failed++ }

// [label, mode, unit_amount(cents), recurring|null, expectedTotal, expectedInterval]
const CASES = [
  ['CV $25 one-time',        'payment',      2500,   null,                       2500],
  ['Pro $59/mo',             'subscription', 5900,   { interval: 'month' },                  5900, 'month', 1],
  ['Pro $159/quarter',       'subscription', 15900,  { interval: 'month', interval_count: 3 }, 15900, 'month', 3],
  ['Concierge $99/mo',       'subscription', 9900,   { interval: 'month' },                  9900, 'month', 1],
  ['Company Pro $499/mo',    'subscription', 49900,  { interval: 'month' },                  49900, 'month', 1],
  ['Company Pro $4,990/yr',  'subscription', 499000, { interval: 'year' },                   499000, 'year', 1],
  ['Company Growth $1,500/mo','subscription', 150000, { interval: 'month' },                 150000, 'month', 1],
  ['Company Growth $15,000/yr','subscription', 1500000, { interval: 'year' },                1500000, 'year', 1],
]

console.log('\n── Stripe pricing verification (live mode, no charges) ──────────')
for (const [label, mode, amt, recurring, expTotal, expInt, expCount] of CASES) {
  try {
    const session = await stripe.checkout.sessions.create({
      mode, ...URLS,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'TEST ' + label },
          unit_amount: amt,
          ...(recurring ? { recurring } : {}),
        },
        quantity: 1,
      }],
    }, { expand: undefined })

    const full = await stripe.checkout.sessions.retrieve(session.id, { expand: ['line_items', 'line_items.data.price'] })
    const total = full.amount_total
    const price = full.line_items?.data?.[0]?.price
    const okTotal = total === expTotal
    let okRec = true
    if (recurring) {
      const r = price?.recurring
      okRec = r?.interval === expInt && (r?.interval_count ?? 1) === expCount
    }
    if (okTotal && okRec) {
      ok(`${label} → ${(total/100).toFixed(2)} ${recurring ? `/${expCount > 1 ? expCount + ' ' : ''}${expInt}` : 'one-time'}`)
    } else {
      bad(`${label} → got total ${total} (want ${expTotal})${recurring ? `, interval ${price?.recurring?.interval}×${price?.recurring?.interval_count} (want ${expInt}×${expCount})` : ''}`)
    }
    // expire the session so it can never be used
    try { await stripe.checkout.sessions.expire(session.id) } catch {}
  } catch (e) {
    bad(`${label} → Stripe error: ${e.message}`)
  }
}

console.log('─────────────────────────────────────────────────────────────────')
console.log(failed ? `❌ ${failed} pricing check(s) FAILED\n` : '✅ All checkout amounts + intervals correct\n')
process.exit(failed ? 1 : 0)
