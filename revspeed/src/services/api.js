/**
 * RevSpeed — Service API
 * ──────────────────────────────────────────────────────────────────────────
 * Workflow :
 *   1. LECTURE  → Supabase "Leads" (source Facebook Lead Ads)
 *   2. FUSION   → merge avec l'état CRM stocké en localStorage
 *   3. GESTION  → toutes les actions CRM (status, vendeur, notes, RDV)
 *                 sont sauvegardées en localStorage uniquement
 *
 * Résultat : aucune modification de la table Supabase nécessaire.
 * Les nouveaux leads Facebook apparaissent automatiquement au démarrage.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { supabase, SUPABASE_ENABLED } from './supabase'

// ── Clés localStorage ────────────────────────────────────────────────────────
const LS_KEY      = '***'           // leads complets (merge Supabase + CRM)
const LEGACY_KEYS = ['revspeed_leads', 'revspeed_leads_v1']

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING  Supabase → App
// Colonnes réelles de la table "Leads" (export Facebook Lead Ads)
// ─────────────────────────────────────────────────────────────────────────────

function fromRow(row) {
  // Nettoyer les préfixes Facebook : p: (téléphone), z: (code postal)
  const tel      = (row.phone_number ?? '').replace(/^p:/, '')
  const cp       = (row.post_code    ?? '').replace(/^z:/, '')
  const gamme    = row['quelle_gamme_triumph_vous_intéresse_?'] ?? ''

  return {
    // Identité (depuis Supabase)
    id:            row.id            ?? crypto.randomUUID(),
    nom:           row.full_name     ?? '',
    tel,
    email:         row.email         ?? '',
    codePostal:    cp,
    createdAt:     row.created_time  ? new Date(row.created_time).getTime()
                 : row.created_at   ? new Date(row.created_at).getTime() : Date.now(),
    // Champs Facebook (info supplémentaire)
    leadStatus:    row.lead_status   ?? null,
    adName:        row.ad_name       ?? null,
    campaignName:  row.campaign_name ?? null,
    gamme,
    // Champs CRM — valeurs par défaut (seront écrasées par l'état localStorage)
    status:        'prospect',
    priorité:      'moyenne',
    vendeur:       '',
    qualification: gamme,           // pré-rempli avec la gamme choisie par le lead
    notes:         '',
    issueAppel:    '',
    rdvDate:       '',
    rdvTime:       '',
    rdvType:       '',
    rdvDuration:   '',
    archivedFrom:  null,
    archivedAt:    null,
    updatedAt:     null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function isToday(dateInput) {
  if (!dateInput) return false
  const d = new Date(dateInput), t = new Date()
  return d.getDate() === t.getDate() &&
         d.getMonth() === t.getMonth() &&
         d.getFullYear() === t.getFullYear()
}

function dispatch(action) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('leadsUpdated', { detail: { action, timestamp: Date.now() } }))
}

function lsRead() {
  let raw = localStorage.getItem(LS_KEY)
  if (!raw) {
    for (const k of LEGACY_KEYS) {
      raw = localStorage.getItem(k)
      if (raw) { localStorage.setItem(LS_KEY, raw); LEGACY_KEYS.forEach(lk => localStorage.removeItem(lk)); break }
    }
  }
  try { return raw ? JSON.parse(raw) : null } catch { return null }
}

function lsWrite(leads) { localStorage.setItem(LS_KEY, JSON.stringify(leads)) }

// Champs CRM gérés localement (ne viennent PAS de Supabase)
const CRM_FIELDS = ['status','priorité','vendeur','qualification','notes',
  'issueAppel','rdvDate','rdvTime','rdvType','rdvDuration',
  'archivedFrom','archivedAt','updatedAt']

/** Fusionne un lead Supabase avec l'état CRM du localStorage */
function mergeWithCrm(supabaseLead, existing) {
  if (!existing) return supabaseLead
  const crm = {}
  for (const f of CRM_FIELDS) {
    // Prend la valeur CRM si elle est définie (non vide / non nulle)
    if (existing[f] !== undefined && existing[f] !== '' && existing[f] !== null) {
      crm[f] = existing[f]
    }
  }
  return { ...supabaseLead, ...crm }
}

// ─────────────────────────────────────────────────────────────────────────────
// API PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────

export const api = {

  // ── getLeads ───────────────────────────────────────────────────────────────
  async getLeads(filter = null) {
    const existing    = lsRead() ?? []
    const existingMap = Object.fromEntries(existing.map(l => [l.id, l]))

    if (SUPABASE_ENABLED) {
      console.log('[Supabase] 📥 Récupération des leads Facebook…')

      const { data, error } = await supabase
        .from('Leads')
        .select('id, full_name, phone_number, email, post_code, created_time, lead_status, ad_name, campaign_name, "quelle_gamme_triumph_vous_intéresse_?"')
        .order('created_time', { ascending: false })

      if (error) {
        console.error('[Supabase] ❌ Erreur lecture:', error.message, '→ fallback localStorage')
        return existing
      }

      // Conversion + fusion avec l'état CRM existant
      let newCount = 0
      const supabaseLeads = (data ?? []).map(row => {
        const base     = fromRow(row)
        const existing = existingMap[base.id]
        if (!existing) newCount++
        return mergeWithCrm(base, existing ?? null)
      })

      // Conserver les leads créés directement dans le CRM (non Facebook)
      const supabaseIds  = new Set((data ?? []).map(r => r.id))
      const crmOnlyLeads = existing.filter(l => !supabaseIds.has(l.id))

      const all = [...supabaseLeads, ...crmOnlyLeads]

      if (newCount > 0) console.log(`[Supabase] 🆕 ${newCount} nouveau(x) lead(s) Facebook importé(s)`)
      console.log(`[Supabase] ✅ ${all.length} leads au total (${supabaseLeads.length} Supabase + ${crmOnlyLeads.length} CRM local)`)

      // Filtrage par date si demandé
      const result = filter === 'today'
        ? all.filter(l => isToday(l.createdAt))
        : all

      // Sauvegarder la liste fusionnée en localStorage
      lsWrite(all)
      return result
    }

    // Mode localStorage pur
    return filter === 'today' ? existing.filter(l => isToday(l.createdAt)) : existing
  },

  // ── saveLeads — auto-persist React → localStorage ──────────────────────────
  async saveLeads(leads) {
    lsWrite(leads)
    return leads
  },

  // ── saveLead — créer ou mettre à jour un lead ──────────────────────────────
  async saveLead(lead) {
    const current = lsRead() ?? []
    let idx = lead.id ? current.findIndex(l => l.id === lead.id) : -1
    if (idx < 0 && lead.email?.trim())
      idx = current.findIndex(l => l.email?.trim().toLowerCase() === lead.email.trim().toLowerCase())
    if (idx < 0 && lead.tel?.trim()) {
      const t = lead.tel.replace(/\D/g, '')
      if (t.length >= 8) idx = current.findIndex(l => l.tel?.replace(/\D/g, '') === t)
    }
    let merged = false
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...lead, id: current[idx].id, createdAt: current[idx].createdAt, updatedAt: Date.now() }
      merged = true
    } else {
      current.push({ id: lead.id ?? crypto.randomUUID(), createdAt: lead.createdAt ?? Date.now(), ...lead })
    }
    lsWrite(current)
    const saved = idx >= 0 ? current[idx] : current[current.length - 1]
    dispatch('saveLead')
    return { lead: saved, merged }
  },

  // ── updateLead — sauvegarder les actions CRM ───────────────────────────────
  async updateLead(leadId, updates) {
    const current = lsRead() ?? []
    const idx = current.findIndex(l => l.id === leadId)
    if (idx < 0) return null
    current[idx] = { ...current[idx], ...updates, updatedAt: Date.now() }
    lsWrite(current)
    dispatch('updateLead')
    return current[idx]
  },

  // ── archiveLead ────────────────────────────────────────────────────────────
  async archiveLead(leadId) {
    const current = lsRead() ?? []
    const idx = current.findIndex(l => l.id === leadId)
    if (idx < 0) return null
    current[idx] = {
      ...current[idx],
      status:       'archivé',
      archivedFrom: current[idx].status,
      archivedAt:   Date.now(),
    }
    lsWrite(current)
    dispatch('archiveLead')
    return current[idx]
  },

  // ── deleteLead ─────────────────────────────────────────────────────────────
  async deleteLead(leadId) {
    lsWrite((lsRead() ?? []).filter(l => l.id !== leadId))
    dispatch('deleteLead')
  },

  // ── clearAll — réinitialiser (recharge les leads Supabase au prochain load) ─
  async clearAll() {
    localStorage.removeItem(LS_KEY)
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k))
  },
}

console.info(
  SUPABASE_ENABLED
    ? '[RevSpeed] 🟢 Source : Supabase → leads Facebook importés automatiquement'
    : '[RevSpeed] 🟡 Source : localStorage (configurer VITE_SUPABASE_URL pour activer Supabase)'
)
