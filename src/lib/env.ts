import { z } from 'zod'

const publicAppSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  APP_URL: z.string().url(),
})

const supabaseAdminSchema = publicAppSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

const cronSchema = publicAppSchema.extend({
  CRON_SECRET: z.string().min(16),
})

const tokenSchema = publicAppSchema.extend({
  // base64 of exactly 32 bytes (AES-256 key); fail at boot, not at runtime.
  TOKEN_ENC_KEY: z.string().refine(
    (s) => { try { return Buffer.from(s, 'base64').length === 32 } catch { return false } },
    'TOKEN_ENC_KEY must be base64 of exactly 32 bytes',
  ),
})

const billingSchema = publicAppSchema.extend({
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_CONNECT_CLIENT_ID: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
})

const zoomSchema = publicAppSchema.extend({
  ZOOM_CLIENT_ID: z.string().min(1),
  ZOOM_CLIENT_SECRET: z.string().min(1),
})

const googleSchema = publicAppSchema.extend({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
})

const schema = publicAppSchema
  .merge(supabaseAdminSchema)
  .merge(cronSchema)
  .merge(tokenSchema)
  .merge(billingSchema)
  .merge(zoomSchema)
  .merge(googleSchema)

let cached: z.infer<typeof schema> | null = null
type EnvSource = Record<string, string | undefined>

/** Server-only. Throws with a readable message listing missing vars. */
export function env() {
  if (!cached) cached = schema.parse(process.env)
  return cached
}

export function publicAppEnv(source: EnvSource = process.env) {
  return publicAppSchema.parse(source)
}

export function supabaseAdminEnv(source: EnvSource = process.env) {
  return supabaseAdminSchema.parse(source)
}

export function cronEnv(source: EnvSource = process.env) {
  return cronSchema.parse(source)
}

export function tokenEnv(source: EnvSource = process.env) {
  return tokenSchema.parse(source)
}

export function billingEnv(source: EnvSource = process.env) {
  return billingSchema.parse(source)
}

export function zoomEnv(source: EnvSource = process.env) {
  return zoomSchema.parse(source)
}

export function googleEnv(source: EnvSource = process.env) {
  return googleSchema.parse(source)
}
