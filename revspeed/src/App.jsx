import { useEffect, useMemo, useState, Component } from 'react'

// ── Error Boundary — évite l'écran blanc silencieux ─────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(err) { return { error: err } }
  componentDidCatch(err, info) { console.error('[RevSpeed] Erreur render:', err, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 p-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
            <div className="text-5xl">🛠️</div>
            <h2 className="text-xl font-black text-slate-800">Oups, une erreur s'est produite</h2>
            <pre className="text-xs text-red-500 bg-red-50 rounded-xl p-3 text-left overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => { localStorage.clear(); window.location.reload() }}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
            >
              🔄 Réinitialiser et recharger
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
import { useLeads } from './hooks/useLeads'
import { api } from './services/api'
import { exportLeadsToCSV } from './utils/csvExport'
import { PIPELINE_ORDER } from './constants/statuses'
import KanbanBoard from './components/kanban/KanbanBoard'
import StatsBar from './components/dashboard/StatsBar'
import Dashboard from './components/dashboard/DashboardTriumph'
import ArchivesView from './components/archives/ArchivesView'
import FilterBar from './components/filters/FilterBar'
import PlanningView from './components/planning/PlanningView'

/**
 * RevSpeed — App.jsx (Itération 7 Pro)
 *
 * Nouveautés :
 *  - Toutes les données transitent par services/api.js
 *  - Dashboard StatsBar (closing rate, actifs, par vendeur)
 *  - Export CSV (tous champs, BOM UTF-8, date dans le nom)
 */
export default function App() {
  const {
    leads,
    leadsByStatus,
    archivedLeads,
    totalLeads,
    loading,
    error,
    canUndo,
    canRedo,
    historyCount,
    moveLeadToColumn,
    updateLead,
    archiveLead,
    restoreLead,
    undo,
    redo,
    resetLeads,
    refreshWithFilters,
    importFilters,
    getLeadById,
  } = useLeads()

  const [activeTab,    setActiveTab]    = useState('dashboard')
  const [search,       setSearch]       = useState('')
  const [sortDir,      setSortDir]      = useState('newest')
  const [confirmReset, setConfirmReset] = useState(false)
  const [exporting,    setExporting]    = useState(false)

  // ── Raccourcis clavier ─────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  // ── Filtre + tri ───────────────────────────────────────────────────────
  const filteredLeadsByStatus = useMemo(() => {
    const q   = search.trim().toLowerCase()
    const cmp = sortDir === 'newest'
      ? (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
      : (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)

    return Object.fromEntries(
      PIPELINE_ORDER.map(status => [
        status,
        (leadsByStatus[status] ?? [])
          .filter(l => !q || l.nom?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.tel?.includes(q))
          .sort(cmp),
      ]),
    )
  }, [leadsByStatus, search, sortDir])

  const matchCount = Object.values(filteredLeadsByStatus).flat().length

  // ── Export CSV ─────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true)
    try {
      const allLeads = await api.getLeads() ?? []
      exportLeadsToCSV(allLeads)
    } finally {
      setTimeout(() => setExporting(false), 1500)
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────
  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 3000)
    } else {
      setConfirmReset(false)
      resetLeads()
    }
  }

  // ── États transitoires ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Chargement du pipeline…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-sm text-center shadow">
          <p className="text-red-600 font-semibold">Erreur de chargement</p>
          <p className="text-red-400 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3 shadow-sm shrink-0">

        {/* Logo */}
        <div className="shrink-0">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">
            Rev<span style={{ color: '#3b82f6' }}>Speed</span>
            <span className="ml-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest align-middle">CRM</span>
          </h1>
          <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">Cliquer · Glisser · Exporter</p>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0">
          <UndoRedoBtn onClick={undo} disabled={!canUndo} title={canUndo ? `Annuler (Ctrl+Z) · ${historyCount}` : 'Rien à annuler'}>
            <UndoIcon active={canUndo} />
          </UndoRedoBtn>
          <div className="w-px h-4 bg-slate-200" />
          <UndoRedoBtn onClick={redo} disabled={!canRedo} title={canRedo ? 'Rétablir (Ctrl+Y)' : 'Rien à rétablir'}>
            <RedoIcon active={canRedo} />
          </UndoRedoBtn>
        </div>

        {/* Recherche */}
        <div className="relative flex-1 min-w-0 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom, email, tél…"
            className="w-full pl-8 pr-7 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
          )}
        </div>

        {/* Tri */}
        <select
          value={sortDir}
          onChange={e => setSortDir(e.target.value)}
          className="shrink-0 text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 focus:outline-none cursor-pointer"
        >
          <option value="newest">↓ Plus récent</option>
          <option value="oldest">↑ Plus ancien</option>
        </select>

        {/* Export CSV */}
        <button
          onClick={handleExport}
          disabled={exporting}
          title="Exporter tous les leads en CSV (Excel-compatible)"
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
            exporting
              ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700'
          }`}
        >
          {exporting ? '✓ Exporté !' : '⬇ CSV'}
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200 ${
            confirmReset ? 'bg-red-50 border-red-300 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
          }`}
        >
          <span className={`transition-transform duration-300 inline-block ${confirmReset ? 'rotate-180' : ''}`}>↺</span>
          <span className="hidden sm:inline">{confirmReset ? 'Confirmer ?' : 'Reset'}</span>
        </button>

        {/* Total */}
        <div className="shrink-0 flex items-center gap-2">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Leads</p>
            <p className="text-xl font-bold leading-none" style={{ color: '#3b82f6' }}>
              {search ? `${matchCount}/${totalLeads}` : totalLeads}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">🚀</div>
        </div>

      </header>

      {/* ─── TABS ────────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-slate-200 px-5 flex items-center">
        <TabBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')}>
          📊 Dashboard
        </TabBtn>
        <TabBtn active={activeTab === 'pipeline'} onClick={() => setActiveTab('pipeline')}>
          📋 Pipeline
        </TabBtn>
        <TabBtn active={activeTab === 'archives'} onClick={() => setActiveTab('archives')}>
          📦 Archives
          {archivedLeads.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">
              {archivedLeads.length}
            </span>
          )}
        </TabBtn>
        <TabBtn active={activeTab === 'planning'} onClick={() => setActiveTab('planning')}>
          📅 Planning
        </TabBtn>
      </nav>

      {/* ─── FILTER BAR (Pipeline uniquement) ────────────────────────────── */}
      {activeTab === 'pipeline' && (
        <FilterBar
          onRefresh={refreshWithFilters}
          loading={loading}
          activeFilters={importFilters}
        />
      )}

      {/* ─── STATS BAR (Pipeline uniquement) ─────────────────────────────── */}
      {activeTab === 'pipeline' && (
        <StatsBar leads={leads} />
      )}

      {/* ─── CONTENU ─────────────────────────────────────────────────────── */}
      <main className={`flex-1 ${activeTab === 'pipeline' ? 'overflow-x-auto p-6' : 'overflow-y-auto'}`} key={activeTab}>

        {activeTab === 'dashboard' && (
          <Dashboard
            onFilterPipeline={(status) => {
              if (status) setActiveTab('pipeline')
            }}
          />
        )}

        {activeTab === 'pipeline' && (
          <KanbanBoard
            leadsByStatus={filteredLeadsByStatus}
            moveLeadToColumn={moveLeadToColumn}
            updateLead={updateLead}
            archiveLead={archiveLead}
            getLeadById={getLeadById}
          />
        )}

        {activeTab === 'archives' && (
          <ArchivesView
            leads={archivedLeads}
            onRestore={restoreLead}
            search={search}
          />
        )}

        {activeTab === 'planning' && (
          <PlanningView />
        )}

      </main>

      <footer className="shrink-0 text-center py-1.5">
        <p className="text-[10px] text-slate-300">
          RevSpeed CRM Pro · api.js → localStorage (migration GAS prête)
          {canUndo && <span className="ml-2 text-slate-400">· {historyCount} action{historyCount > 1 ? 's' : ''} dans l'historique</span>}
        </p>
      </footer>

    </div>
    </ErrorBoundary>
  )
}

// ── Composants UI ─────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150 ${
        active
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

function UndoRedoBtn({ onClick, disabled, title, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 ${
        disabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-white hover:shadow-sm cursor-pointer'
      }`}
    >
      {children}
    </button>
  )
}

function UndoIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'currentColor' : '#cbd5e1'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" /><path d="M3 13C5.4 7.8 11 4 17 4a9 9 0 019 9" />
    </svg>
  )
}

function RedoIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'currentColor' : '#cbd5e1'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7v6h-6" /><path d="M21 13C18.6 7.8 13 4 7 4a9 9 0 00-9 9" />
    </svg>
  )
}
