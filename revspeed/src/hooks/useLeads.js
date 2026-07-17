import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { api } from '../services/api'
import { fetchLeads } from '../services/dataService'
import { PIPELINE_ORDER } from '../constants/statuses'

const MAX_HISTORY = 10

/**
 * useLeads — État global des leads.
 *
 * Source de données : api.js (localStorage → futur Google Apps Script).
 * Toutes les mutations passent par api.js ; les composants n'accèdent
 * jamais au localStorage directement.
 *
 * Fonctionnalités :
 *  - Chargement (localStorage → fallback JSON)
 *  - Persistance automatique à chaque mutation
 *  - Undo/Redo (pile 10 déplacements)
 *  - Archivage / Restauration
 *  - Migration createdAt
 */
export function useLeads() {
  const [leads, setLeads]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [past, setPast]           = useState([])
  const [future, setFuture]       = useState([])
  const [importFilters, setImportFilters] = useState({})   // filtres d'import actifs

  const leadsRef   = useRef([])
  const syncTimer   = useRef(null)     // débounce des événements 'leadsUpdated'
  const isLoadingRef = useRef(false)  // évite les syncs concurrentes

  useEffect(() => { leadsRef.current = leads }, [leads])

  // ── Chargement initial ─────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        // 1. Via api.js (localStorage, avec migration automatique des clés)
        const stored = await api.getLeads()

        if (stored && stored.length > 0) {
          const migrated = stored.map((l, i) => ({
            ...l,
            createdAt: l.createdAt ?? (Date.now() - i * 3_600_000),
          }))
          setLeads(migrated)
          setLoading(false)
          console.info(`[useLeads] ${migrated.length} leads chargés depuis api.getLeads()`)
          return
        }

        // 2. Fallback : JSON initial (premier lancement)
        const data    = await fetchLeads()
        const stamped = data.map((l, i) => ({
          ...l,
          createdAt: l.createdAt ?? (Date.now() - (data.length - i) * 3_600_000),
        }))
        await api.saveLeads(stamped)
        setLeads(stamped)
        setLoading(false)
        console.info(`[useLeads] ${stamped.length} leads chargés depuis leads.json`)

      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }

    load()
  }, [])

  // ── Persistance automatique (via api.js) ──────────────────────────────
  useEffect(() => {
    if (!loading && leads.length > 0) {
      api.saveLeads(leads)   // fire-and-forget — PAS de dispatchLeadsUpdated ici
    }
  }, [leads, loading])

  // ── Sync temps réel (Custom Events + cross-tab + polling 30s) ──────────
  useEffect(() => {
    /**
     * Recharge les leads depuis localStorage et met à jour l'état React
     * seulement si les données ont réellement changé.
     * Gardé contre les syncs concurrentes et le chargement initial.
     */
    async function syncFromStorage() {
      if (isLoadingRef.current) return        // chargement en cours, on saute
      isLoadingRef.current = true
      try {
        const fresh = await api.getLeads()
        if (!fresh) return

        // Comparaison légère : JSON pour détecter tout changement
        const currentSig = JSON.stringify(leadsRef.current)
        const freshSig   = JSON.stringify(fresh)
        if (currentSig !== freshSig) {
          setLeads(fresh)
          console.debug('[useLeads] sync localStorage — données mises à jour')
        }
      } finally {
        isLoadingRef.current = false
      }
    }

    /** Débouce : groupe les événements rapides en une seule synchro (100 ms). */
    function scheduleSync() {
      clearTimeout(syncTimer.current)
      syncTimer.current = setTimeout(syncFromStorage, 100)
    }

    /**
     * 'leadsUpdated' — événements intra-onglet.
     * Déclenché par api.saveLead / deleteLead / archiveLead / updateLead.
     * api.saveLeads (auto-persist) ne dispatche PAS cet événement
     * → évite la boucle : setLeads → saveLeads → event → setLeads → …
     */
    function onLeadsUpdated(e) {
      console.debug('[useLeads] leadsUpdated reçu', e.detail?.action)
      scheduleSync()
    }

    /**
     * 'storage' — synchronisation inter-onglets (native browser API).
     * Se déclenche quand un AUTRE onglet modifie localStorage.
     */
    function onStorageChange(e) {
      if (e.key === null || e.key.startsWith('revspeed')) {
        console.debug('[useLeads] storage cross-tab reçu', e.key)
        scheduleSync()
      }
    }

    window.addEventListener('leadsUpdated', onLeadsUpdated)
    window.addEventListener('storage',      onStorageChange)

    // Polling 30 s — filet de sécurité si un événement est manqué
    const poll = setInterval(syncFromStorage, 30_000)

    return () => {
      window.removeEventListener('leadsUpdated', onLeadsUpdated)
      window.removeEventListener('storage',      onStorageChange)
      clearInterval(poll)
      clearTimeout(syncTimer.current)
    }
  }, [])   // mount/unmount uniquement — pas de dépendances pour éviter les re-abonnements

  // ── Dérivés ────────────────────────────────────────────────────────────
  const leadsByStatus = useMemo(
    () =>
      PIPELINE_ORDER.reduce((acc, status) => {
        acc[status] = leads.filter(l => l.status === status)
        return acc
      }, {}),
    [leads],
  )

  const archivedLeads = useMemo(
    () => leads
      .filter(l => l.status === 'archivé')
      .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)),
    [leads],
  )

  // ── Actions ────────────────────────────────────────────────────────────

  function moveLeadToColumn(leadId, newStatus) {
    const snapshot = leadsRef.current
    const lead     = snapshot.find(l => l.id === leadId)
    if (!lead || lead.status === newStatus) return

    setPast(p    => [...p.slice(-(MAX_HISTORY - 1)), snapshot])
    setFuture([])
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
  }

  function updateLead(leadId, updates) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l))
  }

  function archiveLead(leadId) {
    const snapshot = leadsRef.current
    const lead     = snapshot.find(l => l.id === leadId)
    if (!lead) return

    setPast(p    => [...p.slice(-(MAX_HISTORY - 1)), snapshot])
    setFuture([])
    setLeads(prev =>
      prev.map(l => l.id === leadId
        ? { ...l, status: 'archivé', archivedFrom: l.status, archivedAt: Date.now() }
        : l),
    )
  }

  function restoreLead(leadId) {
    setLeads(prev =>
      prev.map(l => l.id === leadId
        ? { ...l, status: l.archivedFrom ?? 'prospect', archivedFrom: undefined, archivedAt: undefined }
        : l),
    )
  }

  /**
   * Supprime définitivement un lead.
   * Différent d'archiveLead : ne peut pas être annulé depuis les archives.
   */
  function deleteLead(leadId) {
    const snapshot = leadsRef.current
    setPast(p    => [...p.slice(-(MAX_HISTORY - 1)), snapshot])
    setFuture([])
    setLeads(prev => prev.filter(l => l.id !== leadId))
  }

  function undo() {
    if (past.length === 0) return
    const previous = past[past.length - 1]
    setPast(p    => p.slice(0, -1))
    setFuture(f  => [leadsRef.current, ...f.slice(0, MAX_HISTORY - 1)])
    setLeads(previous)
  }

  function redo() {
    if (future.length === 0) return
    const next = future[0]
    setFuture(f => f.slice(1))
    setPast(p   => [...p.slice(-(MAX_HISTORY - 1)), leadsRef.current])
    setLeads(next)
  }

  async function resetLeads() {
    await api.clearAll()
    setPast([])
    setFuture([])
    setImportFilters({})
    setLoading(true)
    setError(null)
    try {
      const data    = await fetchLeads()
      const stamped = data.map((l, i) => ({
        ...l,
        createdAt: Date.now() - (data.length - i) * 3_600_000,
      }))
      await api.saveLeads(stamped)
      setLeads(stamped)
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  /**
   * Recharge les données depuis la source avec les filtres spécifiés.
   * Remplace la vue active dans le localStorage par les seuls leads correspondants.
   *
   * @param {{ status?: string, startDate?: string, endDate?: string }} filters
   */
  async function refreshWithFilters(filters = {}) {
    setLoading(true)
    setError(null)
    try {
      // 1. Charger depuis la source avec filtre statut
      const data = await fetchLeads({ status: filters.status ?? null })

      // 2. Horodater les leads sans createdAt
      const stamped = data.map((l, i) => ({
        ...l,
        createdAt: l.createdAt ?? (Date.now() - (data.length - i) * 3_600_000),
      }))

      // 3. Appliquer filtre de date (post-horodatage)
      const { startDate, endDate } = filters
      const start = startDate ? new Date(startDate).setHours(0,  0,  0,   0) : null
      const end   = endDate   ? new Date(endDate  ).setHours(23, 59, 59, 999) : null

      const filtered = stamped.filter(l => {
        if (start && l.createdAt < start) return false
        if (end   && l.createdAt > end)   return false
        return true
      })

      // 4. Remplacer la vue active dans localStorage
      await api.clearAll()
      await api.saveLeads(filtered)

      // 5. Màj état
      setPast([])
      setFuture([])
      setImportFilters(filters)
      setLeads(filtered)

      console.info(`[useLeads] refreshWithFilters → ${filtered.length} leads chargés`, filters)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function getLeadById(id) {
    return leads.find(l => l.id === id) ?? null
  }

  return {
    leads,
    leadsByStatus,
    archivedLeads,
    totalLeads:   leads.filter(l => l.status !== 'archivé').length,
    loading,
    error,
    canUndo:      past.length > 0,
    canRedo:      future.length > 0,
    historyCount: past.length,
    moveLeadToColumn,
    updateLead,
    archiveLead,
    restoreLead,
    deleteLead,
    undo,
    redo,
    resetLeads,
    refreshWithFilters,
    importFilters,
    getLeadById,
  }
}
