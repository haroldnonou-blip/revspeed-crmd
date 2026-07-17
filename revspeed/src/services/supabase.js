/**
 * RevSpeed — Client Supabase
 * ──────────────────────────────────────────────────────────────
 * Variables d'environnement requises (Vercel + fichier .env local) :
 *   VITE_SUPABASE_URL=https://ruvudxuecygqzpjladsu.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJhbG…
 * ──────────────────────────────────────────────────────────────
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/** true si Supabase est configuré, false → fallback localStorage */
export const SUPABASE_ENABLED = !!(SUPABASE_URL && SUPABASE_KEY)

export const supabase = SUPABASE_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

if (SUPABASE_ENABLED) {
  console.info('[Supabase] ✅ Connecté →', SUPABASE_URL)
} else {
  console.warn('[Supabase] ⚠️ Clés manquantes — mode localStorage')
}
