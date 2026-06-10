import 'server-only'
import Stripe from 'stripe'
import { env } from '@/lib/env'

export function stripe() {
  return new Stripe(env().STRIPE_SECRET_KEY)
}

/** Same client, scoped to a connected account for direct-charge operations. */
export function onAccount(accountId: string): Stripe.RequestOptions {
  return { stripeAccount: accountId }
}
