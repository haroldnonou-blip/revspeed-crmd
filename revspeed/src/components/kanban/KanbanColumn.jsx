import { useDroppable } from '@dnd-kit/core'
import KanbanCard from './KanbanCard'
import { COLUMN_STYLES, STATUS_ICONS } from '../../constants/statuses'

/**
 * KanbanColumn — Zone de dépôt + liste de leads.
 *
 * Props:
 *   status        {string}    — clé du statut
 *   label         {string}    — titre affiché
 *   leads         {Object[]}  — leads de cette colonne
 *   isDragActive  {boolean}   — drag en cours dans le board
 *   onCardClick   {Function}  — (lead) => void — ouvre la modale
 */
export default function KanbanColumn({ status, label, leads = [], isDragActive, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  const style = COLUMN_STYLES[status] ?? {
    color:      '#94a3b8',
    bgLight:    '#f8fafc',
    textClass:  'text-slate-600',
    badgeClass: 'bg-slate-200 text-slate-600',
  }

  const icon    = STATUS_ICONS[status] ?? '•'
  const isEmpty = leads.length === 0

  return (
    <div
      className={`
        flex flex-col w-60 min-w-[240px] rounded-2xl border shadow-sm overflow-hidden
        transition-all duration-200
        ${isOver       ? 'shadow-lg scale-[1.02]' : ''}
        ${isDragActive ? 'opacity-90'             : 'border-slate-200'}
      `}
      style={{ borderColor: isOver ? style.color : undefined }}
    >

      {/* ── En-tête coloré ── */}
      <div
        className="px-4 py-3 border-b"
        style={{
          borderTop:         `4px solid ${style.color}`,
          backgroundColor:   style.bgLight,
          borderBottomColor: `${style.color}30`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base leading-none select-none">{icon}</span>
            <h2 className={`text-sm font-bold truncate ${style.textClass}`}>{label}</h2>
          </div>
          <span className={`shrink-0 min-w-[22px] text-center text-xs font-bold px-2 py-0.5 rounded-full transition-all duration-300 ${style.badgeClass}`}>
            {leads.length}
          </span>
        </div>
      </div>

      {/* ── Zone de dépôt ── */}
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 p-3 flex-1 min-h-[160px] transition-colors duration-200 ${isOver ? 'bg-slate-100' : 'bg-slate-50'}`}
        style={isOver ? { backgroundColor: `${style.color}08` } : undefined}
      >
        {isOver && isEmpty && (
          <div
            className="flex items-center justify-center h-16 rounded-xl border-2 border-dashed text-xs font-medium"
            style={{ borderColor: style.color, color: style.color }}
          >
            Déposer ici
          </div>
        )}

        {!isOver && isEmpty && (
          <div className="flex items-center justify-center flex-1 py-6">
            <p className="text-xs text-slate-400 italic">Aucun lead</p>
          </div>
        )}

        {leads.map((lead) => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            onCardClick={onCardClick}
          />
        ))}
      </div>

    </div>
  )
}
