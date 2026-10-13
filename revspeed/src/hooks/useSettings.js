/**
 * RevSpeed — useSettings
 * Gestion des paramètres du CRM persistés en localStorage.
 * Toutes les valeurs sont lues/écrites ici, puis consommées dans l'app.
 */

const LS_KEY = 'revspeed_settings'

export const DEFAULT_SETTINGS = {
  // Concessionnaire
  nomConcessionnaire: 'Honda Renneville',
  nomCommercial:      'Max',
  adresseConcessionnaire: '',

  // Vendeurs
  vendeurs: [
    'Marc Venturi',
    'Sophie Martin',
    'Thomas Lebrun',
    'Camille Petit',
    'Isabelle Roux',
  ],

  // Templates messages
  templateSMS: [
    "Bonjour {prenom},\n\nC'est {commercial} de {concessionnaire}.\n\nJ'ai essayé de vous joindre à l'instant sans succès.\n\nJe fais suite à votre demande pour votre projet Moto.\n\nQuand seriez-vous joignable ? Bonne journée !",
  ],
  templateEmail: [
    {
      sujet: 'Votre projet Moto – {concessionnaire}',
      corps: "Bonjour {prenom},\n\nJe fais suite à votre demande concernant votre projet moto.\n\nJe reste disponible pour répondre à toutes vos questions.\n\nCordialement,\n{commercial}\n{concessionnaire}",
    },
  ],

  // Alertes
  joursRelance: 3,
  joursLeadFroid: 7,

  // Sécurité
  motDePasse: '',
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings))
  } catch {}
}

/** Remplace les variables dans un template : {prenom}, {commercial}, {concessionnaire} */
export function applyTemplate(template, vars = {}) {
  return template
    .replace(/\{prenom\}/g,          vars.prenom          ?? '')
    .replace(/\{commercial\}/g,      vars.commercial      ?? '')
    .replace(/\{concessionnaire\}/g, vars.concessionnaire ?? '')
}
