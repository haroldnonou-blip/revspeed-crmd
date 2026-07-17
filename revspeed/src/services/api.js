/**
 * RevSpeed — Service API centralisé
 * ──────────────────────────────────────────────────────────────────────────
 * Toutes les opérations de données passent par ce fichier.
 * Actuellement : localStorage (dev/demo).
 * Migration Google Apps Script : remplacer les implémentations ci-dessous
 * par des appels fetch() vers ton URL GAS — les composants ne changent pas.
 *
 * ── API publique ──────────────────────────────────────────────────────────
 *   getLeads()              → Promise<Lead[]|null>
 *   saveLeads(leads)        → Promise<Lead[]>          bulk replace
 *   saveLead(lead)          → Promise<Lead>            upsert (id > email > tél)
 *   updateLead(id, updates) → Promise<Lead|null>       patch partiel
 *   deleteLead(id)          → Promise<void>            suppression définitive
 *   archiveLead(id)         → Promise<Lead|null>       archivage pipeline
 *   clearAll()              → Promise<void>
 *
 * ── Schéma Lead (champs supportés) ────────────────────────────────────────
 *   Identité       : id, createdAt, updatedAt
 *   Contact        : nom, tel, email, codePostal
 *   Pipeline       : status, priorité, vendeur
 *   Qualification  : qualification, notes, issueAppel
 *   Rendez-vous    : rdvDate (YYYY-MM-DD), rdvTime (HH:MM),
 *                    rdvType ('Physique'|'Téléphonique'),
 *                    rdvDuration (number, minutes : 15|30|45|60|90)
 *                    [prochainRdv conservé pour rétrocompatibilité]
 *   Archivage      : archivedFrom, archivedAt
 *
 * ── Roadmap migration GAS ─────────────────────────────────────────────────
 *
 *   1. Définis VITE_GAS_URL=https://script.google.com/.../exec dans .env
 *   2. Remplace les fonctions localStorage par :
 *
 *     async function gasRequest(action, payload = {}) {
 *       const res = await fetch(GAS_URL, {
 *         method:  'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body:    JSON.stringify({ action, ...payload }),
 *       })
 *       return res.json()
 *     }
 *
 *     getLeads    → gasRequest('getLeads')
 *     saveLeads   → gasRequest('saveLeads',   { leads })
 *     saveLead    → gasRequest('saveLead',    { lead  })
 *     updateLead  → gasRequest('updateLead',  { leadId, updates })
 *     deleteLead  → gasRequest('deleteLead',  { leadId })
 *     archiveLead → gasRequest('archiveLead', { leadId })
 *
 *   Ref: https://developers.google.com/apps-script/guides/web
 * ──────────────────────────────────────────────────────────────────────────
 */

// Clé localStorage — suffixée _v2 pour migrer proprement l'ancienne clé _v1
const KEY         = 'revspeed_leads_v2'
const LEGACY_KEYS = [
  'revspeed_leads',      // clé simple (snippet externe / dev rapide)
  'revspeed_leads_v1',   // v1
]

// ── Helpers internes ────────────────────────────────────────────────────────

/**
 * Vérifie si un timestamp ou une date ISO correspond à aujourd'hui.
 * Compare année/mois/jour en heure locale — insensible au fuseau horaire.
 *
 * @param {number|string|null} dateInput  — timestamp ms ou ISO string
 * @returns {boolean}
 */
export function isToday(dateInput) {
  if (!dateInput) return false
  const d     = new Date(dateInput)
  const today = new Date()
  return (
    d.getDate()     === today.getDate()     &&
    d.getMonth()    === today.getMonth()    &&
    d.getFullYear() === today.getFullYear()
  )
}

function readStorage() {
  // Lecture avec migration automatique des anciennes clés
  let raw = localStorage.getItem(KEY)

  if (!raw) {
    for (const legacy of LEGACY_KEYS) {
      raw = localStorage.getItem(legacy)
      if (raw) {
        localStorage.setItem(KEY, raw)            // migre vers la nouvelle clé
        LEGACY_KEYS.forEach(k => localStorage.removeItem(k))
        break
      }
    }
  }

  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function writeStorage(leads) {
  localStorage.setItem(KEY, JSON.stringify(leads))
}

/**
 * Émet un CustomEvent 'leadsUpdated' sur window.
 *
 * Règle d'émission :
 *   ✔ saveLead, updateLead, deleteLead, archiveLead   → dispatch
 *   ✘ saveLeads (bulk auto-persist de useLeads)       → PAS de dispatch
 *                                                      (prévient la boucle infinie)
 *
 * Le payload contient l'action pour que les listeners puissent filtrer.
 * @param {'saveLead'|'updateLead'|'deleteLead'|'archiveLead'} action
 */
function dispatchLeadsUpdated(action) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('leadsUpdated', { detail: { action, timestamp: Date.now() } })
  )
}

// ── API publique ─────────────────────────────────────────────────────────────

export const api = {

  /**
   * Retourne les leads depuis le localStorage.
   *
   * @param {'today'|null} [filter=null]  Filtre prédéfini optionnel :
   *   - null     → tous les leads
   *   - 'today'  → leads créés aujourd'hui (sur createdAt)
   * @returns {Promise<Object[]>}
   */
  async getLeads(filter = null) {
    const leads = readStorage() ?? []

    if (filter === 'today') {
      const today = new Date()
      console.group('[api.getLeads] Filtre \'today\' — diagnostic')
      console.log('Date du jour :', today.toLocaleDateString('fr-FR'), `(${today.toISOString()})`)
      console.table(
        leads.map(l => {
          const raw  = l.createdAt ?? null
          const date = raw ? new Date(raw) : null
          return {
            id:        l.id,
            nom:       l.nom,
            createdAt: raw ?? '⚠️ absent',
            type:      raw ? typeof raw : '—',
            dateLocale: date ? date.toLocaleDateString('fr-FR') : '—',
            isToday:   isToday(raw),
          }
        })
      )
      const result = leads.filter(l => isToday(l.createdAt))
      console.log(`→ ${result.length} lead(s) correspondent à aujourd'hui sur ${leads.length} total`)
      console.groupEnd()
      return result
    }

    return leads
  },

  /**
   * Remplace l'intégralité des leads (bulk save).
   * @param {Object[]} leads
   * @returns {Promise<Object[]>}
   */
  async saveLeads(leads) {
    writeStorage(leads)
    return leads
  },

  /**
   * Crée ou met à jour un lead unique (upsert).
   *
   * Ordre de priorité pour la détection de doublon :
   *   1. id      — correspondance exacte (clé primaire)
   *   2. email   — si non-vide, comparaison insensible à la casse
   *   3. tél     — si non-vide, comparaison des chiffres uniquement (≥ 8 chiffres)
   *
   * Lorsque le lead est reconnu comme existant :
   *   - ses données sont fusionnées (nouvelles valeurs écrasent les anciennes)
   *   - son `id` et `createdAt` d'origine sont préservés
   *   - un champ `updatedAt` est ajouté
   *
   * @param {Object} lead
   * @returns {Promise<{ lead: Object, merged: boolean }>}
   */
  async saveLead(lead) {
    const current = readStorage() ?? []
    let idx = -1

    // 1 — Upsert par id (clé primaire)
    if (lead.id) {
      idx = current.findIndex(l => l.id === lead.id)
    }

    // 2 — Fallback : dédup par email
    if (idx < 0 && lead.email?.trim()) {
      const emailNorm = lead.email.trim().toLowerCase()
      idx = current.findIndex(
        l => l.email?.trim().toLowerCase() === emailNorm
      )
    }

    // 3 — Fallback : dédup par téléphone (chiffres uniquement, min 8 chiffres)
    if (idx < 0 && lead.tel?.trim()) {
      const telNorm = lead.tel.replace(/\D/g, '')
      if (telNorm.length >= 8) {
        idx = current.findIndex(
          l => l.tel?.replace(/\D/g, '') === telNorm
        )
      }
    }

    let merged = false
    if (idx >= 0) {
      // Mise à jour — préserve id & createdAt d'origine
      current[idx] = {
        ...current[idx],
        ...lead,
        id:        current[idx].id,
        createdAt: current[idx].createdAt,
        updatedAt: Date.now(),
      }
      merged = true
    } else {
      current.push({
        id:        lead.id ?? crypto.randomUUID(),
        createdAt: lead.createdAt ?? Date.now(),
        ...lead,
      })
    }

    writeStorage(current)
    const saved = idx >= 0 ? current[idx] : current[current.length - 1]
    dispatchLeadsUpdated('saveLead')
    return { lead: saved, merged }
  },

  /**
   * Archive un lead : status → 'archivé', conserve l'étape d'origine.
   * @param {string} leadId
   * @returns {Promise<Object|null>}
   */
  async archiveLead(leadId) {
    const current = readStorage() ?? []
    const idx = current.findIndex(l => l.id === leadId)
    if (idx < 0) return null
    current[idx] = {
      ...current[idx],
      status:       'archivé',
      archivedFrom: current[idx].status !== 'archivé' ? current[idx].status : current[idx].archivedFrom,
      archivedAt:   Date.now(),
    }
    writeStorage(current)
    dispatchLeadsUpdated('archiveLead')
    return current[idx]
  },

  /**
   * Met à jour partiellement un lead (patch).
   * @param {string}  leadId
   * @param {Object}  updates
   * @returns {Promise<Object|null>}
   */
  async updateLead(leadId, updates) {
    const current = readStorage() ?? []
    const idx     = current.findIndex(l => l.id === leadId)
    if (idx < 0) return null
    current[idx]  = { ...current[idx], ...updates }
    writeStorage(current)
    dispatchLeadsUpdated('updateLead')
    return current[idx]
  },

  /**
   * Supprime définitivement un lead.
   * @param {string} leadId
   * @returns {Promise<void>}
   */
  async deleteLead(leadId) {
    const current  = readStorage() ?? []
    const filtered = current.filter(l => l.id !== leadId)
    writeStorage(filtered)
    dispatchLeadsUpdated('deleteLead')
  },

  /**
   * Efface toutes les données.
   * @returns {Promise<void>}
   */
  async clearAll() {
    localStorage.removeItem(KEY)
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k))
  },

}
