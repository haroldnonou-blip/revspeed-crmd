import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core'
import { useState } from 'react'
import KanbanColumn from './KanbanColumn'
import KanbanCard from './KanbanCard'
import LeadModal from './LeadModal'
import { PIPELINE_ORDER, STATUS_LABELS } from '../../constants/statuses'

function hybridCollision(args) {
  const hit = pointerWithin(args)
  return hit.length > 0 ? hit : rectIntersection(args)
}

/**
 * KanbanBoard — Orchestrateur DnD + modale d'édition.
 *
 * Props:
 *   leadsByStatus     {Object}    — leads groupés par statut
 *   moveLeadToColumn  {Function}  — (leadId, newStatus) => void
 *   updateLead        {Function}  — (leadId, updates) => void
 *   getLeadById       {Function}  — (id) => lead | null
 */
export default function KanbanBoard({ leadsByStatus, moveLeadToColumn, updateLead, archiveLead, getLeadById }) {
  const [activeLeadId, setActiveLeadId] = useState(null)
  const [selectedLead, setSelectedLead] = useState(null)   // modale

  const activeLead = activeLeadId ? getLeadById(activeLeadId) : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  // ── DnD handlers ────────────────────────────────────────────────────────
  function handleDragStart({ active }) {
    setActiveLeadId(active.id)
    document.body.style.cursor = 'grabbing'
  }

  function handleDragEnd({ active, over }) {
    document.body.style.cursor = ''
    setActiveLeadId(null)
    if (!over) return
    const lead = getLeadById(active.id)
    if (lead && lead.status !== over.id) {
      moveLeadToColumn(active.id, over.id)
    }
  }

  function handleDragCancel() {
    document.body.style.cursor = ''
    setActiveLeadId(null)
  }

  // ── Modale handlers ──────────────────────────────────────────────────────

  // Ouvre la modale — appelé depuis KanbanCard (clic simple)
  // Si un drag vient de se terminer, on ignore le clic
  function handleCardClick(lead) {
    if (!activeLeadId) setSelectedLead(lead)
  }

  function handleModalSave(leadId, updates) {
    updateLead(leadId, updates)
    setSelectedLead((prev) => prev ? { ...prev, ...updates } : null)
  }

  function handleArchive(leadId) {
    archiveLead(leadId)
    setSelectedLead(null)    // ferme la modale immédiatement
  }

  function handleModalClose() {
    setSelectedLead(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={hybridCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
          {PIPELINE_ORDER.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              label={STATUS_LABELS[status]}
              leads={leadsByStatus[status] ?? []}
              isDragActive={!!activeLeadId}
              onCardClick={handleCardClick}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeLead ? <KanbanCard lead={activeLead} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Modale d'édition — montée hors du DndContext pour éviter les conflits d'événements */}
      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onSave={handleModalSave}
          onArchive={handleArchive}
          onClose={handleModalClose}
        />
      )}
    </>
  )
}
