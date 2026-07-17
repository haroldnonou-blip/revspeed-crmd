import { useState } from 'react'
import { STATUS_LABELS } from '../../constants/statuses'
import { formatPhone, getInitials, formatDateTime } from '../../utils/formatters'

/**
 * ArchivesView — Vue des leads archivés.
 *
 * Affiche tous les leads avec status === 'archivé'.
 * Chaque carte a un bouton "Restaurer" qui remet le lead à son étape d'origine.
 *
 * Props:
 *   leads      {Object[]}  — leads archivés (triés par archivedAt desc)
 *   onRestore  {Function}  — (leadId) => void
 *   search     {string}    — filtre texte partagé avec la vue Pipeline
 */
export default function ArchivesView({ leads, onRestore, search = '' }) {
  const filtered = leads.filter((lead) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      lead.nom?.toLowerCase().includes(q) ||
      lead.email?.toLowerCase().includes(q) ||
      lead.tel?.includes(q)
    )
  })

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-5xl mb-4">📦</p>
        <p className="text-slate-600 font-semibold text-lg">Aucun lead archivé</p>
        <p className="text-slate-400 text-sm mt-1">
          Utilisez le bouton "Archiver" dans la fiche d'un lead pour le déplacer ici.
        </p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <p className="text-slate-500 font-medium">Aucun résultat pour « {search} »</p>
      </div>
    )
  }

  return (
    <div>
      {/* En-tête */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-700">
            📦 Leads archivés
            <span className="ml-2 text-xs font-normal text-slate-400">
              {filtered.length}/{leads.length} affiché{filtered.length > 1 ? 's' : ''}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Restaurez un lead pour le remettre à son étape d'origine dans le pipeline.
          </p>
        </div>
      </div>

      {/* Grille */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((lead) => (
          <ArchiveCard key={lead.id} lead={lead} onRestore={onRestore} />
        ))}
      </div>
    </div>
  )
}

// ── ArchiveCard ──────────────────────────────────────────────────────────────

function ArchiveCard({ lead, onRestore }) {
  const [confirming, setConfirming] = useState(false)
  const initials     = getInitials(lead.nom)
  const originLabel  = STATUS_LABELS[lead.archivedFrom] ?? lead.archivedFrom ?? '—'
  const archivedDate = formatDateTime(lead.archivedAt)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3 opacity-90 hover:opacity-100 transition-opacity">

      {/* Avatar + infos */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center text-sm font-bold text-slate-500">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-700 text-sm truncate">{lead.nom}</p>
          {lead.email && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{lead.email}</p>
          )}
          {lead.tel && (
            <p className="text-xs text-slate-400 font-mono">{formatPhone(lead.tel)}</p>
          )}
        </div>
      </div>

      {/* Méta-données archivage */}
      <div className="text-xs text-slate-400 space-y-0.5 border-t border-slate-100 pt-2">
        <div className="flex items-center gap-1">
          <span>📋</span>
          <span>Était en : <span className="font-medium text-slate-600">{originLabel}</span></span>
        </div>
        {archivedDate && (
          <div className="flex items-center gap-1">
            <span>🕐</span>
            <span>Archivé le {archivedDate}</span>
          </div>
        )}
        {lead.vendeur && (
          <div className="flex items-center gap-1">
            <span>🧑‍💼</span>
            <span>{lead.vendeur}</span>
          </div>
        )}
      </div>

      {/* Bouton Restaurer */}
      <button
        onClick={() => {
          if (!confirming) {
            setConfirming(true)
            setTimeout(() => setConfirming(false), 3000)
          } else {
            onRestore(lead.id)
          }
        }}
        className={`
          w-full py-2 rounded-xl text-xs font-semibold transition-all duration-150
          ${confirming
            ? 'bg-blue-500 text-white scale-[1.02]'
            : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200'
          }
        `}
      >
        {confirming ? '✓ Confirmer la restauration' : '↩ Restaurer dans le pipeline'}
      </button>

    </div>
  )
}
