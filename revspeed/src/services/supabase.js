/**
 * RevSpeed — Client Supabase
 * ──────────────────────────────────────────────────────────────
 * Variables d'environnement requises (fichier .env à la racine) :
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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
  console.info('[Supabase] ✅ Client initialisé →', SUPABASE_URL)
} else {
  console.warn('[Supabase] ⚠️ Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes — mode localStorage activé')
}
