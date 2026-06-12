import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import { encryptJson, decryptJson } from '@/lib/crypto'
import type { StoredTokens, TokenStore, SaveOptions } from './types'

export function teacherTokenStore(teacherId: string, provider: 'zoom' | 'google'): TokenStore {
  const col = provider === 'zoom' ? 'zoom_tokens_enc' : 'google_tokens_enc'
  const flag = provider === 'zoom' ? 'zoom_needs_reconnect' : 'google_needs_reconnect'
  // AAD binds ciphertext to this exact row+provider, so a blob copied into
  // another teacher's column fails the GCM auth tag (legacy rows self-heal,
  // see crypto.decryptJson).
  const aad = `${teacherId}:${provider}`
  const db = supabaseAdmin()
  return {
    async load() {
      const { data, error } = await db.from('teachers').select(col).eq('id', teacherId).single()
      if (error) throw new Error(`token store load: ${error.message}`)
      const enc = (data as any)?.[col] as string | null | undefined
      if (!enc) return null
      return { tokens: decryptJson<StoredTokens>(enc, env().TOKEN_ENC_KEY, aad), cas: enc }
    },
    async save(tokens: StoredTokens, opts?: SaveOptions) {
      const enc = encryptJson(tokens, env().TOKEN_ENC_KEY, aad)
      let q = db.from('teachers').update({ [col]: enc, [flag]: false }).eq('id', teacherId)
      // Compare-and-set: only overwrite if the stored ciphertext still equals
      // the value we loaded. A concurrent refresher that already rotated the
      // token changes the ciphertext, so our stale save matches zero rows.
      if (opts?.expectedCas !== undefined) q = q.eq(col, opts.expectedCas)
      const { data, error } = await q.select('id')
      if (error) throw new Error(`token store save: ${error.message}`)
      return (data?.length ?? 0) > 0
    },
    async markNeedsReconnect(opts?: SaveOptions) {
      let q = db.from('teachers').update({ [flag]: true }).eq('id', teacherId)
      // Only flag if the stored token is still the one that failed to refresh.
      // If it changed (a concurrent refresh succeeded), don't flag a teacher
      // whose tokens are actually fine.
      if (opts?.expectedCas !== undefined) q = q.eq(col, opts.expectedCas)
      const { data, error } = await q.select('id')
      if (error) throw new Error(`token store markNeedsReconnect: ${error.message}`)
      return (data?.length ?? 0) > 0
    },
  }
}

export async function saveTeacherTokens(teacherId: string, provider: 'zoom' | 'google', tokens: StoredTokens) {
  await teacherTokenStore(teacherId, provider).save(tokens)
}
