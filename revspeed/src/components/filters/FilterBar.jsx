import { useState } from 'react'
import { STATUS_LABELS, PIPELINE_ORDER } from '../../constants/statuses'

// ── Préréglages de période ───────────────────────────────────────────────────

const DATE_PRESETS = [
  { value: 'all',    label: 'Toutes les dates' },
  { value: 'today',  label: "Aujourd'hui"       },
  { value: 'week',   label: 'Cette semaine'      },
  { value: 'month',  label: 'Ce mois'            },
  { value: 'custom', label: 'Personnalisé…'      },
]

/** Formate une date en YYYY-MM-DD en heure LOCALE (pas UTC). */
function fmt(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function computeDateRange(preset) {
  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (preset === 'today') return { startDate: fmt(today), endDate: fmt(today) }

  if (preset === 'week') {
    const mon = new Date(today)
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7)) // lundi
    return { startDate: fmt(mon), endDate: fmt(today) }
  }

  if (preset === 'month') {
    return {
      startDate: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
      endDate:   fmt(today),
    }
  }

  return { startDate: null, endDate: null }
}

// ── Composant ────────────────────────────────────────────────────────────────

/**
 * FilterBar — Barre de filtres d'import (au-dessus du Kanban).
 *
 * Permet de choisir la période et le statut avant de déclencher un
 * rechargement des données source. Le localStorage ne conserve que
 * la « vue active » correspondant aux filtres sélectionnés.
 *
 * Props :
 *   onRefresh      {Function}  — ({ startDate, endDate, status }) => void
 *   loading        {boolean}   — true pendant le rechargement
 *   activeFilters  {Object}    — filtres actuellement appliqués (pour badge)
 */
export default function FilterBar({ onRefresh, loading = false, activeFilters = {} }) {
  const [preset,      setPreset]      = useState('all')
  const [status,      setStatus]      = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd,   setCustomEnd]   = useState('')
  const [dirty,       setDirty]       = useState(false)   // filtres modifiés non appliqués

  const today = fmt(new Date())   // date max autorisée (pas de futur)

  function mark() { setDirty(true) }

  function handleRefresh() {
    const { startDate, endDate } =
      preset === 'custom'
        ? { startDate: customStart || null, endDate: customEnd || null }
        : computeDateRange(preset)

    onRefresh({
      startDate,
      endDate,
      status: status !== 'all' ? status : null,
    })
    setDirty(false)
  }

  // Un filtre est actif dès lors qu'on n'est pas en mode "tout / tous"
  const hasFilter = preset !== 'all' || status !== 'all'

  return (
    <div className="bg-white border-b border-slate-100 px-5 py-2 flex items-center gap-2 flex-wrap">

      {/* Label discret */}
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 select-none">
        Import
      </span>

      {/* Séparateur vertical */}
      <div className="w-px h-4 bg-slate-200 shrink-0" />

      {/* ── Sélecteur de période ── */}
      <div className="relative shrink-0">
        <select
          value={preset}
          onChange={e => { setPreset(e.target.value); mark() }}
          className={selectCls}
          title="Période de chargement"
        >
          {DATE_PRESETS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <ChevronIcon />
      </div>

      {/* Plage personnalisée */}
      {preset === 'custom' && (
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="date"
            value={customStart}
            max={customEnd || today}
            onChange={e => { setCustomStart(e.target.value); mark() }}
            className={inputDateCls}
          />
          <span className="text-slate-400 text-xs select-none">→</span>
          <input
            type="date"
            value={customEnd}
            min={customStart || undefined}
            max={today}
            onChange={e => { setCustomEnd(e.target.value); mark() }}
            className={inputDateCls}
          />
        </div>
      )}

      {/* ── Sélecteur de statut ── */}
      <div className="relative shrink-0">
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); mark() }}
          className={selectCls}
          title="Filtrer par statut pipeline"
        >
          <option value="all">Tous les statuts</option>
          {PIPELINE_ORDER.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <ChevronIcon />
      </div>

      {/* ── Bouton Appliquer ── */}
      <button
        onClick={handleRefresh}
        disabled={loading}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border
          transition-all duration-150 shrink-0
          ${dirty || hasFilter
            ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600 shadow-sm shadow-blue-200'
            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}
          ${loading ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'}
        `}
        title="Recharger les données avec ces filtres"
      >
        <span className={`inline-block transition-transform duration-300 ${loading ? 'animate-spin' : ''}`}>
          ⟳
        </span>
        {loading ? 'Chargement…' : 'Appliquer'}
      </button>

      {/* ── Badge "Vue filtrée" (après application) ── */}
      {hasFilter && !dirty && !loading && (
        <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-semibold select-none animate-fadeIn">
          Vue filtrée
        </span>
      )}

      {/* ── Badge "Modification en attente" ── */}
      {dirty && (
        <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-semibold select-none">
          Non appliqué
        </span>
      )}

      {/* Spacer + note discrète côté droit */}
      <div className="ml-auto shrink-0 hidden sm:block">
        <p className="text-[10px] text-slate-300 select-none">
          Recharge uniquement les leads correspondants
        </p>
      </div>

    </div>
  )
}

// ── Icône chevron pour les selects ───────────────────────────────────────────

function ChevronIcon() {
  return (
    <svg
      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
      width="10" height="10" viewBox="0 0 10 10" fill="none"
    >
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// ── Classes Tailwind ─────────────────────────────────────────────────────────

const selectCls = `
  pr-7 pl-2.5 py-1.5 text-xs
  bg-slate-50 border border-slate-200 rounded-xl
  text-slate-700 appearance-none cursor-pointer
  focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400
  transition-all duration-150
`

const inputDateCls = `
  text-xs py-1.5 px-2.5
  bg-slate-50 border border-slate-200 rounded-xl
  text-slate-700
  focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400
  transition-all duration-150
`
