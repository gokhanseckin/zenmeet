import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_URL: z.string().url(),
  CRON_SECRET: z.string().min(16),
  TOKEN_ENC_KEY: z.string().min(40), // base64 of 32 bytes
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_CONNECT_CLIENT_ID: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  ZOOM_CLIENT_ID: z.string().min(1),
  ZOOM_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
})

let cached: z.infer<typeof schema> | null = null
/** Server-only. Throws with a readable message listing missing vars. */
export function env() {
  if (!cached) cached = schema.parse(process.env)
  return cached
}
