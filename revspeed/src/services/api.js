/**
 * RevSpeed — Service API centralisé
 * ──────────────────────────────────────────────────────────────────────────
 * Mode automatique :
 *   → SUPABASE  si VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY sont définis
 *   → localStorage  sinon (dev / démo sans backend)
 *
 * ── API publique ──────────────────────────────────────────────────────────
 *   getLeads()              → Promise<Lead[]>
 *   saveLeads(leads)        → Promise<Lead[]>          bulk upsert
 *   saveLead(lead)          → Promise<Lead>            upsert (id > email > tél)
 *   updateLead(id, updates) → Promise<Lead|null>       patch partiel
 *   deleteLead(id)          → Promise<void>
 *   archiveLead(id)         → Promise<Lead|null>
 *   clearAll()              → Promise<void>
 *
 * ── Schéma Lead (champs supportés) ───────────────────────────────────────
 *   Identité       : id, createdAt, updatedAt
 *   Contact        : nom, tel, email, codePostal
 *   Pipeline       : status, priorité, vendeur
 *   Qualification  : qualification, notes, issueAppel
 *   Rendez-vous    : rdvDate, rdvTime, rdvType, rdvDuration
 *   Archivage      : archivedFrom, archivedAt
 *   Facebook       : facebookId, leadStatus, adName, campaignName…
 * ──────────────────────────────────────────────────────────────────────────
 */

import { supabase, SUPABASE_ENABLED } from './supabase'

// ── Clés localStorage (fallback) ────────────────────────────────────────────
const LS_KEY      = 'revspeed_leads_v2'
const LEGACY_KEYS = ['revspeed_leads', 'revspeed_leads_v1']

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING  App (camelCase) ↔ Supabase (snake_case)
// ─────────────────────────────────────────────────────────────────────────────

/** Convertit un lead de l'app vers le format colonne Supabase */
function toRow(lead) {
  return {
    id:             lead.id                                          ?? undefined,
    first_name:     lead.nom                                         ?? null,
    phone:          lead.tel                                         ?? null,
    email:          lead.email                                       ?? null,
    code_postal:    lead.codePostal                                  ?? null,
    status:         lead.status                                      ?? 'prospect',
    priorite:       lead.priorité                                    ?? 'moyenne',
    vendeur:        lead.vendeur                                     ?? null,
    vous_souhaitez: lead.qualification                               ?? null,
    notes:          lead.notes                                       ?? null,
    issue_appel:    lead.issueAppel                                  ?? null,
    rdv_date:       lead.rdvDate      || null,
    rdv_time:       lead.rdvTime      || null,
    rdv_type:       lead.rdvType      || null,
    rdv_duration:   lead.rdvDuration  ? parseInt(lead.rdvDuration)  : null,
    archived_from:  lead.archivedFrom ?? null,
    archived_at:    lead.archivedAt   ? new Date(lead.archivedAt).toISOString() : null,
    created_at:     lead.createdAt    ? new Date(lead.createdAt).toISOString()  : undefined,
    // Champs Facebook (si présents)
    facebook_id:    lead.facebookId   ?? null,
    lead_status:    lead.leadStatus   ?? null,
    ad_name:        lead.adName       ?? null,
    campaign_name:  lead.campaignName ?? null,
  }
}

/** Convertit une ligne Supabase vers le format lead de l'app */
function fromRow(row) {
  return {
    id:            row.id,
    nom:           row.first_name    ?? '',
    tel:           row.phone         ?? '',
    email:         row.email         ?? '',
    codePostal:    row.code_postal   ?? '',
    status:        row.status        ?? 'prospect',
    priorité:      row.priorite      ?? 'moyenne',
    vendeur:       row.vendeur       ?? '',
    qualification: row.vous_souhaitez ?? '',
    notes:         row.notes         ?? '',
    issueAppel:    row.issue_appel   ?? '',
    rdvDate:       row.rdv_date      ?? '',
    rdvTime:       row.rdv_time      ?? '',
    rdvType:       row.rdv_type      ?? '',
    rdvDuration:   row.rdv_duration  != null ? String(row.rdv_duration) : '',
    archivedFrom:  row.archived_from ?? null,
    archivedAt:    row.archived_at   ? new Date(row.archived_at).getTime()  : null,
    createdAt:     row.created_at    ? new Date(row.created_at).getTime()   : null,
    updatedAt:     row.updated_at    ? new Date(row.updated_at).getTime()   : null,
    facebookId:    row.facebook_id   ?? null,
    leadStatus:    row.lead_status   ?? null,
    adName:        row.ad_name       ?? null,
    campaignName:  row.campaign_name ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNES
// ─────────────────────────────────────────────────────────────────────────────

export function isToday(dateInput) {
  if (!dateInput) return false
  const d = new Date(dateInput), t = new Date()
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
}

// ── localStorage ─────────────────────────────────────────────────────────────

function lsRead() {
  let raw = localStorage.getItem(LS_KEY)
  if (!raw) {
    for (const k of LEGACY_KEYS) {
      raw = localStorage.getItem(k)
      if (raw) { localStorage.setItem(LS_KEY, raw); LEGACY_KEYS.forEach(lk => localStorage.removeItem(lk)); break }
    }
  }
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function lsWrite(leads) { localStorage.setItem(LS_KEY, JSON.stringify(leads)) }

// ── Dispatch événement React (intra-onglet) ───────────────────────────────────

function dispatch(action) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('leadsUpdated', { detail: { action, timestamp: Date.now() } }))
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE SUPABASE
// ─────────────────────────────────────────────────────────────────────────────

const sb = {

  async getLeads(filter = null) {
    console.log('[Supabase] 📥 getLeads — requête en cours…')
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (filter === 'today') {
      const today = new Date().toISOString().split('T')[0]
      query = query.gte('created_at', today + 'T00:00:00').lte('created_at', today + 'T23:59:59')
    }
    const { data, error } = await query
    if (error) { console.error('[Supabase] ❌ getLeads erreur:', error.message); return [] }
    const leads = data.map(fromRow)
    console.log(`[Supabase] ✅ getLeads → ${leads.length} lead(s) reçu(s)`)
    return leads
  },

  async saveLeads(leads) {
    console.log(`[Supabase] 📤 saveLeads — upsert de ${leads.length} lead(s)…`)
    const rows = leads.map(toRow)
    const { data, error } = await supabase.from('leads').upsert(rows, { onConflict: 'id' }).select()
    if (error) { console.error('[Supabase] ❌ saveLeads erreur:', error.message); return leads }
    console.log(`[Supabase] ✅ saveLeads → ${data.length} lead(s) sauvegardé(s)`)
    return data.map(fromRow)
  },

  async saveLead(lead) {
    console.log('[Supabase] 📤 saveLead —', lead.nom || lead.id)
    const row = toRow(lead)

    // Si pas d'id → insert
    if (!row.id) delete row.id

    const { data, error } = await supabase
      .from('leads')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single()

    if (error) { console.error('[Supabase] ❌ saveLead erreur:', error.message); return { lead, merged: false } }
    const saved = fromRow(data)
    console.log('[Supabase] ✅ saveLead → id:', saved.id)
    dispatch('saveLead')
    return { lead: saved, merged: !!lead.id }
  },

  async updateLead(leadId, updates) {
    console.log('[Supabase] ✏️  updateLead —', leadId, Object.keys(updates))
    const row = toRow({ ...updates, id: leadId })
    delete row.id  // ne pas écraser l'id via la colonne
    const { data, error } = await supabase
      .from('leads')
      .update(row)
      .eq('id', leadId)
      .select()
      .single()
    if (error) { console.error('[Supabase] ❌ updateLead erreur:', error.message); return null }
    const updated = fromRow(data)
    console.log('[Supabase] ✅ updateLead → ok')
    dispatch('updateLead')
    return updated
  },

  async archiveLead(leadId) {
    console.log('[Supabase] 📦 archiveLead —', leadId)
    const { data: current } = await supabase.from('leads').select('status').eq('id', leadId).single()
    const { data, error } = await supabase
      .from('leads')
      .update({
        status:        'archivé',
        archived_from: current?.status ?? null,
        archived_at:   new Date().toISOString(),
      })
      .eq('id', leadId)
      .select()
      .single()
    if (error) { console.error('[Supabase] ❌ archiveLead erreur:', error.message); return null }
    console.log('[Supabase] ✅ archiveLead → ok')
    dispatch('archiveLead')
    return fromRow(data)
  },

  async deleteLead(leadId) {
    console.log('[Supabase] 🗑️  deleteLead —', leadId)
    const { error } = await supabase.from('leads').delete().eq('id', leadId)
    if (error) { console.error('[Supabase] ❌ deleteLead erreur:', error.message); return }
    console.log('[Supabase] ✅ deleteLead → ok')
    dispatch('deleteLead')
  },

  async clearAll() {
    console.warn('[Supabase] ⚠️  clearAll — suppression de tous les leads!')
    const { error } = await supabase.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) console.error('[Supabase] ❌ clearAll erreur:', error.message)
    else console.log('[Supabase] ✅ clearAll → ok')
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE LOCALSTORAGE (fallback)
// ─────────────────────────────────────────────────────────────────────────────

const ls = {

  async getLeads(filter = null) {
    const leads = lsRead() ?? []
    if (filter === 'today') return leads.filter(l => isToday(l.createdAt))
    return leads
  },

  async saveLeads(leads) { lsWrite(leads); return leads },

  async saveLead(lead) {
    const current = lsRead() ?? []
    let idx = lead.id ? current.findIndex(l => l.id === lead.id) : -1
    if (idx < 0 && lead.email?.trim()) idx = current.findIndex(l => l.email?.trim().toLowerCase() === lead.email.trim().toLowerCase())
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

  async updateLead(leadId, updates) {
    const current = lsRead() ?? []
    const idx = current.findIndex(l => l.id === leadId)
    if (idx < 0) return null
    current[idx] = { ...current[idx], ...updates }
    lsWrite(current)
    dispatch('updateLead')
    return current[idx]
  },

  async archiveLead(leadId) {
    const current = lsRead() ?? []
    const idx = current.findIndex(l => l.id === leadId)
    if (idx < 0) return null
    current[idx] = { ...current[idx], status: 'archivé', archivedFrom: current[idx].status, archivedAt: Date.now() }
    lsWrite(current)
    dispatch('archiveLead')
    return current[idx]
  },

  async deleteLead(leadId) {
    const current = lsRead() ?? []
    lsWrite(current.filter(l => l.id !== leadId))
    dispatch('deleteLead')
  },

  async clearAll() {
    localStorage.removeItem(LS_KEY)
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k))
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT : sélection automatique du backend
// ─────────────────────────────────────────────────────────────────────────────

export const api = SUPABASE_ENABLED ? sb : ls

console.info(
  SUPABASE_ENABLED
    ? '[RevSpeed API] 🟢 Backend : Supabase'
    : '[RevSpeed API] 🟡 Backend : localStorage (définir VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY pour activer Supabase)'
)
