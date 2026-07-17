/**
 * PlanningView — Planning Opérationnel par Vendeur
 * ─────────────────────────────────────────────────────────────────────────────
 * Fonctionnalités :
 *  1. Grille timeline hebdomadaire (8h–19h, Lun–Dim)
 *  2. Blocs RDV automatiques (leads statut "gagné" avec prochainRdv)
 *  3. Blocs prospection manuels (clic sur créneau vide)
 *  4. Filtre + légende par vendeur (code couleur)
 *  5. Suggestions automatiques : leads "En attente" depuis > 48h → To-Do
 */

import { useState, useEffect, useMemo } from 'react'
import { api } from '../../services/api'
import { VENDEURS } from '../../constants/vendeurs'
import { STATUSES, STATUS_LABELS, PRIORITY_COLORS } from '../../constants/statuses'

// ── Constantes ─────────────────────────────────────────────────────────────
const STORAGE_KEY   = 'revspeed:planning:blocs'
const HOURS         = Array.from({ length: 12 }, (_, i) => i + 8) // 8h → 19h
const DAYS_FR       = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const PALETTE       = ['#3b82f6', '#f59e0b', '#7d2ae8', '#ef4444', '#14b8a6', '#f97316', '#8b5cf6', '#ec4899']
const VENDEURS_LIST = VENDEURS.filter(Boolean)

function getVendeurColor(vendeur) {
  const idx = VENDEURS_LIST.indexOf(vendeur)
  return PALETTE[idx >= 0 ? idx % PALETTE.length : PALETTE.length - 1]
}

// ── Helpers date ────────────────────────────────────────────────────────────

function getWeekDates(refDate) {
  const d   = new Date(refDate)
  const dow = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  mon.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(mon)
    dt.setDate(mon.getDate() + i)
    return dt
  })
}

function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().split('T')[0]
}

function formatShort(date) {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function getISOWeek(date) {
  const d   = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - jan1) / 86400000) + 1) / 7)
}

function getWeekLabel(weekDates) {
  const wn = getISOWeek(weekDates[0])
  return `Sem. ${wn} · ${formatShort(weekDates[0])} – ${formatShort(weekDates[6])}`
}

function isToday(date) {
  return toDateKey(date) === toDateKey(new Date())
}

// ── localStorage ──────────────────────────────────────────────────────────

function loadBlocs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function saveBlocs(blocs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blocs))
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function PlanningView() {
  const [leads,         setLeads]         = useState([])
  const [blocs,         setBlocs]         = useState(loadBlocs)
  const [refDate,       setRefDate]       = useState(() => new Date())
  const [filterVendeur, setFilterVendeur] = useState('')
  const [addModal,      setAddModal]      = useState(null) // { date: Date, hour: number }
  const [selectedRdv,   setSelectedRdv]   = useState(null) // lead complet

  // ── Chargement leads ─────────────────────────────────────────────────────
  useEffect(() => {
    api.getLeads().then(d => setLeads(d ?? []))
    function onUpdate() { api.getLeads().then(d => setLeads(d ?? [])) }
    window.addEventListener('leadsUpdated', onUpdate)
    return () => window.removeEventListener('leadsUpdated', onUpdate)
  }, [])

  // ── Navigation semaine ───────────────────────────────────────────────────
  const weekDates = useMemo(() => getWeekDates(refDate), [refDate])
  function prevWeek() { setRefDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n }) }
  function nextWeek() { setRefDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n }) }
  function goToday()  { setRefDate(new Date()) }

  // ── Blocs RDV depuis leads ────────────────────────────────────────────────
  const rdvBlocs = useMemo(() =>
    leads
      .filter(l => l.rdvDate || l.prochainRdv)  // nouveaux champs OU ancien format
      .map(l => {
        let dateKey, hour, minute
        if (l.rdvDate) {
          // Nouveau format structuré (rdvDate + rdvTime)
          dateKey = l.rdvDate
          const parts = (l.rdvTime || '09:00').split(':')
          hour    = parseInt(parts[0], 10) || 9
          minute  = parseInt(parts[1] || '0', 10)
        } else {
          // Rétrocompat : ancien champ prochainRdv (datetime-local)
          const dt = new Date(l.prochainRdv)
          dateKey  = toDateKey(dt)
          hour     = dt.getHours()
          minute   = dt.getMinutes()
        }
        return {
          id:      `rdv-${l.id}`,
          kind:    'rdv',
          vendeur: l.vendeur ?? '',
          date:    dateKey,
          hour,
          minute,
          label:   l.nom ?? 'RDV',
          rdvType: l.rdvType ?? '',
          lead:    l,
        }
      }),
  [leads])

  // ── Suggestions "En attente" > 48h ───────────────────────────────────────
  const suggestions = useMemo(() => {
    const H48 = 48 * 3600 * 1000
    return leads.filter(l => {
      if (l.status !== STATUSES.NEGOCIATION) return false
      return (Date.now() - (l.updatedAt ?? l.createdAt ?? 0)) > H48
    })
  }, [leads])

  // ── Blocs combinés + filtre ───────────────────────────────────────────────
  const allBlocs      = useMemo(() => [...rdvBlocs, ...blocs], [rdvBlocs, blocs])
  const filteredBlocs = useMemo(() =>
    filterVendeur ? allBlocs.filter(b => b.vendeur === filterVendeur) : allBlocs,
  [allBlocs, filterVendeur])

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleAddBloc(vendeur, hour, label) {
    const newBloc = {
      id:      `bloc-${Date.now()}`,
      kind:    'prospection',
      vendeur,
      date:    toDateKey(addModal.date),
      hour,
      label:   label || 'Bloc prospection',
    }
    const updated = [...blocs, newBloc]
    setBlocs(updated)
    saveBlocs(updated)
    setAddModal(null)
  }

  function handleRemoveBloc(id) {
    const updated = blocs.filter(b => b.id !== id)
    setBlocs(updated)
    saveBlocs(updated)
  }

  function handleAddToTodo(lead) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const newBloc = {
      id:      `todo-${lead.id}-${Date.now()}`,
      kind:    'prospection',
      vendeur: lead.vendeur ?? '',
      date:    toDateKey(tomorrow),
      hour:    9,
      label:   `📞 Rappel: ${lead.nom ?? 'Client'}`,
    }
    const updated = [...blocs, newBloc]
    setBlocs(updated)
    saveBlocs(updated)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 p-6" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            <span style={{ color: '#2563eb' }}>Planning</span> Opérationnel
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Agenda par vendeur · {getWeekLabel(weekDates)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
            <ChevronLeftIcon />
          </button>
          <button onClick={goToday} className="px-4 py-1.5 text-xs font-bold rounded-xl bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors">
            Aujourd'hui
          </button>
          <button onClick={nextWeek} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      {/* ── Filtre par vendeur (légende couleur) ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendeur :</span>
        <button
          onClick={() => setFilterVendeur('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            !filterVendeur
              ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Tous
        </button>
        {VENDEURS_LIST.map(v => {
          const color    = getVendeurColor(v)
          const isActive = filterVendeur === v
          return (
            <button
              key={v}
              onClick={() => setFilterVendeur(f => f === v ? '' : v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                isActive
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              style={isActive ? { backgroundColor: color, borderColor: color } : {}}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              {v.split(' ')[0]}
            </button>
          )
        })}
      </div>

      {/* ── Grille timeline ── */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse">
          <colgroup>
            <col style={{ width: '56px' }} />
            {weekDates.map((_, i) => <col key={i} />)}
          </colgroup>

          {/* En-têtes jours */}
          <thead>
            <tr>
              <th className="bg-slate-50 border-b border-r border-slate-100 py-3" />
              {weekDates.map((date, i) => (
                <th
                  key={i}
                  className={`py-3 text-center border-b border-l border-slate-100 ${isToday(date) ? 'bg-blue-50' : 'bg-slate-50'}`}
                >
                  <div className={`text-xs font-bold ${isToday(date) ? 'text-blue-700' : 'text-slate-600'}`}>
                    {DAYS_FR[i]}
                  </div>
                  <div className={`text-[10px] font-medium mt-0.5 ${isToday(date) ? 'text-blue-500' : 'text-slate-400'}`}>
                    {formatShort(date)}
                    {isToday(date) && (
                      <span className="ml-1 text-[9px] bg-blue-500 text-white px-1 py-0.5 rounded-full">Auj.</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Lignes horaires */}
          <tbody>
            {HOURS.map(hour => (
              <tr key={hour}>
                <td className="bg-slate-50 border-r border-b border-slate-100 text-center py-2 text-[11px] font-bold text-slate-400 select-none">
                  {String(hour).padStart(2, '0')}h
                </td>
                {weekDates.map((date, di) => {
                  const key       = toDateKey(date)
                  const cellBlocs = filteredBlocs.filter(b => b.date === key && b.hour === hour)
                  return (
                    <td
                      key={di}
                      className={`border-l border-b border-slate-100 align-top p-1 cursor-pointer transition-colors relative ${
                        isToday(date) ? 'bg-blue-50/25 hover:bg-blue-100/40' : 'hover:bg-slate-50/80'
                      }`}
                      style={{ minHeight: '44px', height: '44px' }}
                      onClick={() => setAddModal({ date, hour })}
                    >
                      {/* Blocs dans la cellule */}
                      <div className="space-y-0.5" onClick={e => e.stopPropagation()}>
                        {cellBlocs.map(b => (
                          <PlanningChip
                            key={b.id}
                            bloc={b}
                            onRemove={b.kind === 'prospection' ? () => handleRemoveBloc(b.id) : undefined}
                            onView={b.kind === 'rdv' && b.lead ? () => setSelectedRdv(b.lead) : undefined}
                          />
                        ))}
                      </div>

                      {/* Indicateur "+" sur cellule vide au hover */}
                      {cellBlocs.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                          <span className="text-[10px] text-slate-300 font-semibold">＋</span>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Légende ── */}
      <div className="flex items-center gap-5 text-[10px] text-slate-400 font-medium px-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3 rounded" style={{ backgroundColor: '#3b82f6' }} />
          <span>RDV confirmé (Pipeline)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3 rounded border-2 border-dashed" style={{ borderColor: '#3b82f6', backgroundColor: '#3b82f61a' }} />
          <span>Bloc prospection (manuel)</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto text-slate-300">
          <span>💡 Cliquez sur un créneau vide pour ajouter un bloc</span>
        </div>
      </div>

      {/* ── Suggestions "En attente" > 48h ── */}
      {suggestions.length > 0 && (
        <SuggestionsPanel suggestions={suggestions} onAddToTodo={handleAddToTodo} />
      )}

      {/* ── Modal ajout bloc ── */}
      {addModal && (
        <AddBlocModal
          date={addModal.date}
          hour={addModal.hour}
          vendeurs={VENDEURS_LIST}
          onAdd={handleAddBloc}
          onClose={() => setAddModal(null)}
        />
      )}

      {/* ── Popup détail RDV ── */}
      {selectedRdv && (
        <RdvDetailModal lead={selectedRdv} onClose={() => setSelectedRdv(null)} />
      )}
    </div>
  )
}

// ── PlanningChip — bloc dans la grille ───────────────────────────────────────

function PlanningChip({ bloc, onRemove, onView }) {
  const color = getVendeurColor(bloc.vendeur)
  const isRdv = bloc.kind === 'rdv'

  return (
    <div
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold group leading-tight ${
        isRdv ? 'cursor-pointer hover:opacity-90' : ''
      }`}
      style={{
        backgroundColor: isRdv ? color : `${color}1a`,
        border:          isRdv ? 'none' : `1.5px dashed ${color}`,
        color:           isRdv ? '#fff' : color,
      }}
      title={isRdv ? 'Cliquer pour voir la fiche client' : (bloc.vendeur ? `${bloc.vendeur.split(' ')[0]} · ${bloc.label}` : bloc.label)}
      onClick={e => { if (isRdv && onView) { e.stopPropagation(); onView() } }}
    >
      <span className="shrink-0">{isRdv ? '📅' : '📞'}</span>
      <span className="flex-1 truncate" style={{ maxWidth: '80px' }}>{bloc.label}</span>
      {isRdv && <span className="opacity-0 group-hover:opacity-70 transition-opacity text-[8px] ml-0.5">▶</span>}
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity leading-none hover:scale-110 ml-0.5"
          style={{ color: isRdv ? '#fff' : color }}
          title="Supprimer"
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ── SuggestionsPanel — leads bloqués en attente ───────────────────────────────

function SuggestionsPanel({ suggestions, onAddToTodo }) {
  const [added, setAdded] = useState({})

  function handleAdd(lead) {
    onAddToTodo(lead)
    setAdded(a => ({ ...a, [lead.id]: true }))
  }

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-amber-200/60">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl shrink-0">⏰</div>
        <div>
          <p className="text-sm font-black text-amber-800">
            {suggestions.length} lead{suggestions.length > 1 ? 's' : ''} bloqué{suggestions.length > 1 ? 's' : ''} — « En attente » depuis plus de 48h
          </p>
          <p className="text-[10px] text-amber-600 mt-0.5 font-medium">
            Ajoutez-les dans la To-Do du lendemain (9h) pour relancer automatiquement
          </p>
        </div>
      </div>

      {/* Liste */}
      <div className="divide-y divide-amber-100/80">
        {suggestions.map(l => {
          const hours = Math.floor((Date.now() - (l.updatedAt ?? l.createdAt ?? 0)) / 3600000)
          const done  = added[l.id]
          return (
            <div key={l.id} className="flex items-center gap-3 px-5 py-3 hover:bg-amber-100/40 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-900 truncate">{l.nom || 'Sans nom'}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {l.vendeur && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: getVendeurColor(l.vendeur) }}
                    >
                      {l.vendeur.split(' ')[0]}
                    </span>
                  )}
                  {l.tel && <span className="text-[10px] text-amber-600">📞 {l.tel}</span>}
                  <span className="text-[10px] text-amber-500 font-medium">
                    ⏳ {hours >= 24 ? `${Math.floor(hours / 24)}j ${hours % 24}h` : `${hours}h`} sans action
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleAdd(l)}
                disabled={done}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  done
                    ? 'bg-emerald-100 text-emerald-700 cursor-default'
                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-95'
                }`}
              >
                {done ? '✓ Ajouté' : '📅 Ajouter demain'}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── AddBlocModal — modal d'ajout de bloc ──────────────────────────────────────

function AddBlocModal({ date, hour, vendeurs, onAdd, onClose }) {
  const [vendeur, setVendeur] = useState(vendeurs[0] ?? '')
  const [label,   setLabel]   = useState('')
  const [selHour, setSelHour] = useState(hour)

  const dateLabel = date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })
  const color     = getVendeurColor(vendeur)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="font-black text-slate-800">➕ Bloc de prospection</p>
            <p className="text-xs text-slate-400 capitalize mt-0.5">{dateLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Formulaire */}
        <div className="px-6 py-5 space-y-4">

          {/* Vendeur */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Vendeur</label>
            <select
              value={vendeur}
              onChange={e => setVendeur(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all appearance-none"
            >
              {vendeurs.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Créneau horaire */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Créneau</label>
            <select
              value={selHour}
              onChange={e => setSelHour(+e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all appearance-none"
            >
              {HOURS.map(h => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00 – {String(h + 1).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>

          {/* Libellé */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
              Libellé <span className="normal-case font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Appels entrants, Cold call, Suivi…"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all"
              onKeyDown={e => { if (e.key === 'Enter') onAdd(vendeur, selHour, label) }}
            />
          </div>

          {/* Aperçu couleur vendeur */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ backgroundColor: `${color}15`, color }}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span>{vendeur} — {String(selHour).padStart(2, '0')}:00</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={() => onAdd(vendeur, selHour, label)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 hover:opacity-90 shadow-md"
            style={{ backgroundColor: color }}
          >
            ✓ Ajouter le bloc
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Helpers message (identiques à LeadModal) ──────────────────────────────────

function buildTemplateMessage(nom) {
  const prenom = nom ? nom.trim().split(/\s+/)[0] : ''
  return [
    `Bonjour ${prenom},`,
    '',
    "C'est Max de Triumph Moto Livry-Gargan.",
    '',
    "J'ai essayé de vous joindre à l'instant sans succès.",
    '',
    'Je fais suite à votre demande pour votre projet Moto.',
    '',
    'Quand seriez-vous joignable\u00a0? Bonne journée\u00a0!',
  ].join('\n')
}

function toIntlPhone(raw) {
  if (!raw) return ''
  if (raw.startsWith('33') && raw.length >= 11) return raw
  if (raw.startsWith('0')  && raw.length === 10) return '33' + raw.slice(1)
  return raw
}

function getInitials(nom) {
  if (!nom) return '?'
  return nom.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ── RdvDetailModal — fiche client depuis l'agenda ────────────────────────────

function RdvDetailModal({ lead, onClose }) {
  const rawTel   = (lead.tel  || '').replace(/\D/g, '')
  const intlTel  = toIntlPhone(rawTel)
  const rawEmail = lead.email || ''
  // Support nouveaux champs rdvDate/rdvTime + rétrocompat prochainRdv
  const rdvDateObj = lead.rdvDate
    ? new Date(`${lead.rdvDate}T${lead.rdvTime || '00:00'}`)
    : (lead.prochainRdv ? new Date(lead.prochainRdv) : null)
  const msg      = buildTemplateMessage(lead.nom)
  const color    = getVendeurColor(lead.vendeur ?? '')

  const smsLink   = rawTel   ? `sms:${rawTel}?body=${encodeURIComponent(msg)}` : undefined
  const waLink    = intlTel  ? `https://wa.me/${intlTel}?text=${encodeURIComponent(msg)}` : undefined
  const emailLink = rawEmail
    ? `mailto:${rawEmail}?subject=${encodeURIComponent('Votre projet Moto – Triumph Moto Livry-Gargan')}&body=${encodeURIComponent(msg)}`
    : undefined

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ animation: 'fadeScaleIn 0.18s cubic-bezier(0.16,1,0.3,1)' }}
        onClick={e => e.stopPropagation()}
      >

        {/* En-tête client */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0 shadow-md"
            style={{ backgroundColor: color }}
          >
            {getInitials(lead.nom)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-800 text-base truncate">{lead.nom || 'Sans nom'}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                {STATUS_LABELS[lead.status] ?? lead.status}
              </span>
              {lead.priorité && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[lead.priorité] ?? 'bg-slate-100 text-slate-500'}`}>
                  {lead.priorité}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Date & heure du RDV */}
        {rdvDateObj && (
          <div
            className="mx-5 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ backgroundColor: `${color}12`, border: `1.5px solid ${color}35` }}
          >
            <span className="text-2xl shrink-0">
              {lead.rdvType === 'Téléphonique' ? '📞' : '📅'}
            </span>
            <div>
              <p className="text-xs font-black capitalize" style={{ color }}>
                {rdvDateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                <span>à {rdvDateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                {lead.rdvType && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: color }}>
                    {lead.rdvType}
                  </span>
                )}
                {lead.vendeur && <span className="text-slate-400">· {lead.vendeur}</span>}
              </p>
            </div>
          </div>
        )}

        {/* Coordonnées */}
        <div className="px-5 mt-4 space-y-2">
          {rawTel && (
            <div className="flex items-center gap-2">
              <span className="text-base">📞</span>
              <a href={`tel:${rawTel}`} className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors">{lead.tel}</a>
            </div>
          )}
          {rawEmail && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0">📧</span>
              <a href={`mailto:${rawEmail}`} className="text-sm text-slate-600 hover:text-blue-600 transition-colors truncate">{lead.email}</a>
            </div>
          )}
          {lead.codePostal && (
            <div className="flex items-center gap-2">
              <span className="text-base">📍</span>
              <span className="text-sm text-slate-600">{lead.codePostal}</span>
            </div>
          )}
        </div>

        {/* Actions contact rapide */}
        <div className="px-5 mt-4 grid grid-cols-3 gap-2">
          <a
            href={rawTel ? `tel:${rawTel}` : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-bold text-white transition-opacity ${
              rawTel ? 'hover:opacity-90 active:scale-95' : 'opacity-40 pointer-events-none'
            }`}
            style={{ backgroundColor: '#15803d' }}
          >
            <span>📞</span> Appeler
          </a>
          <a
            href={smsLink}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-bold text-white transition-opacity ${
              rawTel ? 'hover:opacity-90 active:scale-95' : 'opacity-40 pointer-events-none'
            }`}
            style={{ backgroundColor: '#7d2ae8' }}
          >
            <span>💬</span> SMS
          </a>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-bold text-white transition-opacity ${
              intlTel ? 'hover:opacity-90 active:scale-95' : 'opacity-40 pointer-events-none'
            }`}
            style={{ backgroundColor: '#25D366' }}
          >
            <span>🟢</span> WhatsApp
          </a>
        </div>

        {/* Qualification + Notes */}
        {(lead.qualification || lead.notes) && (
          <div className="px-5 mt-4 space-y-2">
            {lead.qualification && (
              <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1">✅ Qualification</p>
                <p className="text-xs text-violet-800 leading-relaxed">{lead.qualification}</p>
              </div>
            )}
            {lead.notes && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">📝 Notes</p>
                <p className="text-xs text-slate-600 leading-relaxed">{lead.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Issue appel */}
        {lead.issueAppel && (
          <div className="px-5 mt-3 flex items-center gap-2">
            <span className="text-sm">📋</span>
            <span className="text-xs text-slate-500 font-medium">{lead.issueAppel}</span>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 mt-3">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// ── Icônes SVG ────────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
