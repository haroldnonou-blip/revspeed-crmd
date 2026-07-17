/**
 * RevSpeed — Statuts du pipeline commercial
 * Source unique de vérité : clés, labels, icônes, couleurs, ordre.
 *
 * Palette hex validée Harold + ajouts itération 6 :
 *   Nouveau lead    #3b82f6  blue
 *   En cours        #f59e0b  amber
 *   Message + mail  #7d2ae8  violet
 *   En attente      #84cc16  lime
 *   RDV OK          #15803d  emerald dark
 *   Vente Conclue   #059669  emerald 600  ← NEW
 *   Perdu           #64748b  slate
 *   Archivé         —        hors pipeline
 */

export const STATUSES = {
  PROSPECT:      'prospect',
  CONTACT:       'contact',
  DEVIS:         'devis',
  NEGOCIATION:   'négociation',
  GAGNE:         'gagné',
  VENTE_CONCLUE: 'vente conclue',  // ← itération 6
  PERDU:         'perdu',
  ARCHIVE:       'archivé',        // ← hors pipeline, vue Archives
}

export const STATUS_LABELS = {
  [STATUSES.PROSPECT]:      'Nouveau lead',
  [STATUSES.CONTACT]:       'En cours',
  [STATUSES.DEVIS]:         'Message + mail',
  [STATUSES.NEGOCIATION]:   'En attente',
  [STATUSES.GAGNE]:         'RDV OK',
  [STATUSES.VENTE_CONCLUE]: 'Vente Conclue',
  [STATUSES.PERDU]:         'Perdu',
  [STATUSES.ARCHIVE]:       'Archivé',
}

export const STATUS_ICONS = {
  [STATUSES.PROSPECT]:      '🆕',
  [STATUSES.CONTACT]:       '⚡',
  [STATUSES.DEVIS]:         '💬',
  [STATUSES.NEGOCIATION]:   '⏳',
  [STATUSES.GAGNE]:         '📅',
  [STATUSES.VENTE_CONCLUE]: '🏆',
  [STATUSES.PERDU]:         '❌',
  [STATUSES.ARCHIVE]:       '📦',
}

export const PRIORITIES = {
  HAUTE:   'haute',
  MOYENNE: 'moyenne',
  BASSE:   'basse',
}

export const PRIORITY_COLORS = {
  [PRIORITIES.HAUTE]:   'bg-red-100 text-red-700 border border-red-200',
  [PRIORITIES.MOYENNE]: 'bg-amber-100 text-amber-700 border border-amber-200',
  [PRIORITIES.BASSE]:   'bg-slate-100 text-slate-500 border border-slate-200',
}

export const COLUMN_STYLES = {
  [STATUSES.PROSPECT]: {
    color: '#3b82f6', bgLight: '#eff6ff',
    textClass: 'text-blue-700', badgeClass: 'bg-blue-100 text-blue-700',
  },
  [STATUSES.CONTACT]: {
    color: '#f59e0b', bgLight: '#fffbeb',
    textClass: 'text-amber-700', badgeClass: 'bg-amber-100 text-amber-700',
  },
  [STATUSES.DEVIS]: {
    color: '#7d2ae8', bgLight: '#f5f3ff',
    textClass: 'text-violet-700', badgeClass: 'bg-violet-100 text-violet-700',
  },
  [STATUSES.NEGOCIATION]: {
    color: '#84cc16', bgLight: '#f7fee7',
    textClass: 'text-lime-700', badgeClass: 'bg-lime-100 text-lime-700',
  },
  [STATUSES.GAGNE]: {
    color: '#15803d', bgLight: '#f0fdf4',
    textClass: 'text-green-800', badgeClass: 'bg-green-100 text-green-800',
  },
  [STATUSES.VENTE_CONCLUE]: {
    color: '#059669', bgLight: '#ecfdf5',
    textClass: 'text-emerald-700', badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  [STATUSES.PERDU]: {
    color: '#64748b', bgLight: '#f8fafc',
    textClass: 'text-slate-600', badgeClass: 'bg-slate-200 text-slate-600',
  },
}

/** Ordre des colonnes Kanban (ARCHIVE exclu — vue dédiée) */
export const PIPELINE_ORDER = [
  STATUSES.PROSPECT,
  STATUSES.CONTACT,
  STATUSES.DEVIS,
  STATUSES.NEGOCIATION,
  STATUSES.GAGNE,
  STATUSES.VENTE_CONCLUE,
  STATUSES.PERDU,
]
