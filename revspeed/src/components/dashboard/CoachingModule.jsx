/**
 * CoachingModule — Modal de coaching vendeur / partage fiche prioritaire
 * ─────────────────────────────────────────────────────────────────────────────
 * Génère un message contextuel formaté et le partage via :
 *   - navigator.share (API native mobile/desktop)
 *   - Fallback : copie dans le presse-papier
 *
 * Props :
 *   lead         {Object}    — lead concerné
 *   vendeurName  {string}    — nom du vendeur ciblé (optionnel)
 *   onClose      {Function}  — ferme la modale
 */

import { useState } from 'react'
import { STATUS_LABELS } from '../../constants/statuses'

export default function CoachingModule({ lead, vendeurName, onClose }) {
  const [copied, setCopied] = useState(false)

  // ── Message formaté (adapté au modèle revspeed) ──────────────────────────
  const rdv = lead.prochainRdv
    ? new Date(lead.prochainRdv).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
    : null

  const message = [
    '🚨 Rappel Client Prioritaire',
    '',
    `Client       : ${lead.nom        || 'Non renseigné'}`,
    `Tél          : ${lead.tel        || 'Non renseigné'}`,
    lead.email     ? `Email        : ${lead.email}`        : null,
    lead.codePostal? `Code postal  : ${lead.codePostal}`  : null,
    `Statut       : ${STATUS_LABELS[lead.status] ?? lead.status ?? '—'}`,
    lead.priorité  ? `Priorité     : ${lead.priorité}`    : null,
    rdv            ? `Prochain RDV : ${rdv}`              : null,
    vendeurName    ? `Vendeur      : ${vendeurName}`      : null,
    '',
    lead.qualification
      ? `Besoin :\n${lead.qualification}`
      : 'Besoin : À qualifier',
    lead.notes
      ? `\nNotes :\n${lead.notes}`
      : null,
    '',
    'Merci de traiter ce dossier dès que possible.',
  ].filter(l => l !== null).join('\n')

  // ── Actions ───────────────────────────────────────────────────────────────

  function copyToClipboard() {
    navigator.clipboard.writeText(message)
      .then(flashCopied)
      .catch(() => {
        // Fallback textarea si API clipboard bloquée
        const el = document.createElement('textarea')
        el.value = message
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        flashCopied()
      })
  }

  function flashCopied() {
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  function shareNative() {
    if (navigator.share) {
      navigator.share({
        title: 'Action Requise — Rappel Client',
        text:  message,
      }).catch(err => {
        // L'utilisateur a annulé ou l'API a échoué → fallback clipboard
        if (err.name !== 'AbortError') copyToClipboard()
      })
    } else {
      // Navigateur sans Web Share API → clipboard
      copyToClipboard()
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-black text-lg leading-tight">🎯 Coacher le vendeur</p>
            <p className="text-orange-200 text-xs mt-0.5">
              {lead.nom || 'Client'}{vendeurName ? ` → ${vendeurName.split(' ')[0]}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-orange-200 hover:text-white text-2xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Message preview */}
        <div className="p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Message généré
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto">
            {message}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                copied
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
            >
              {copied ? '✓ Copié !' : '📋 Copier'}
            </button>
            <button
              onClick={shareNative}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm bg-brand-600 hover:bg-blue-700 text-white transition-colors shadow-sm hover:shadow-md"
            >
              📤 Partager partout
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
