/**
 * ShareDropdown — Partage rapide d'une fiche lead
 * ─────────────────────────────────────────────────────────────────────────────
 * Dropdown léger (pas de modal, pas de backdrop) avec liens directs :
 *   📋 Copier · 💬 WhatsApp · ✈️ Telegram · 📱 SMS · 📧 Email
 *
 * Fermé automatiquement au clic en dehors (useEffect + listener).
 *
 * Props :
 *   lead     {Object}    — lead à partager
 *   onClose  {Function}  — ferme le dropdown
 *   anchor   {string}    — 'top' | 'bottom' (direction d'ouverture, défaut 'top')
 */

import { useEffect, useRef } from 'react'
import { STATUS_LABELS } from '../../constants/statuses'

// ── Génération du message ──────────────────────────────────────────────────

export function buildShareText(lead) {
  const rdv = lead.prochainRdv
    ? new Date(lead.prochainRdv).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
    : null

  return [
    `🚨 Rappel Client Prioritaire`,
    '',
    `Client       : ${lead.nom        || 'Non renseigné'}`,
    `Tél          : ${lead.tel        || 'Non renseigné'}`,
    lead.email       ? `Email        : ${lead.email}`       : null,
    `Statut       : ${STATUS_LABELS[lead.status] ?? lead.status ?? '—'}`,
    lead.priorité    ? `Priorité     : ${lead.priorité}`   : null,
    lead.vendeur     ? `Vendeur      : ${lead.vendeur}`    : null,
    rdv              ? `Prochain RDV : ${rdv}`             : null,
    lead.qualification
      ? `\nBesoin :\n${lead.qualification}`
      : 'Besoin : À qualifier',
    lead.notes
      ? `\nNotes :\n${lead.notes}`
      : null,
    '',
    'Merci de traiter ce dossier dès que possible.',
  ].filter(l => l !== null).join('\n')
}

// ── Composant ──────────────────────────────────────────────────────────────

export default function ShareDropdown({ lead, onClose, anchor = 'top' }) {
  const ref   = useRef(null)
  const text  = buildShareText(lead)
  const enc  = encodeURIComponent(text)
  const subj = encodeURIComponent(`Rappel Client — ${lead.nom || 'Sans nom'}`)

  // Fermeture au clic extérieur
  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 50)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  const posClass = anchor === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1'

  // Destinataire libre dans toutes les apps — pas de numéro/email pré-rempli
  const actions = [
    {
      key:   'copy',
      label: 'Copier le message',
      icon:  '📋',
      href:  null,
      onClick() {
        navigator.clipboard.writeText(text).catch(() => {
          const el = document.createElement('textarea')
          el.value = text
          document.body.appendChild(el)
          el.select()
          document.execCommand('copy')
          document.body.removeChild(el)
        })
        onClose()
      },
    },
    {
      key:   'whatsapp',
      label: 'WhatsApp',
      icon:  '💬',
      // Sans numéro : ouvre WhatsApp, tu choisis le contact
      href:  `https://wa.me/?text=${enc}`,
    },
    {
      key:   'telegram',
      label: 'Telegram',
      icon:  '✈️',
      href:  `https://t.me/share/url?text=${enc}`,
    },
    {
      key:   'sms',
      label: 'SMS',
      icon:  '📱',
      // Sans numéro : ouvre l’app SMS, tu choisis le destinataire
      href:  `sms:?body=${enc}`,
    },
    {
      key:   'email',
      label: 'Email',
      icon:  '📧',
      // Sans destinataire : ouvre le client mail, tu choisis
      href:  `mailto:?subject=${subj}&body=${enc}`,
    },
  ]

  return (
    <div
      ref={ref}
      className={`absolute right-0 ${posClass} z-50 bg-white rounded-xl shadow-xl border border-slate-200 py-1 min-w-[160px]`}
      onClick={e => e.stopPropagation()}
    >
      {/* En-tête mini */}
      <div className="px-3 py-1.5 border-b border-slate-100">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Partager</p>
        <p className="text-xs font-semibold text-slate-700 truncate">{lead.nom || 'Sans nom'}</p>
      </div>

      {/* Actions */}
      {actions.map(a =>
        a.href ? (
          <a
            key={a.key}
            href={a.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full"
          >
            <span className="text-base w-5 text-center shrink-0">{a.icon}</span>
            {a.label}
          </a>
        ) : (
          <button
            key={a.key}
            onClick={a.onClick}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full text-left"
          >
            <span className="text-base w-5 text-center shrink-0">{a.icon}</span>
            {a.label}
          </button>
        )
      )}
    </div>
  )
}
