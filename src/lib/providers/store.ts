import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import { encryptJson, decryptJson } from '@/lib/crypto'
import type { StoredTokens, TokenStore } from './types'

export function teacherTokenStore(teacherId: string, provider: 'zoom' | 'google'): TokenStore {
  const col = provider === 'zoom' ? 'zoom_tokens_enc' : 'google_tokens_enc'
  const flag = provider === 'zoom' ? 'zoom_needs_reconnect' : 'google_needs_reconnect'
  const db = supabaseAdmin()
  return {
    async load() {
      const { data, error } = await db.from('teachers').select(col).eq('id', teacherId).single()
      if (error) throw new Error(`token store load: ${error.message}`)
      const enc = (data as any)?.[col]
      return enc ? decryptJson<StoredTokens>(enc, env().TOKEN_ENC_KEY) : null
    },
    async save(tokens) {
      const { error } = await db.from('teachers').update({ [col]: encryptJson(tokens, env().TOKEN_ENC_KEY), [flag]: false }).eq('id', teacherId)
      if (error) throw new Error(`token store save: ${error.message}`)
    },
    async markNeedsReconnect() {
      await db.from('teachers').update({ [flag]: true }).eq('id', teacherId)
    },
  }
}

export async function saveTeacherTokens(teacherId: string, provider: 'zoom' | 'google', tokens: StoredTokens) {
  await teacherTokenStore(teacherId, provider).save(tokens)
}
