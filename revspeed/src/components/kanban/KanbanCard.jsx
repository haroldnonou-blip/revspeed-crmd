import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { PRIORITY_COLORS } from '../../constants/statuses'
import { formatPhone, getInitials, formatRelativeTime } from '../../utils/formatters'
import ShareDropdown from '../dashboard/ShareDropdown'

/**
 * KanbanCard — Fiche lead draggable + cliquable.
 *
 * Badges affichés (top, conditionnels) :
 *   - Priorité       → toujours visible
 *   - Vendeur        → "Marc V." si assigné, sinon absent
 *   - Issue appel    → label court si défini, sinon absent
 */
export default function KanbanCard({ lead, onCardClick, isOverlay = false }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:   lead.id,
    data: { status: lead.status },
  })

  const [showShare, setShowShare] = useState(false)

  const initials     = getInitials(lead.nom)
  const badgeClasses = PRIORITY_COLORS[lead.priorité] ?? 'bg-slate-100 text-slate-500 border border-slate-200'
  const timeLabel    = formatRelativeTime(lead.createdAt)

  // Nom du vendeur abrégé : "Marc Venturi" → "Marc V."
  const vendeurShort = abbreviateName(lead.vendeur)
  // Issue nettoyée (sans emoji trailing) et tronquée à 18 chars
  const issueShort   = cleanIssue(lead.issueAppel)

  // ─ RDV ──────────────────────────────────────────────
  const hasRdv = !!(lead.rdvDate && lead.rdvTime)
  const rdvIsPhone = lead.rdvType === 'Téléphonique'
  const rdvIsPhysical = lead.rdvType === 'Physique'

  // Couleur de fond + bordure de la carte selon le type de RDV
  const cardBg = hasRdv
    ? rdvIsPhone    ? 'bg-blue-50'
    : rdvIsPhysical ? 'bg-emerald-50'
    : 'bg-white'
    : 'bg-white'

  const cardBorder = hasRdv && !isDragging && !isOverlay
    ? rdvIsPhone    ? 'border-blue-200'
    : rdvIsPhysical ? 'border-emerald-200'
    : 'border-slate-200'
    : 'border-slate-200'

  // Label du créneau : "🕒 14:00 · 30min"
  const rdvSlotLabel = [
    lead.rdvTime,
    lead.rdvDuration ? `${lead.rdvDuration}min` : null,
  ].filter(Boolean).join(' · ')

  // Date courte : "14 juil"
  const rdvDateShort = lead.rdvDate
    ? new Date(lead.rdvDate + 'T00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    : null

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onCardClick?.(lead)}
      className={`
        p-4 rounded-2xl border
        select-none touch-none
        transition-all duration-150
        ${cardBg}

        ${isOverlay
          ? 'shadow-2xl rotate-2 scale-105 cursor-grabbing border-slate-300'
          : isDragging
            ? 'opacity-30 scale-95 border-dashed border-slate-300 cursor-grabbing shadow-none !bg-slate-50'
            : `${cardBorder} shadow-sm cursor-grab hover:shadow-md hover:-translate-y-0.5 active:cursor-grabbing`
        }
      `}
    >

      {/* ── Ligne 1 : avatar + nom ── */}
      <div className="flex items-start gap-3 mb-2.5">

        {/* Avatar */}
        <div className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 tracking-tight">
          {initials}
        </div>

        {/* Nom + badges */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-snug truncate mb-1.5">
            {lead.nom}
          </p>

          {/* ── Rangée de badges (flex-wrap pour ne pas déborder) ── */}
          <div className="flex flex-wrap gap-1">

            {/* Badge priorité — toujours présent */}
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeClasses}`}>
              {lead.priorité}
            </span>

            {/* Badge vendeur — conditionnel */}
            {vendeurShort && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                🧑‍💼 {vendeurShort}
              </span>
            )}

            {/* Badge issue appel — conditionnel */}
            {issueShort && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 max-w-[110px] truncate">
                {issueShort}
              </span>
            )}

          </div>
        </div>

      </div>

      {/* ── Séparateur ── */}
      <div className="h-px bg-slate-100 mb-2.5" />

      {/* ── Infos contact ── */}
      <div className="space-y-1.5 text-xs text-slate-500">
        <ContactRow icon="📞" value={formatPhone(lead.tel)} mono />
        <ContactRow icon="📍" value={lead.codePostal} />
        {lead.email && <ContactRow icon="✉️" value={lead.email} truncate />}
      </div>

      {/* ── Bandeau RDV (si planifié) ── */}
      {hasRdv && (
        <div className={`mt-2.5 flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] font-bold ${
          rdvIsPhone
            ? 'bg-blue-100/70 text-blue-700'
            : rdvIsPhysical
              ? 'bg-emerald-100/70 text-emerald-700'
              : 'bg-slate-100 text-slate-600'
        }`}>
          {/* Icône type */}
          <span className="shrink-0 text-sm">
            {rdvIsPhone ? '📞' : rdvIsPhysical ? '🤝' : '📅'}
          </span>

          {/* Créneau */}
          <span className="flex-1 min-w-0">
            🕒 {rdvSlotLabel}
          </span>

          {/* Date courte */}
          {rdvDateShort && (
            <span className="shrink-0 opacity-70 font-medium">{rdvDateShort}</span>
          )}
        </div>
      )}

      {/* ── Footer : horodatage + bouton partager ── */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        {timeLabel ? (
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <span>🕐</span>
            <span>{timeLabel}</span>
          </span>
        ) : <span />}

        {/* Bouton partager — ouvre dropdown inline */}
        <div className="relative shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setShowShare(s => !s) }}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
              showShare
                ? 'bg-orange-100 text-orange-700 border-orange-300'
                : 'text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100'
            }`}
          >
            📤 Partager
          </button>

          {showShare && (
            <ShareDropdown
              lead={lead}
              onClose={() => setShowShare(false)}
              anchor="top"
            />
          )}
        </div>
      </div>

    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Abrège un nom complet : "Marc Venturi" → "Marc V."
 * Retourne '' si vide/undefined.
 */
function abbreviateName(fullName) {
  if (!fullName?.trim()) return ''
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0]}.`
}

/**
 * Nettoie le label d'issue pour l'affichage en badge :
 *  - Supprime les emojis trailing (✅, 🏆…)
 *  - Tronque à 18 caractères
 */
function cleanIssue(issue) {
  if (!issue?.trim()) return ''
  const cleaned = issue.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✅]+\s*$/u, '').trim()
  return cleaned.length > 18 ? cleaned.slice(0, 17) + '…' : cleaned
}

// ── Sous-composant ligne contact ──────────────────────────────────────────────

function ContactRow({ icon, value, mono = false, truncate = false }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-slate-400 leading-none">{icon}</span>
      <span className={`leading-none ${mono ? 'font-mono' : ''} ${truncate ? 'truncate' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}
