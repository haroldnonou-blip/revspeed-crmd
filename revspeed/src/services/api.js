/**
 * RevSpeed — Service API centralisé
 * ──────────────────────────────────────────────────────────────────────────
 * Mode automatique :
 *   → SUPABASE    si VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY sont définis
 *   → localStorage sinon (dev / démo sans backend)
 *
 * Table Supabase : "Leads" (colonnes réelles Facebook Lead Ads + CRM)
 * ──────────────────────────────────────────────────────────────────────────
 */

import { supabase, SUPABASE_ENABLED } from './supabase'

// ── localStorage (fallback) ──────────────────────────────────────────────────
const LS_KEY      = '***'
const LEGACY_KEYS = ['revspeed_leads', 'revspeed_leads_v1']

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING  App ↔ Supabase "Leads"
// Les colonnes Facebook ont des préfixes : p: (phone) et z: (postcode)
// ─────────────────────────────────────────────────────────────────────────────

/** Supabase row → objet lead utilisé par l'app */
function fromRow(row) {
  const phone    = (row.phone_number ?? '').replace(/^p:/, '')
  const postCode = (row.post_code    ?? '').replace(/^z:/, '')
  const gamme    = row['quelle_gamme_triumph_vous_intéresse_?'] ?? ''

  return {
    id:            row.id            ?? '',
    nom:           row.full_name     ?? '',
    tel:           phone,
    email:         row.email         ?? '',
    codePostal:    postCode,
    status:        row.status        ?? 'prospect',
    priorité:      row.priorite      ?? 'moyenne',
    vendeur:       row.vendeur       ?? '',
    qualification: row.qualification ?? gamme,
    notes:         row.notes         ?? '',
    issueAppel:    row.issue_appel   ?? '',
    rdvDate:       row.rdv_date      ?? '',
    rdvTime:       row.rdv_time      ?? '',
    rdvType:       row.rdv_type      ?? '',
    rdvDuration:   row.rdv_duration  != null ? String(row.rdv_duration) : '',
    archivedFrom:  row.archived_from ?? null,
    archivedAt:    row.archived_at   ? new Date(row.archived_at).getTime()  : null,
    createdAt:     row.created_time  ? new Date(row.created_time).getTime()
                 : row.created_at   ? new Date(row.created_at).getTime()   : null,
    updatedAt:     row.updated_at    ? new Date(row.updated_at).getTime()   : null,
    leadStatus:    row.lead_status   ?? null,
    adName:        row.ad_name       ?? null,
    campaignName:  row.campaign_name ?? null,
    gamme,
  }
}

/** Objet lead → Supabase row (uniquement les colonnes CRM modifiables) */
function toRow(lead) {
  const row = {
    id:            lead.id || crypto.randomUUID(),
    full_name:     lead.nom          ?? null,
    phone_number:  lead.tel          ?? null,
    email:         lead.email        ?? null,
    post_code:     lead.codePostal   ?? null,
    lead_status:   lead.leadStatus   ?? 'CREATED',
    status:        lead.status       ?? 'prospect',
    priorite:      lead.priorité     ?? 'moyenne',
    vendeur:       lead.vendeur      ?? null,
    qualification: lead.qualification ?? null,
    notes:         lead.notes        ?? null,
    issue_appel:   lead.issueAppel   ?? null,
    rdv_date:      lead.rdvDate      || null,
    rdv_time:      lead.rdvTime      || null,
    rdv_type:      lead.rdvType      || null,
    rdv_duration:  lead.rdvDuration  ? parseInt(lead.rdvDuration) : null,
    archived_from: lead.archivedFrom ?? null,
    archived_at:   lead.archivedAt   ? new Date(lead.archivedAt).toISOString() : null,
  }
  return row
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

// ── localStorage helpers ─────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND SUPABASE
// ─────────────────────────────────────────────────────────────────────────────
const sb = {

  async getLeads(filter = null) {
    console.log('[Supabase] 📥 getLeads…')
    let q = supabase.from('Leads').select('*').order('created_time', { ascending: false })
    if (filter === 'today') {
      const today = new Date().toISOString().split('T')[0]
      q = q.gte('created_time', today + 'T00:00:00').lte('created_time', today + 'T23:59:59')
    }
    const { data, error } = await q
    if (error) { console.error('[Supabase] ❌ getLeads:', error.message); return [] }
    const leads = (data ?? []).map(fromRow)
    console.log(`[Supabase] ✅ getLeads → ${leads.length} leads`)
    return leads
  },

  async saveLeads(leads) {
    // bulk upsert utilisé uniquement par useLeads auto-persist
    // → on évite le dispatch pour ne pas créer de boucle
    const rows = leads.map(toRow)
    const { error } = await supabase.from('Leads').upsert(rows, { onConflict: 'id' })
    if (error) console.error('[Supabase] ❌ saveLeads:', error.message)
    return leads
  },

  async saveLead(lead) {
    console.log('[Supabase] 📤 saveLead —', lead.nom || lead.id)
    const row = toRow(lead)
    const { data, error } = await supabase
      .from('Leads').upsert(row, { onConflict: 'id' }).select().single()
    if (error) { console.error('[Supabase] ❌ saveLead:', error.message); return { lead, merged: false } }
    const saved = fromRow(data)
    console.log('[Supabase] ✅ saveLead → id:', saved.id)
    dispatch('saveLead')
    return { lead: saved, merged: !!lead.id }
  },

  async updateLead(leadId, updates) {
    console.log('[Supabase] ✏️ updateLead —', leadId)
    const partial = toRow({ ...updates, id: leadId })
    delete partial.id
    const { data, error } = await supabase
      .from('Leads').update(partial).eq('id', leadId).select().single()
    if (error) { console.error('[Supabase] ❌ updateLead:', error.message); return null }
    const updated = fromRow(data)
    console.log('[Supabase] ✅ updateLead → ok')
    dispatch('updateLead')
    return updated
  },

  async archiveLead(leadId) {
    console.log('[Supabase] 📦 archiveLead —', leadId)
    const { data: cur } = await supabase.from('Leads').select('status').eq('id', leadId).single()
    const { data, error } = await supabase.from('Leads')
      .update({ status: 'archivé', archived_from: cur?.status ?? null, archived_at: new Date().toISOString() })
      .eq('id', leadId).select().single()
    if (error) { console.error('[Supabase] ❌ archiveLead:', error.message); return null }
    console.log('[Supabase] ✅ archiveLead → ok')
    dispatch('archiveLead')
    return fromRow(data)
  },

  async deleteLead(leadId) {
    console.log('[Supabase] 🗑️ deleteLead —', leadId)
    const { error } = await supabase.from('Leads').delete().eq('id', leadId)
    if (error) { console.error('[Supabase] ❌ deleteLead:', error.message); return }
    console.log('[Supabase] ✅ deleteLead → ok')
    dispatch('deleteLead')
  },

  async clearAll() {
    console.warn('[Supabase] ⚠️ clearAll!')
    await supabase.from('Leads').delete().neq('id', 'none')
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND LOCALSTORAGE (fallback sans Supabase)
// ─────────────────────────────────────────────────────────────────────────────
const ls = {
  async getLeads(filter = null) {
    const leads = lsRead() ?? []
    return filter === 'today' ? leads.filter(l => isToday(l.createdAt)) : leads
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
    lsWrite((lsRead() ?? []).filter(l => l.id !== leadId))
    dispatch('deleteLead')
  },
  async clearAll() {
    localStorage.removeItem(LS_KEY)
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k))
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT — sélection automatique du backend
// ─────────────────────────────────────────────────────────────────────────────
export const api = SUPABASE_ENABLED ? sb : ls

console.info(
  SUPABASE_ENABLED
    ? '[RevSpeed] 🟢 Supabase activé'
    : '[RevSpeed] 🟡 Mode localStorage (ajouter VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY pour activer Supabase)'
)
