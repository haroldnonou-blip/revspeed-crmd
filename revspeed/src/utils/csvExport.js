/**
 * RevSpeed — Utilitaire d'export CSV
 *
 * Génère un fichier .csv à partir des leads fournis par le service api.js.
 * BOM UTF-8 inclus pour ouverture correcte dans Excel (accents français).
 */

/** Colonnes exportées — ordre et labels */
const COLUMNS = [
  { key: 'id',            label: 'ID'                  },
  { key: 'nom',           label: 'Nom'                 },
  { key: 'tel',           label: 'Téléphone'           },
  { key: 'email',         label: 'Email'               },
  { key: 'codePostal',    label: 'Code Postal'         },
  { key: 'status',        label: 'Statut Pipeline'     },
  { key: 'priorité',      label: 'Priorité'            },
  { key: 'vendeur',       label: 'Vendeur'             },
  { key: 'issueAppel',    label: 'Issue de l\'appel'   },
  { key: 'prochainRdv',   label: 'Prochain RDV'        },
  { key: 'qualification', label: 'Qualification besoin' },
  { key: 'notes',         label: 'Notes'               },
  { key: 'createdAt',     label: 'Date création'       },
  { key: 'archivedAt',    label: 'Date archivage'      },
  { key: 'archivedFrom',  label: 'Archivé depuis'      },
]

/**
 * Formate une valeur brute pour l'export CSV.
 * - Timestamps (ms) → date lisible en français
 * - Sauts de ligne   → remplacés par " | "
 * - Guillemets       → doublés (norme RFC 4180)
 */
function formatCell(key, value) {
  if (value === null || value === undefined) return ''

  // Timestamps en millisecondes
  if ((key === 'createdAt' || key === 'archivedAt') && typeof value === 'number') {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  // Chaînes multi-lignes (qualification, notes)
  return String(value)
    .replace(/\r?\n/g, ' | ')    // sauts de ligne → pipe
    .replace(/"/g, '""')          // guillemets doublés (RFC 4180)
}

/**
 * Exporte un tableau de leads en fichier CSV téléchargeable.
 *
 * @param {Object[]} leads    — tous les leads (actifs + archivés)
 * @param {string}   filename — nom du fichier (défaut: revspeed-YYYY-MM-DD.csv)
 */
export function exportLeadsToCSV(leads, filename) {
  const today = new Date().toISOString().slice(0, 10)
  const name  = filename ?? `revspeed-${today}.csv`

  const header = COLUMNS.map(c => `"${c.label}"`).join(',')

  const rows = leads.map(lead =>
    COLUMNS
      .map(({ key }) => `"${formatCell(key, lead[key])}"`)
      .join(','),
  )

  // BOM UTF-8 (\uFEFF) → ouverture correcte dans Excel
  const csv  = '\uFEFF' + [header, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)

  const anchor    = document.createElement('a')
  anchor.href     = url
  anchor.download = name
  anchor.click()

  URL.revokeObjectURL(url)
  console.info(`[csvExport] ${leads.length} leads exportés → ${name}`)
}
