import { createClient } from '@supabase/supabase-js'

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const configuredAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigurationError =
  !configuredUrl || !/^https?:\/\//.test(configuredUrl)
    ? 'NEXT_PUBLIC_SUPABASE_URL is not configured correctly'
    : !configuredAnonKey
      ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not configured'
      : null

// Keep the module buildable so the API can return a useful runtime error when
// Vercel environment variables are missing instead of failing page generation.
export const supabase = createClient(
  configuredUrl && /^https?:\/\//.test(configuredUrl)
    ? configuredUrl
    : 'https://placeholder.supabase.co',
  configuredAnonKey || 'placeholder-anon-key'
)
