import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getUser, ensureTeacher } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { verifyOAuthState } from '@/lib/oauth-state'

/** Single-use state nonce: clear the cookie on every exit path. */
function redirectClearingState(url: URL) {
  const res = NextResponse.redirect(url)
  res.cookies.delete('oauth_state_stripe')
  return res
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = req.cookies.get('oauth_state_stripe')?.value
  const user = await getUser()
  if (
    !user ||
    !code ||
    !verifyOAuthState({ provider: 'stripe', state, cookieValue: cookieState, userId: user.id })
  ) {
    return redirectClearingState(new URL('/onboarding?step=stripe&error=oauth', req.url))
  }
  try {
    const resp = await stripe().oauth.token({ grant_type: 'authorization_code', code })
    await ensureTeacher(user.id)
    const { error } = await supabaseAdmin().from('teachers')
      .update({ stripe_account_id: resp.stripe_user_id })
      .eq('id', user.id)
    if (error) throw error
    return redirectClearingState(new URL('/onboarding?step=provider', req.url))
  } catch {
    return redirectClearingState(new URL('/onboarding?step=stripe&error=oauth', req.url))
  }
}
