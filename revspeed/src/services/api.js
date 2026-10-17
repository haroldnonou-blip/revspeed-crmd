/**
 * RevSpeed — Service API
 * ──────────────────────────────────────────────────────────────────────────
 * Sources de données (par ordre de priorité) :
 *   1. Google Apps Script (GAS) → leads Facebook depuis le Google Sheet client
 *   2. Supabase                 → fallback legacy
 *   3. localStorage             → mode offline / fallback final
 *
 * L'état CRM (status, vendeur, notes, RDV) est toujours persisté :
 *   - En local via localStorage (immédiat, offline-first)
 *   - En remote via GAS/Supabase (sync asynchrone)
 * ──────────────────────────────────────────────────────────────────────────
 */

import { supabase, SUPABASE_ENABLED } from './supabase'

// ── Configuration ────────────────────────────────────────────────────────────
const GAS_ENDPOINT  = import.meta.env.VITE_GAS_ENDPOINT  ?? ''
const GAS_TOKEN     = import.meta.env.VITE_GAS_TOKEN     ?? ''
const GAS_ENABLED   = !!GAS_ENDPOINT

// ── Clés localStorage ────────────────────────────────────────────────────────
const LS_KEY      = 'revspeed_v2'
const LEGACY_KEYS = ['***', 'revspeed_leads', 'revspeed_leads_v1']

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING  Supabase → App (legacy)
// ─────────────────────────────────────────────────────────────────────────────

function fromSupabaseRow(row) {
  if (!row || typeof row !== 'object') return null
  const tel   = String(row.phone_number ?? '').replace(/^p:/, '').trim()
  const cp    = String(row.post_code    ?? '').replace(/^z:/, '').trim()
  const gamme = String(
    row['quelle_gamme_triumph_vous_intéresse_?'] ?? row.gamme ?? ''
  ).trim()
  let createdAt = Date.now()
  try {
    if (row.created_time) createdAt = new Date(row.created_time).getTime()
    else if (row.created_at) createdAt = new Date(row.created_at).getTime()
  } catch (_) {}
  return {
    id:            String(row.id ?? crypto.randomUUID()),
    nom:           String(row.full_name ?? '').trim(),
    tel,
    email:         String(row.email ?? '').trim(),
    codePostal:    cp,
    createdAt,
    leadStatus:    row.lead_status   ?? null,
    adName:        row.ad_name       ?? null,
    campaignName:  row.campaign_name ?? null,
    gamme,
    status:        'prospect',
    priorité:      'moyenne',
    vendeur:       '',
    qualification: gamme,
    notes:         '',
    issueAppel:    '',
    rdvDate:       '',
    rdvTime:       '',
    rdvType:       '',
    rdvDuration:   '',
    archivedFrom:  null,
    archivedAt:    null,
    updatedAt:     null,
    prochainRdv:   '',
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
  // Migrer depuis les anciennes clés si nécessaire
  let raw = localStorage.getItem(LS_KEY)
  if (!raw) {
    for (const k of LEGACY_KEYS) {
      raw = localStorage.getItem(k)
      if (raw) {
        localStorage.setItem(LS_KEY, raw)
        LEGACY_KEYS.forEach(lk => localStorage.removeItem(lk))
        break
      }
    }
  }
  try { return raw ? JSON.parse(raw) : null } catch { return null }
}

function lsWrite(leads) { localStorage.setItem(LS_KEY, JSON.stringify(leads)) }

const CRM_FIELDS = ['status','priorité','vendeur','qualification','notes',
  'issueAppel','rdvDate','rdvTime','rdvType','rdvDuration',
  'archivedFrom','archivedAt','updatedAt','prochainRdv']

function mergeWithCrm(remoteLead, existing) {
  if (!existing) return remoteLead
  // SÉCURITÉ : l'état CRM local non vide est TOUJOURS prioritaire.
  // Un navigateur ne perd jamais son travail (notes, statut, vendeur) au
  // chargement : s'il a déjà une valeur, on la garde ; sinon on prend celle
  // du Sheet (GAS). Un nouveau navigateur (local vide) récupère donc tout GAS.
  const crm = {}
  for (const f of CRM_FIELDS) {
    if (existing[f] !== undefined && existing[f] !== '' && existing[f] !== null) {
      crm[f] = existing[f]
    }
  }
  return { ...remoteLead, ...crm }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE : Google Apps Script
// ─────────────────────────────────────────────────────────────────────────────

async function fetchFromGAS() {
  const url = GAS_TOKEN
    ? `${GAS_ENDPOINT}?token=${encodeURIComponent(GAS_TOKEN)}`
    : GAS_ENDPOINT

  const res  = await fetch(url)
  if (!res.ok) throw new Error(`GAS HTTP ${res.status}`)
  const json = await res.json()
  if (!json.ok) throw new Error(`GAS error: ${json.error}`)
  return json.data  // tableau de leads normalisés
}

async function pushToGAS(action, payload) {
  if (!GAS_ENABLED) return
  // IMPORTANT : Content-Type text/plain → requête "simple" sans preflight CORS.
  // Apps Script ne répond pas aux requêtes OPTIONS ; avec application/json le
  // navigateur déclenche un preflight qui échoue et bloque tout POST.
  // Le corps reste du JSON, parsé côté GAS via e.postData.contents.
  try {
    const res = await fetch(GAS_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify({ token: GAS_TOKEN, action, ...payload }),
    })
    if (import.meta.env.DEV) {
      const txt = await res.text()
      console.log('[GAS] push', action, '→', res.status, txt.slice(0, 120))
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[GAS] push failed:', e.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────

export const api = {

  // ── getLeads ───────────────────────────────────────────────────────────────
  async getLeads(filter = null) {
    const existing    = lsRead() ?? []
    const existingMap = Object.fromEntries(existing.map(l => [l.id, l]))

    // ── Source 1 : Google Apps Script ────────────────────────────────────────
    if (GAS_ENABLED) {
      try {
        const gasLeads = await fetchFromGAS()

        // GARDE-FOU : si GAS renvoie vide mais qu'on a des données locales,
        // on NE PART PAS de zéro (sinon on efface le travail de l'utilisateur
        // à chaque chargement tant que le Sheet n'est pas encore alimenté).
        if ((!gasLeads || gasLeads.length === 0) && existing.length > 0) {
          if (import.meta.env.DEV) console.warn('[GAS] vide → on garde localStorage (pas d\'écrasement)')
          return filter === 'today' ? existing.filter(l => isToday(l.createdAt)) : existing
        }

        // ── SOURCE UNIQUE DE VÉRITÉ : le Google Sheet ──────────────────────────
        // On adopte l'état CRM du Sheet TEL QUEL (statut, vendeur, notes, RDV).
        // Un navigateur ne peut plus écraser le Sheet avec de vieilles données
        // locales : plus de fusion, plus de conflit, plus de perte.
        // On ajoute uniquement les leads créés localement et pas encore dans le
        // Sheet (ils seront poussés par la prochaine sauvegarde).
        const gasIds   = new Set((gasLeads ?? []).map(l => l.id))
        const localOnly = existing.filter(l => !gasIds.has(l.id))
        const merged    = [...(gasLeads ?? []), ...localOnly]
        lsWrite(merged)
        return filter === 'today' ? merged.filter(l => isToday(l.createdAt)) : merged
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[GAS] fallback localStorage:', e.message)
      }
    }

    // ── Source 2 : Supabase (legacy) ──────────────────────────────────────────
    if (SUPABASE_ENABLED) {
      const { data, error } = await supabase
        .from('Leads')
        .select('*')
        .order('created_time', { ascending: false })

      if (!error) {
        let newCount = 0
        const merged = (data ?? [])
          .map(row => fromSupabaseRow(row))
          .filter(Boolean)
          .map(base => {
            const crmState = existingMap[base.id]
            if (!crmState) newCount++
            return mergeWithCrm(base, crmState ?? null)
          })
        if (import.meta.env.DEV && newCount > 0)
          console.log(`[Supabase] ${newCount} nouveau(x) lead(s)`)
        lsWrite(merged)
        return filter === 'today' ? merged.filter(l => isToday(l.createdAt)) : merged
      }
      if (import.meta.env.DEV) console.warn('[Supabase] fallback localStorage')
    }

    // ── Source 3 : localStorage pur ───────────────────────────────────────────
    return filter === 'today' ? existing.filter(l => isToday(l.createdAt)) : existing
  },

  // ── saveLeads — auto-persist React → localStorage (+ sync GAS async) ───────
  async saveLeads(leads) {
    lsWrite(leads)
    // Sync vers GAS en arrière-plan (sans bloquer l'UI)
    pushToGAS('saveAll', { leads })
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
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...lead, id: current[idx].id, createdAt: current[idx].createdAt, updatedAt: Date.now() }
    } else {
      current.push({ id: lead.id ?? crypto.randomUUID(), createdAt: lead.createdAt ?? Date.now(), ...lead })
    }
    lsWrite(current)
    const saved = idx >= 0 ? current[idx] : current[current.length - 1]
    pushToGAS('updateLead', { lead: saved })
    dispatch('saveLead')
    return { lead: saved, merged: idx >= 0 }
  },

  // ── updateLead ─────────────────────────────────────────────────────────────
  async updateLead(leadId, updates) {
    const current = lsRead() ?? []
    const idx = current.findIndex(l => l.id === leadId)
    if (idx < 0) return null
    current[idx] = { ...current[idx], ...updates, updatedAt: Date.now() }
    lsWrite(current)
    pushToGAS('updateLead', { lead: current[idx] })
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
    pushToGAS('updateLead', { lead: current[idx] })
    dispatch('archiveLead')
    return current[idx]
  },

  // ── deleteLead ─────────────────────────────────────────────────────────────
  async deleteLead(leadId) {
    lsWrite((lsRead() ?? []).filter(l => l.id !== leadId))
    dispatch('deleteLead')
  },

  // ── clearAll ───────────────────────────────────────────────────────────────
  async clearAll() {
    localStorage.removeItem(LS_KEY)
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k))
  },

  // ── summarize — nettoie/structure un texte dicté via l'IA (GAS proxy) ───────
  async summarize(text) {
    if (!GAS_ENABLED) throw new Error('IA non configurée')
    const res = await fetch(GAS_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify({ token: GAS_TOKEN, action: 'summarize', text }),
    })
    const json = await res.json().catch(() => null)
    if (!json || !json.ok) throw new Error(json?.error || 'réponse invalide')
    return (json.summary || '').trim()
  },
}

if (import.meta.env.DEV) {
  console.info(
    GAS_ENABLED      ? '[RevSpeed] Source : Google Apps Script' :
    SUPABASE_ENABLED ? '[RevSpeed] Source : Supabase' :
                       '[RevSpeed] Source : localStorage'
  )
}
