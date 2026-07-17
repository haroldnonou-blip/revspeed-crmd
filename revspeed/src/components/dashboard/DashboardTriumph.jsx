/**
 * Dashboard — Cockpit décisionnel haute performance
 * ─────────────────────────────────────────────────────────────────────────────
 * Fonctionnalités :
 *  1. ANOMALIES & URGENCES   — leads > 24h sans action + partage CoachingModule
 *  2. KPI Cards              — 6 métriques + pastilles de tendance
 *  3. Performance Équipe     — progress bar, colonnes masquables (œil), Relancer
 *  4. Résumé Pipeline        — tableau cliquable + filtre inline + partage
 *  5. Filtre par date        — from/to bloqué au jour courant (pas de futur)
 *  6. CoachingModule         — modal de partage natif / clipboard formaté
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '../../services/api'
import {
  STATUSES,
  STATUS_LABELS,
  COLUMN_STYLES,
  PIPELINE_ORDER,
} from '../../constants/statuses'
import { VENDEURS } from '../../constants/vendeurs'
import ShareDropdown from './ShareDropdown'

// ── Constantes temporelles ─────────────────────────────────────────────────
const H24 = 24 * 60 * 60 * 1000
const D7  =  7 * 24 * 60 * 60 * 1000

// ── Date max = aujourd'hui (pas de futur dans le filtre) ──────────────────
const TODAY_STR = new Date().toISOString().split('T')[0]

// ── Helpers ─────────────────────────────────────────────────────────────────

function computeTrend(current, previous) {
  if (previous === 0 && current === 0) return { value: 0, dir: 'flat' }
  if (previous === 0)                  return { value: 100, dir: 'up' }
  const pct = Math.round(((current - previous) / previous) * 100)
  return { value: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

function weekCount(arr, weekOffset = 0) {
  const ts = Date.now()
  return arr.filter(l => {
    const age = ts - (l.createdAt ?? ts)
    return age >= weekOffset * D7 && age < (weekOffset + 1) * D7
  }).length
}

// ── TrendBadge ───────────────────────────────────────────────────────────────

function TrendBadge({ trend }) {
  if (!trend || trend.dir === 'flat') {
    return <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-400">→ stable</span>
  }
  const isUp = trend.dir === 'up'
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
      isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-500'
    }`}>
      {isUp ? '↗' : '↘'} {trend.value}%
    </span>
  )
}

// ── ColToggleBar — barre de toggle colonnes (au-dessus du tableau) ───────────

function ColToggleBar({ colVis, onToggle }) {
  const cols = [
    { key: 'assignes', label: 'Assignés'   },
    { key: 'rdvOk',    label: 'RDV OK'     },
    { key: 'convRate', label: 'Taux Conv.' },
    { key: 'charge',   label: 'Charge'     },
  ]
  return (
    <div className="flex items-center gap-2 mb-2 flex-wrap">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Colonnes :</span>
      {cols.map(c => (
        <button
          key={c.key}
          onClick={() => onToggle(c.key)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all duration-150 ${
            colVis[c.key]
              ? 'bg-white border-slate-300 text-slate-700 shadow-sm'
              : 'bg-slate-100 border-slate-200 text-slate-400 line-through'
          }`}
        >
          <span>{colVis[c.key] ? '👁' : '🙈'}</span>
          {c.label}
        </button>
      ))}
    </div>
  )
}

// ── Filtre par date ────────────────────────────────────────────────────────────

function DateFilter({ dateFrom, dateTo, onFromChange, onToChange, onReset, total, filtered }) {
  const isActive = !!(dateFrom || dateTo)

  return (
    <div className={`flex flex-wrap items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-200 ${
      isActive ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 shadow-sm'
    }`}>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
        🗓 Filtrer par date
      </span>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] font-semibold text-slate-400 shrink-0">Du</label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || TODAY_STR}
            onChange={e => onFromChange(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 transition-all cursor-pointer"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] font-semibold text-slate-400 shrink-0">Au</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            max={TODAY_STR}
            onChange={e => onToChange(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 transition-all cursor-pointer"
          />
        </div>
      </div>

      {isActive && (
        <>
          <span className="text-xs font-bold text-brand-600 bg-blue-100 px-2 py-1 rounded-full shrink-0">
            {filtered} lead{filtered > 1 ? 's' : ''} sur {total}
          </span>
          <button onClick={onReset} className="text-[10px] text-slate-400 hover:text-red-500 font-semibold transition-colors shrink-0">
            ✕ Réinitialiser
          </button>
        </>
      )}
    </div>
  )
}

// ── MODALE RELANCER ──────────────────────────────────────────────────────────

function RelancerModal({ vendeur, onClose }) {
  const prenom  = vendeur.name.split(' ')[0]
  const [message, setMessage] = useState(
    `Bonjour ${prenom},\n\nJe souhaite faire un point rapide sur tes ${vendeur.assignes} dossiers actifs.\n\nPeux-tu me donner une mise à jour sur l'avancement, notamment pour les RDV en attente ?\n\nMerci !`
  )
  const [sent, setSent] = useState(false)

  function handleSend() { setSent(true); setTimeout(onClose, 2000) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-brand-600 to-blue-700 px-6 py-5 flex items-start justify-between">
          <div>
            <p className="text-white font-black text-xl leading-tight">⚡ Relancer {prenom}</p>
            <p className="text-blue-200 text-xs mt-1">{vendeur.assignes} dossiers · {vendeur.rdvOk} RDV OK · {vendeur.convRate}% taux conv.</p>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white text-2xl leading-none transition-colors mt-0.5">✕</button>
        </div>
        <div className="px-6 pt-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Assignés',   value: vendeur.assignes, color: '#2563eb' },
            { label: 'RDV OK',     value: vendeur.rdvOk,    color: '#15803d' },
            { label: 'Conversion', value: `${vendeur.convRate}%`, color: vendeur.convRate >= 50 ? '#059669' : '#ef4444' },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="px-6 py-4">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Message de relance</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
            className="w-full text-sm text-slate-700 border border-slate-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 resize-none transition-all" />
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={handleSend} disabled={sent}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
              sent ? 'bg-emerald-500 text-white cursor-default' : 'bg-brand-600 hover:bg-blue-700 text-white shadow-lg active:scale-95'
            }`}>
            {sent ? '✓ Relance envoyée !' : '📨 Envoyer la relance'}
          </button>
          <button onClick={onClose} className="px-5 py-3 rounded-xl text-sm font-semibold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors">
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ANOMALIES & URGENCES ─────────────────────────────────────────────────────

function AnomaliesBlock({ anomalies }) {
  const count   = anomalies.length
  const isAlert = count > 0

  return (
    <div className={`rounded-2xl shadow-lg border transition-all duration-500 overflow-hidden ${
      isAlert ? 'bg-red-600 border-red-500 shadow-red-200' : 'bg-white border-slate-100'
    }`}>
      <div className="flex items-center gap-4 px-6 py-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-2xl ${
          isAlert ? 'bg-red-500' : 'bg-slate-100'
        }`}>
          {isAlert ? '🚨' : '✅'}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-widest ${isAlert ? 'text-red-200' : 'text-slate-400'}`}>
            ANOMALIES &amp; URGENCES
          </p>
          <p className={`text-base font-bold leading-snug mt-0.5 ${isAlert ? 'text-white' : 'text-slate-600'}`}>
            {isAlert
              ? `${count} dossier${count > 1 ? 's' : ''} non traité${count > 1 ? 's' : ''} depuis plus de 24h`
              : 'Pipeline sain — aucune anomalie détectée'}
          </p>
        </div>
        {isAlert && (
          <div className="shrink-0 text-right">
            <p className="text-5xl font-black text-white tabular-nums leading-none">{count}</p>
            <p className="text-red-300 text-xs font-semibold mt-0.5">urgents</p>
          </div>
        )}
      </div>

      {isAlert && (
        <div className="bg-red-700/40 border-t border-red-500/50">
          <div className="divide-y divide-red-500/30">
            {anomalies.map(l => (
              <div key={l.id} className="flex items-center gap-3 px-6 py-2.5">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-white block truncate">{l.nom || 'Sans nom'}</span>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {l.vendeur && <span className="text-[10px] text-red-300">👤 {l.vendeur}</span>}
                    <span className="text-[10px] text-red-300">📊 {STATUS_LABELS[l.status] ?? l.status}</span>
                    {l.tel && <span className="text-[10px] text-red-300">📞 {l.tel}</span>}
                  </div>
                </div>
                {/* Bouton partager → dropdown inline */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShareAnchor(a => a?.id === l.id ? null : l)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl border border-white/30 transition-all"
                  >
                    📤 Partager
                  </button>
                  {shareAnchor?.id === l.id && (
                    <ShareDropdown lead={l} onClose={() => setShareAnchor(null)} anchor="top" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── KPI CARD ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, trend, accent }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow duration-200 overflow-hidden">
      <div className="h-1" style={{ backgroundColor: accent }} />
      <div className="p-4 pt-3.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
        <p className="text-4xl font-black tabular-nums leading-none mb-2.5" style={{ color: accent }}>{value}</p>
        <div className="flex items-center gap-1.5">
          <TrendBadge trend={trend} />
          <span className="text-[9px] text-slate-300 font-medium">sem. préc.</span>
        </div>
      </div>
    </div>
  )
}

// ── VENDEUR ROW ───────────────────────────────────────────────────────────────

function VendeurRow({ vendeur, colVis, onRelancer }) {
  const { name, assignes, rdvOk, convRate, chargeRate, activeLeads, isOverloaded } = vendeur
  const hasDecided = (vendeur.ventes + vendeur.perdus) > 0
  const needsAlert = convRate < 50 && hasDecided
  const barColor   = convRate >= 70 ? '#059669' : convRate >= 50 ? '#f59e0b' : '#ef4444'
  const chargeColor = chargeRate >= 100 ? '#ef4444' : chargeRate >= 75 ? '#f97316' : chargeRate >= 50 ? '#f59e0b' : '#059669'
  const initials   = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <tr className={`hover:bg-slate-50/80 transition-colors group ${
      isOverloaded ? 'bg-orange-50/60 border-l-4 border-l-orange-400' : ''
    }`}>
      {/* Vendeur — toujours visible */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: isOverloaded ? '#f97316' : '#2563eb' }}
          >
            {initials}
          </div>
          <div>
            <span className={`font-semibold text-sm ${ isOverloaded ? 'text-orange-700' : 'text-slate-800' }`}>{name}</span>
            {isOverloaded && (
              <p className="text-[10px] font-bold text-orange-500 leading-none mt-0.5">🔴 Surcharge — réattribuer des leads</p>
            )}
          </div>
          {needsAlert && !isOverloaded && <span title="Taux de conversion < 50%">⚠️</span>}
        </div>
      </td>

      {/* Assignés */}
      {colVis.assignes && (
        <td className="px-5 py-3.5">
          <span className="text-sm font-black text-slate-800">{assignes}</span>
        </td>
      )}

      {/* RDV OK */}
      {colVis.rdvOk && (
        <td className="px-5 py-3.5">
          <span className="text-sm font-black text-emerald-700">{rdvOk}</span>
        </td>
      )}

      {/* Taux conversion */}
      {colVis.convRate && (
        <td className="px-5 py-3.5">
          {hasDecided ? (
            <div className="flex items-center gap-3 min-w-[140px]">
              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${convRate}%`, backgroundColor: barColor }} />
              </div>
              <span className="text-xs font-black w-10 text-right shrink-0 tabular-nums" style={{ color: barColor }}>
                {convRate}%
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-300 italic">—</span>
          )}
        </td>
      )}

      {/* Charge de travail */}
      {colVis.charge && (
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${chargeRate}%`, backgroundColor: chargeColor }}
              />
            </div>
            <span
              className="text-[11px] font-black shrink-0 tabular-nums"
              style={{ color: chargeColor }}
              title={`${activeLeads} / 20 leads actifs`}
            >
              {activeLeads}/20
            </span>
          </div>
          {isOverloaded && (
            <p className="text-[9px] text-orange-500 font-bold mt-0.5">🔴 Limite dépassée</p>
          )}
        </td>
      )}

      {/* Action — toujours visible */}
      <td className="px-5 py-3.5">
        <button
          onClick={onRelancer}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 ${
            isOverloaded
              ? 'bg-orange-500 hover:bg-orange-600 opacity-100'
              : 'bg-brand-600 hover:bg-blue-700 opacity-0 group-hover:opacity-100'
          }`}
        >
          ⚡ Relancer
        </button>
      </td>
    </tr>
  )
}

// ── PIPELINE ROW ─────────────────────────────────────────────────────────────

function PipelineRow({ stage, active, onClick, total }) {
  const pct = total > 0 ? Math.round((stage.count / total) * 100) : 0
  return (
    <tr onClick={onClick} className={`cursor-pointer transition-all duration-150 ${
      active ? 'bg-blue-50 border-l-4 border-brand-600' : 'hover:bg-slate-50 border-l-4 border-transparent'
    }`}>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
          <span className={`text-sm font-semibold ${active ? 'text-brand-600' : 'text-slate-700'}`}>{stage.label}</span>
          {active && <span className="text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded-full font-bold">Filtré</span>}
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className="text-lg font-black tabular-nums" style={{ color: stage.color }}>{stage.count}</span>
      </td>
      <td className="px-5 py-3.5 pr-6">
        <div className="flex items-center gap-3 justify-end">
          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: stage.color }} />
          </div>
          <span className="text-[11px] text-slate-400 font-semibold w-8 text-right tabular-nums">{pct}%</span>
        </div>
      </td>
    </tr>
  )
}

// ── PREVIEW LEADS FILTRÉS ────────────────────────────────────────────────────

function FilteredLeadsPreview({ filter, leads, onClear }) {
  const filtered = leads.filter(l => l.status === filter)
  const label    = STATUS_LABELS[filter] ?? filter
  const style    = COLUMN_STYLES[filter]

  if (filtered.length === 0) {
    return (
      <div className="mt-4 bg-white rounded-2xl shadow-lg border border-slate-100 p-5 text-center text-sm text-slate-400">
        Aucun lead dans cette étape.
      </div>
    )
  }

  return (
    <div className="mt-4 bg-white rounded-2xl shadow-lg border border-blue-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-blue-50" style={{ backgroundColor: style?.bgLight ?? '#f8fafc' }}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: style?.color ?? '#64748b' }} />
          <h3 className="font-black text-sm" style={{ color: style?.color ?? '#1e293b' }}>{label}</h3>
          <span className="text-xs font-bold text-slate-500">{filtered.length} lead{filtered.length > 1 ? 's' : ''}</span>
        </div>
        <button onClick={onClear} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">✕ Retirer le filtre</button>
      </div>

      <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
        {filtered.map(l => (
          <div key={l.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800 truncate">{l.nom || 'Sans nom'}</span>
                {l.priorité === 'haute' && (
                  <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold shrink-0">URGENT</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {l.vendeur && <span className="text-[10px] text-slate-400">👤 {l.vendeur.split(' ')[0]}</span>}
                {l.tel     && <span className="text-[10px] text-slate-400">📞 {l.tel}</span>}
                {l.email   && <span className="text-[10px] text-slate-400 truncate">📧 {l.email}</span>}
              </div>
            </div>
            {/* Bouton partager — dropdown inline */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShareAnchor(a => a?.id === l.id ? null : l)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-xl border transition-all bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
              >
                📤 Partager
              </button>
              {shareAnchor?.id === l.id && (
                <ShareDropdown lead={l} onClose={() => setShareAnchor(null)} anchor="top" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── COMPOSANT PRINCIPAL ───────────────────────────────────────────────────────

export default function Dashboard({ onFilterPipeline }) {
  const [leads,          setLeads]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [pipelineFilter, setPipelineFilter] = useState(null)
  const [relancerModal,  setRelancerModal]  = useState(null)
  const [shareAnchor,   setShareAnchor]    = useState(null)   // lead → ShareDropdown
  const [lastRefresh,    setLastRefresh]    = useState(null)

  // ── Filtre par date ──────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  // ── Visibilité colonnes (Performance Équipe) ─────────────────────────────
  const [colVis, setColVis] = useState({ assignes: true, rdvOk: true, convRate: true, charge: true })

  function toggleCol(key) {
    setColVis(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Fetch données ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const data = await api.getLeads()
      setLeads(data ?? [])
      setLastRefresh(new Date())
    } catch (err) {
      console.error('[Dashboard] erreur fetch:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Écoute temps réel : 'leadsUpdated' ──────────────────────────────────
  useEffect(() => {
    function onLeadsUpdated(e) {
      console.debug('[Dashboard] leadsUpdated', e.detail?.action)
      fetchData()
    }
    window.addEventListener('leadsUpdated', onLeadsUpdated)
    return () => window.removeEventListener('leadsUpdated', onLeadsUpdated)
  }, [fetchData])

  // ── Application filtre date ──────────────────────────────────────────────
  const leadsInRange = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom).setHours(0, 0, 0, 0)     : null
    const to   = dateTo   ? new Date(dateTo  ).setHours(23, 59, 59, 999) : null
    return leads.filter(l => {
      const ts = l.createdAt ?? 0
      if (from && ts < from) return false
      if (to   && ts > to)   return false
      return true
    })
  }, [leads, dateFrom, dateTo])

  const isDateFiltered = !!(dateFrom || dateTo)

  // ── Calcul métriques ─────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const pool   = leadsInRange
    const active = pool.filter(l => l.status !== STATUSES.ARCHIVE)
    const ts     = Date.now()

    const urgent   = active.filter(l => l.priorité === 'haute')
    const nouveaux = active.filter(l => l.status === STATUSES.PROSPECT)
    const enCours  = active.filter(l => l.status === STATUSES.CONTACT)
    const message  = active.filter(l => l.status === STATUSES.DEVIS)
    const rdv      = active.filter(l => l.status === STATUSES.GAGNE)
    const perdus   = pool.filter(l => l.status === STATUSES.PERDU)

    const STATUTS_FERMES = [STATUSES.VENTE_CONCLUE, STATUSES.PERDU, STATUSES.ARCHIVE]
    const anomalies = active.filter(l => {
      const lastTouch = l.updatedAt ?? l.createdAt ?? 0
      return (ts - lastTouch) > H24 && !STATUTS_FERMES.includes(l.status)
    })

    const trends = {
      urgent:   computeTrend(weekCount(urgent),   weekCount(urgent,   1)),
      nouveaux: computeTrend(weekCount(nouveaux), weekCount(nouveaux, 1)),
      enCours:  computeTrend(weekCount(enCours),  weekCount(enCours,  1)),
      message:  computeTrend(weekCount(message),  weekCount(message,  1)),
      rdv:      computeTrend(weekCount(rdv),      weekCount(rdv,      1)),
      perdus:   computeTrend(weekCount(perdus),   weekCount(perdus,   1)),
    }

    const vendeurStats = VENDEURS
      .filter(Boolean)
      .map(name => {
        const mine    = active.filter(l => l.vendeur === name)
        const rdvOk   = mine.filter(l => l.status === STATUSES.GAGNE).length
        const ventes  = mine.filter(l => l.status === STATUSES.VENTE_CONCLUE).length
        const perduV  = mine.filter(l => l.status === STATUSES.PERDU).length
        const decided = ventes + perduV
        const convRate    = decided > 0 ? Math.round((ventes / decided) * 100) : 0
        const activeLeads  = mine.filter(l => l.status !== STATUSES.PERDU && l.status !== STATUSES.VENTE_CONCLUE).length
        const chargeRate   = Math.min(Math.round((activeLeads / 20) * 100), 100)
        return { name, assignes: mine.length, rdvOk, ventes, perdus: perduV, convRate, activeLeads, chargeRate, isOverloaded: activeLeads > 20 }
      })
      .filter(v => v.assignes > 0)
      .sort((a, b) => b.convRate - a.convRate || b.assignes - a.assignes)

    const pipeline = PIPELINE_ORDER.map(status => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      count: pool.filter(l => l.status === status).length,
      color: COLUMN_STYLES[status]?.color   ?? '#64748b',
      bg:    COLUMN_STYLES[status]?.bgLight ?? '#f8fafc',
    }))

    return { urgent, nouveaux, enCours, message, rdv, perdus, anomalies, trends, vendeurStats, pipeline, active }
  }, [leadsInRange])

  // ── Gestion filtre pipeline ──────────────────────────────────────────────
  function handlePipelineClick(status) {
    const next = pipelineFilter === status ? null : status
    setPipelineFilter(next)
    onFilterPipeline?.(next)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400 font-medium">Chargement du dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-6" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            <span style={{ color: '#2563eb' }}>Dashboard</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Cockpit décisionnel · {metrics.active.length} lead{metrics.active.length > 1 ? 's' : ''} actif{metrics.active.length > 1 ? 's' : ''}
            {isDateFiltered && <span className="ml-2 text-brand-600 font-bold">· filtre date actif</span>}
          </p>
        </div>
        {lastRefresh && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Temps réel · {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FILTRE PAR DATE (max = aujourd'hui)                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <DateFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onFromChange={setDateFrom}
        onToChange={setDateTo}
        onReset={() => { setDateFrom(''); setDateTo('') }}
        total={leads.filter(l => l.status !== STATUSES.ARCHIVE).length}
        filtered={metrics.active.length}
      />

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ANOMALIES & URGENCES                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <AnomaliesBlock anomalies={metrics.anomalies} />

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* KPI CARDS                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">📊 Indicateurs Clés de Performance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard label="🔥 Urgents"  value={metrics.urgent.length}   trend={metrics.trends.urgent}   accent="#ef4444" />
          <KpiCard label="🆕 Nouveaux" value={metrics.nouveaux.length} trend={metrics.trends.nouveaux} accent="#3b82f6" />
          <KpiCard label="⚡ En cours" value={metrics.enCours.length}  trend={metrics.trends.enCours}  accent="#f59e0b" />
          <KpiCard label="💬 Message"  value={metrics.message.length}  trend={metrics.trends.message}  accent="#7d2ae8" />
          <KpiCard label="📅 RDV OK"   value={metrics.rdv.length}      trend={metrics.trends.rdv}      accent="#15803d" />
          <KpiCard label="❌ Perdus"   value={metrics.perdus.length}   trend={metrics.trends.perdus}   accent="#64748b" />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PERFORMANCE ÉQUIPE — colonnes masquables                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">👥 Performance Équipe</h2>

        {/* Barre toggle colonnes */}
        <ColToggleBar colVis={colVis} onToggle={toggleCol} />

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          {metrics.vendeurStats.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-2">👤</p>
              <p className="text-sm text-slate-400 font-medium">Aucun vendeur assigné aux leads actifs.</p>
              <p className="text-xs text-slate-300 mt-1">Assignez des leads via le Pipeline.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 px-5 py-3">Vendeur</th>
                  {colVis.assignes && <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 px-5 py-3">Assignés</th>}
                  {colVis.rdvOk    && <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 px-5 py-3">RDV OK</th>}
                  {colVis.convRate && <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 px-5 py-3">Taux Conversion</th>}
                  {colVis.charge   && <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 px-5 py-3">⚡ Charge</th>}
                  <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {metrics.vendeurStats.map(v => (
                  <VendeurRow
                    key={v.name}
                    vendeur={v}
                    colVis={colVis}
                    onRelancer={() => setRelancerModal(v)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* RÉSUMÉ PIPELINE                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">🗂 Résumé Pipeline</h2>
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 px-5 py-3">Étape</th>
                <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 px-5 py-3">Quantité</th>
                <th className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 px-5 py-3 pr-6">Proportion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {metrics.pipeline.map(p => (
                <PipelineRow
                  key={p.status}
                  stage={p}
                  active={pipelineFilter === p.status}
                  onClick={() => handlePipelineClick(p.status)}
                  total={metrics.active.length}
                />
              ))}
            </tbody>
          </table>
          <div className="px-5 py-2.5 border-t border-slate-50 bg-slate-50/50">
            <p className="text-[10px] text-slate-300 font-medium">
              💡 Cliquez sur une étape pour voir les leads — puis 🎯 Coacher pour partager au vendeur
            </p>
          </div>
        </div>

        {pipelineFilter && (
          <FilteredLeadsPreview
            filter={pipelineFilter}
            leads={leadsInRange}
            onClear={() => { setPipelineFilter(null); onFilterPipeline?.(null) }}

          />
        )}
      </section>

      {/* ── Modales ── */}
      {relancerModal && (
        <RelancerModal vendeur={relancerModal} onClose={() => setRelancerModal(null)} />
      )}
    </div>
  )
}
