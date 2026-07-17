import { useMemo } from 'react'
import { STATUSES } from '../../constants/statuses'

/**
 * StatsBar — Barre de pilotage commercial.
 *
 * Affiche en temps réel :
 *   - Taux de closing (ventes conclues / actifs)
 *   - Leads actifs (hors archivés)
 *   - Ventes conclues
 *   - Répartition par vendeur (top 4, format "Marc V. · 3")
 *
 * Props:
 *   leads  {Object[]}  — tableau plat de tous les leads (useLeads().leads)
 */
export default function StatsBar({ leads }) {
  const stats = useMemo(() => {
    const active  = leads.filter(l => l.status !== STATUSES.ARCHIVE)
    const won     = leads.filter(l => l.status === STATUSES.VENTE_CONCLUE)
    const lost    = leads.filter(l => l.status === STATUSES.PERDU)

    // Taux de closing : ventes conclues / (ventes conclues + perdus)
    // Représente le win rate sur les deals décidés — plus pertinent que /total
    const decided     = won.length + lost.length
    const closingRate = decided > 0 ? Math.round((won.length / decided) * 100) : null

    // Répartition par vendeur (leads actifs uniquement)
    const byVendeur = active
      .filter(l => l.vendeur)
      .reduce((acc, l) => { acc[l.vendeur] = (acc[l.vendeur] ?? 0) + 1; return acc }, {})

    const topVendeurs = Object.entries(byVendeur)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([name, count]) => ({ name: abbreviateName(name), count }))

    return { active, won, lost, closingRate, topVendeurs, decided }
  }, [leads])

  const rateColor = stats.closingRate === null
    ? '#94a3b8'
    : stats.closingRate >= 50 ? '#059669'
    : stats.closingRate >= 25 ? '#d97706'
    : '#ef4444'

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-2.5 shrink-0">
      <div className="flex items-center gap-1 overflow-x-auto">

        {/* Taux de closing */}
        <StatBlock
          label="Taux de closing"
          value={stats.closingRate !== null ? `${stats.closingRate}%` : '—'}
          sub={stats.decided > 0 ? `${stats.won.length}/${stats.decided} décidés` : 'Pas de données'}
          valueColor={rateColor}
        />

        <Divider />

        {/* Leads actifs */}
        <StatBlock
          label="Leads actifs"
          value={stats.active.length}
          sub="hors archivés"
        />

        <Divider />

        {/* Ventes conclues */}
        <StatBlock
          label="Ventes conclues"
          value={stats.won.length}
          sub="🏆"
          valueColor="#059669"
        />

        {/* Répartition par vendeur — uniquement si des vendeurs sont assignés */}
        {stats.topVendeurs.length > 0 && (
          <>
            <Divider />
            <div className="shrink-0">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-1.5">
                Par vendeur
              </p>
              <div className="flex flex-wrap gap-1.5">
                {stats.topVendeurs.map(({ name, count }) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full"
                  >
                    {name}
                    <span className="font-bold text-slate-700 bg-slate-200 rounded-full px-1 text-[10px]">
                      {count}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function StatBlock({ label, value, sub, valueColor }) {
  return (
    <div className="shrink-0 pr-2">
      <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-0.5">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-2xl font-bold leading-none tabular-nums"
          style={{ color: valueColor ?? '#1e293b' }}
        >
          {value}
        </span>
        {sub && (
          <span className="text-[10px] text-slate-400 leading-none">{sub}</span>
        )}
      </div>
    </div>
  )
}

function Divider() {
  return <div className="shrink-0 w-px h-8 bg-slate-200 mx-3" />
}

function abbreviateName(fullName) {
  if (!fullName?.trim()) return fullName
  const parts = fullName.trim().split(/\s+/)
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[1][0]}.`
}
