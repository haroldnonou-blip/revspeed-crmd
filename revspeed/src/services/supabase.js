import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const SUPABASE_ENABLED = !!(SUPABASE_URL && SUPABASE_KEY)

export const supabase = SUPABASE_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

console.info(
  SUPABASE_ENABLED
    ? '[Supabase] ✅ Connecté → ' + SUPABASE_URL
    : '[Supabase] ⚠️ Variables manquantes — localStorage actif'
)
