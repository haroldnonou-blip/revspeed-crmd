import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const SUPABASE_ENABLED = !!(SUPABASE_URL && SUPABASE_KEY)

export const supabase = SUPABASE_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

// Log uniquement en développement — jamais en production
if (import.meta.env.DEV) {
  console.info(
    SUPABASE_ENABLED
      ? '[Supabase] ✅ Connecté (dev)'
      : '[Supabase] ⚠️ Variables manquantes — localStorage actif'
  )
}
