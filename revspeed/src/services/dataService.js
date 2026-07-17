/**
 * RevSpeed — Data Service
 * Couche d'accès aux données. Actuellement : JSON local via fetch().
 * Objectif : remplaçable par une API REST sans modifier les composants.
 *
 * Champs normalisés : id, nom, tel, codePostal, email, status, priorité
 */

const DATA_URL = '/data/leads.json'

/**
 * Normalise un enregistrement brut vers le schéma standardisé.
 * Permet d'absorber des variations de nommage (CSV, API externe, etc.)
 *
 * @param {Object} raw - Enregistrement brut
 * @returns {Object} Lead normalisé
 */
function normalizeLead(raw) {
  return {
    id:         raw.id         ?? raw.ID         ?? crypto.randomUUID(),
    nom:        raw.nom        ?? raw.name        ?? raw.fullName ?? '',
    tel:        raw.tel        ?? raw.phone       ?? raw.telephone ?? '',
    codePostal: raw.codePostal ?? raw.cp          ?? raw.postalCode ?? '',
    email:      raw.email      ?? raw.mail        ?? '',
    status:     raw.status     ?? raw.statut      ?? 'prospect',
    priorité:   raw.priorité   ?? raw.priorite    ?? raw.priority ?? 'moyenne',
    createdAt:  raw.createdAt  ?? Date.now(),     // horodatage itération 6
  }
}

/**
 * Valide qu'un lead normalisé est utilisable.
 * Retourne false pour filtrer les lignes invalides/vides.
 *
 * @param {Object} lead - Lead normalisé
 * @returns {boolean}
 */
function isValidLead(lead) {
  return Boolean(lead.id && lead.nom)
}

/**
 * Charge les leads depuis la source de données configurée.
 * Supporte : JSON (fetch)
 * Prévu : CSV (Papa Parse), API REST
 *
 * @param {Object}  [filters={}]            Filtres d'import optionnels
 * @param {string}  [filters.status]        Filtre par statut exact (ex : 'prospect')
 * @param {string}  [filters.startDate]     ISO date YYYY-MM-DD (borne basse sur createdAt)
 * @param {string}  [filters.endDate]       ISO date YYYY-MM-DD (borne haute sur createdAt)
 *
 * @returns {Promise<Object[]>} Tableau de leads normalisés et filtrés
 * @throws {Error} Si le fetch échoue ou si le JSON est malformé
 */
export async function fetchLeads({ status = null, startDate = null, endDate = null } = {}) {
  try {
    const response = await fetch(DATA_URL)

    if (!response.ok) {
      throw new Error(`Erreur réseau : ${response.status} ${response.statusText}`)
    }

    const raw = await response.json()

    if (!Array.isArray(raw)) {
      throw new Error('Format de données invalide : un tableau JSON est attendu')
    }

    let leads = raw.map(normalizeLead).filter(isValidLead)

    // ── Filtre par statut ──────────────────────────────────────
    if (status) {
      leads = leads.filter(l => l.status === status)
    }

    // ── Filtre par date (sur createdAt si disponible) ───────────────
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).setHours(0,  0,  0,   0) : null
      const end   = endDate   ? new Date(endDate  ).setHours(23, 59, 59, 999) : null
      leads = leads.filter(l => {
        if (!l.createdAt) return true          // pas de date → inclus par défaut
        if (start && l.createdAt < start) return false
        if (end   && l.createdAt > end)   return false
        return true
      })
    }

    const activeFilters = [status && `statut=${status}`, startDate && `depuis=${startDate}`, endDate && `jusqu'au=${endDate}`]
      .filter(Boolean).join(', ')

    console.info(
      `[DataService] ${leads.length} leads chargés depuis ${DATA_URL}` +
      (activeFilters ? ` [${activeFilters}]` : '')
    )
    return leads

  } catch (error) {
    console.error('[DataService] Échec du chargement des leads :', error.message)
    throw error
  }
}

/**
 * Charge les leads et les groupe par statut.
 * Utile pour alimenter directement un Kanban.
 *
 * @returns {Promise<Object>} { [status]: Lead[] }
 */
export async function fetchLeadsByStatus() {
  const leads = await fetchLeads()

  return leads.reduce((acc, lead) => {
    const key = lead.status
    if (!acc[key]) acc[key] = []
    acc[key].push(lead)
    return acc
  }, {})
}
