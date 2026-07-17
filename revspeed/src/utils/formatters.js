/**
 * RevSpeed — Utilitaires de formatage
 */

/**
 * Retourne un temps relatif lisible en français.
 * Ex: "il y a 3min", "il y a 2h", "hier", "12 juil."
 *
 * @param {number} timestamp - Unix ms
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  const diff    = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  const hours   = Math.floor(diff / 3_600_000)
  const days    = Math.floor(diff / 86_400_000)

  if (minutes < 1)  return 'à l\'instant'
  if (minutes < 60) return `il y a ${minutes}min`
  if (hours   < 24) return `il y a ${hours}h`
  if (days    === 1) return 'hier'
  return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/**
 * Formate un timestamp en date courte lisible.
 * Ex: "17 juil. 2026, 00:32"
 */
export function formatDateTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}


/**
 * Formate un numéro de téléphone français en XX XX XX XX XX.
 * Tolère les espaces, tirets, points existants.
 *
 * @param {string} tel - Numéro brut
 * @returns {string}   - Numéro formaté, ou la valeur originale si non reconnu
 */
export function formatPhone(tel) {
  if (!tel) return '—'
  const digits = String(tel).replace(/\D/g, '')
  if (digits.length === 10) {
    return digits.match(/.{2}/g).join(' ')
  }
  // Numéro international ou format inconnu → retour brut
  return tel
}

/**
 * Retourne les initiales d'un nom complet (max 2 lettres).
 *
 * @param {string} nom
 * @returns {string}  - Ex: "Sophie Marchand" → "SM"
 */
export function getInitials(nom) {
  if (!nom) return '?'
  return nom
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}
