import { useEffect, useState } from 'react'
import { STATUS_LABELS, PIPELINE_ORDER, PRIORITIES, PRIORITY_COLORS } from '../../constants/statuses'
import { VENDEURS, ISSUES_APPEL } from '../../constants/vendeurs'
import { getInitials } from '../../utils/formatters'

/**
 * LeadModal — Fiche Client Pro (panneau droit slide-in).
 *
 * Sections :
 *   1. Header         — Avatar, nom, badges statut/priorité
 *   2. Qualification  — Zone de texte libre
 *   3. Contact        — Nom, Tél, Email, CP
 *   4. Vendeur        — Dropdown
 *   5. Actions        — Appeler · SMS · Email
 *   6. Issue appel    — Dropdown + Prochain RDV
 *   7. Notes          — Textarea
 *
 * Props:
 *   lead     {Object}    — lead à éditer (incluant tous les champs Pro)
 *   onSave   {Function}  — (leadId, updates) => void
 *   onClose  {Function}  — () => void
 */
export default function LeadModal({ lead, onSave, onArchive, onClose }) {
  const [form, setForm] = useState(buildForm(lead))
  const [saved, setSaved] = useState(false)

  // ── Sync si lead change ────────────────────────────────────────────────
  useEffect(() => {
    setForm(buildForm(lead))
    setSaved(false)
  }, [lead.id])

  // ── Escape key ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setSaved(false)
  }

  function handleSave() {
    onSave(lead.id, form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const initials    = getInitials(form.nom || lead.nom)
  const rawTel      = (form.tel || '').replace(/\D/g, '')
  const rawEmail    = form.email || ''
  const intlTel     = toIntlPhone(rawTel)
  const templateMsg = buildTemplateMessage(form.nom || lead.nom)
  const smsLink     = rawTel   ? `sms:${rawTel}?body=${encodeURIComponent(templateMsg)}`                         : undefined
  const waLink      = intlTel  ? `https://wa.me/${intlTel}?text=${encodeURIComponent(templateMsg)}`              : undefined
  const emailLink   = rawEmail ? `mailto:${rawEmail}?subject=${encodeURIComponent('Votre projet Moto – Triumph Moto Livry-Gargan')}&body=${encodeURIComponent(templateMsg)}` : undefined

  return (
    <div className="fixed inset-0 z-50 flex">

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* ── Panneau droit ── */}
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-[420px] bg-white border-l border-slate-200 shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)' }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ─── HEADER ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-200 flex items-center justify-center text-sm font-bold text-blue-700">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 truncate">{form.nom || lead.nom}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <StatusBadge status={form.status} />
                <PriorityBadge priorité={form.priorité} />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-2"
          >
            ✕
          </button>
        </div>

        {/* ─── BODY (scrollable) ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── 1. Qualification du besoin ── */}
          <Section>
            <SectionTitle color="#7d2ae8" icon="✅">QUALIFICATION DU BESOIN</SectionTitle>
            <textarea
              name="qualification"
              value={form.qualification}
              onChange={handleChange}
              rows={4}
              placeholder={"Recherche un modèle 2023 ou 2024\nBudget cible : ~10k€\nPossibilité de reprise…"}
              className={textareaClass}
            />
          </Section>

          {/* ── 2. Informations de contact ── */}
          <Section>
            <SectionTitle icon="👤">CONTACT</SectionTitle>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="col-span-2">
                <FieldLabel>Nom complet</FieldLabel>
                <input type="text" name="nom" value={form.nom} onChange={handleChange} className={inputClass} placeholder="Sophie Marchand" />
              </div>
              <div>
                <FieldLabel>Téléphone</FieldLabel>
                <input type="tel" name="tel" value={form.tel} onChange={handleChange} className={inputClass} placeholder="06 12 34 56 78" />
              </div>
              <div>
                <FieldLabel>Code postal</FieldLabel>
                <input type="text" name="codePostal" value={form.codePostal} onChange={handleChange} className={inputClass} placeholder="75001" />
              </div>
              <div className="col-span-2">
                <FieldLabel>Email</FieldLabel>
                <input type="email" name="email" value={form.email} onChange={handleChange} className={inputClass} placeholder="contact@exemple.fr" />
              </div>
            </div>
          </Section>

          {/* ── 3. Vendeur en charge ── */}
          <Section>
            <SectionTitle icon="🧑‍💼">VENDEUR EN CHARGE :</SectionTitle>
            <select name="vendeur" value={form.vendeur} onChange={handleChange} className={selectClass}>
              <option value="">— Choisir un vendeur —</option>
              {VENDEURS.filter(Boolean).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </Section>

          {/* ── 4. Actions rapides ── */}
          <Section>
            <SectionTitle icon="⚡">ACTIONS RAPIDES</SectionTitle>

            {/* Appeler — bouton principal pleine largeur */}
            <a
              href={rawTel ? `tel:${rawTel}` : undefined}
              className={`
                flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl
                text-white font-bold text-sm tracking-wide uppercase
                transition-opacity duration-150
                ${rawTel ? 'hover:opacity-90 active:scale-95' : 'opacity-50 cursor-not-allowed pointer-events-none'}
              `}
              style={{ backgroundColor: '#15803d' }}
            >
              <PhoneIcon />
              APPELER
            </a>

            {/* SMS + WhatsApp + Email */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              <a
                href={smsLink}
                className={`
                  flex flex-col items-center justify-center gap-1 py-3 rounded-2xl
                  text-white font-bold text-xs uppercase tracking-wide
                  transition-opacity duration-150
                  ${rawTel ? 'hover:opacity-90 active:scale-95' : 'opacity-50 cursor-not-allowed pointer-events-none'}
                `}
                style={{ backgroundColor: '#7d2ae8' }}
                title={rawTel ? 'Envoyer SMS avec message pré-enregistré' : 'Numéro manquant'}
              >
                <SmsIcon />
                SMS
              </a>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`
                  flex flex-col items-center justify-center gap-1 py-3 rounded-2xl
                  text-white font-bold text-xs uppercase tracking-wide
                  transition-opacity duration-150
                  ${intlTel ? 'hover:opacity-90 active:scale-95' : 'opacity-50 cursor-not-allowed pointer-events-none'}
                `}
                style={{ backgroundColor: '#25D366' }}
                title={intlTel ? 'Envoyer WhatsApp avec message pré-enregistré' : 'Numéro manquant'}
              >
                <WhatsAppIcon />
                WA
              </a>
              <a
                href={emailLink}
                className={`
                  flex flex-col items-center justify-center gap-1 py-3 rounded-2xl
                  bg-white border border-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wide
                  transition-all duration-150
                  ${rawEmail ? 'hover:bg-slate-50 active:scale-95' : 'opacity-50 cursor-not-allowed pointer-events-none'}
                `}
                title={rawEmail ? 'Envoyer Email avec message pré-enregistré' : 'Email manquant'}
              >
                <EmailIcon />
                EMAIL
              </a>
            </div>

            {/* Aperçu du message pré-enregistré */}
            <MessagePreview message={templateMsg} />
          </Section>

          {/* ── 5. Issue de l'appel ── */}
          <Section>
            <SectionTitle icon="📋">ISSUE DE L'APPEL :</SectionTitle>
            <select name="issueAppel" value={form.issueAppel} onChange={handleChange} className={selectClass}>
              <option value="">Choisir le statut actuel…</option>
              {ISSUES_APPEL.filter(Boolean).map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </Section>

          {/* ── 6. Rendez-vous (structuré) ── */}
          <Section>
            <SectionTitle icon="📅">RENDEZ-VOUS :</SectionTitle>

            {/* Date + Heure + Durée */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div>
                <FieldLabel>Date</FieldLabel>
                <input
                  type="date"
                  name="rdvDate"
                  value={form.rdvDate}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel>Heure</FieldLabel>
                <input
                  type="time"
                  name="rdvTime"
                  value={form.rdvTime}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel>Durée</FieldLabel>
                <select
                  name="rdvDuration"
                  value={form.rdvDuration}
                  onChange={handleChange}
                  className={selectClass}
                >
                  <option value="">—</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1h</option>
                  <option value="90">1h30</option>
                </select>
              </div>
            </div>

            {/* Type de RDV */}
            <div className="mt-2">
              <FieldLabel>Type de RDV</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'Physique',      icon: '🤝', desc: 'En concession' },
                  { value: 'Téléphonique',  icon: '📞', desc: 'Par téléphone' },
                ].map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => { setForm(prev => ({ ...prev, rdvType: t.value })); setSaved(false) }}
                    className={`flex flex-col items-center py-2.5 px-2 rounded-xl border-2 text-xs font-bold transition-all duration-150 ${
                      form.rdvType === t.value
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-lg leading-none mb-0.5">{t.icon}</span>
                    <span className="font-bold">{t.value}</span>
                    <span className={`text-[9px] font-medium mt-0.5 ${
                      form.rdvType === t.value ? 'opacity-80' : 'text-slate-400'
                    }`}>{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Résumé visuel si date remplie */}
            {form.rdvDate && (
              <div className={`mt-3 px-3 py-2.5 rounded-xl border flex items-center gap-2 ${
                form.rdvType === 'Téléphonique'
                  ? 'bg-blue-50 border-blue-100'
                  : form.rdvType === 'Physique'
                    ? 'bg-emerald-50 border-emerald-100'
                    : 'bg-slate-50 border-slate-100'
              }`}>
                <span className="text-lg shrink-0">
                  {form.rdvType === 'Téléphonique' ? '📞' : form.rdvType === 'Physique' ? '🤝' : '📅'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black ${
                    form.rdvType === 'Téléphonique' ? 'text-blue-700'
                    : form.rdvType === 'Physique' ? 'text-emerald-700'
                    : 'text-slate-700'
                  }`}>
                    {new Date(form.rdvDate + 'T00:00').toLocaleDateString('fr-FR', {
                      weekday: 'long', day: '2-digit', month: 'long'
                    })}
                  </p>
                  <p className="text-[10px] font-medium text-slate-500 mt-0.5 flex items-center gap-2">
                    {form.rdvTime && <span>🕒 {form.rdvTime}</span>}
                    {form.rdvDuration && <span>· {form.rdvDuration} min</span>}
                    {form.rdvType && <span>· {form.rdvType}</span>}
                  </p>
                </div>
              </div>
            )}
          </Section>


          {/* ── 6b. Envoi Rapide (visible si RDV planifié) ── */}
          {form.rdvDate && form.rdvTime && (
            <Section>
              <SectionTitle icon="⚡" color="#f59e0b">ENVOI RAPIDE</SectionTitle>
              <EnvoiRapide form={form} />
            </Section>
          )}

                    {/* ── 7. Priorité / Urgence ── */}
          <Section>
            <SectionTitle icon="🔥">PRIORITÉ / URGENCE :</SectionTitle>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {[
                { value: 'haute',   label: '🔴 Haute',   desc: 'Urgent',  active: 'bg-red-600 text-white border-red-600 shadow-md' },
                { value: 'moyenne', label: '🟡 Moyenne', desc: 'Normal',  active: 'bg-amber-500 text-white border-amber-500 shadow-md' },
                { value: 'basse',   label: '⚪ Basse',   desc: 'En veille', active: 'bg-slate-500 text-white border-slate-500 shadow-md' },
              ].map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => { setForm(prev => ({ ...prev, priorité: p.value })); setSaved(false) }}
                  className={`flex flex-col items-center py-2.5 px-2 rounded-xl border-2 text-xs font-bold transition-all duration-150 ${
                    form.priorité === p.value
                      ? p.active
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-base leading-none mb-0.5">{p.label.split(' ')[0]}</span>
                  <span className="font-bold">{p.label.split(' ').slice(1).join(' ')}</span>
                  <span className={`text-[9px] font-medium mt-0.5 ${
                    form.priorité === p.value ? 'opacity-80' : 'text-slate-400'
                  }`}>{p.desc}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* ── 8. Statut pipeline ── */}
          <Section>
            <SectionTitle icon="📊">ÉTAPE DU PIPELINE :</SectionTitle>
            <select name="status" value={form.status} onChange={handleChange} className={selectClass}>
              {PIPELINE_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Section>

          {/* ── 8. Notes complémentaires ── */}
          <Section border={false}>
            <SectionTitle icon="📝">NOTES COMPLÉMENTAIRES :</SectionTitle>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={5}
              placeholder="Suite à l'appel, le client préfère être rappelé en fin de journée…"
              className={textareaClass}
            />
          </Section>

        </div>

        {/* ─── FOOTER ──────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-slate-100 shrink-0 bg-white space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95"
              style={{ backgroundColor: saved ? '#059669' : '#3b82f6' }}
            >
              {saved ? '✓ Sauvegardé' : 'Sauvegarder'}
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-150"
            >
              Fermer
            </button>
          </div>
          <button
            onClick={() => onArchive?.(lead.id)}
            title="Déplacer vers les Archives — récupérable depuis l'onglet Archives"
            className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors duration-150 flex items-center justify-center gap-2"
          >
            📦 Archiver ce lead
          </button>
        </div>

      </aside>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>

    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Formate un numéro FR en international pour WhatsApp (ex: 0612... → 33612...) */
function toIntlPhone(rawTel) {
  if (!rawTel) return ''
  // Déjà en +33
  if (rawTel.startsWith('33') && rawTel.length >= 11) return rawTel
  // Format 0XXXXXXXXX → 33XXXXXXXXX
  if (rawTel.startsWith('0') && rawTel.length === 10) return '33' + rawTel.slice(1)
  return rawTel
}

/** Construit le message template avec le prénom du client */
function buildTemplateMessage(nom) {
  const prenom = nom ? nom.trim().split(/\s+/)[0] : ''
  return [
    `Bonjour ${prenom},`,
    '',
    "C'est Max de Triumph Moto Livry-Gargan.",
    '',
    "J'ai essayé de vous joindre \u00e0 l'instant sans succ\u00e8s.",
    '',
    'Je fais suite \u00e0 votre demande pour votre projet Moto.',
    '',
    'Quand seriez-vous joignable ? Bonne journée !',
  ].join('\n')
}


// ── Helpers RDV calendrier ────────────────────────────────────────────────────

/** Calcule start/end formatés pour Google (YYYYMMDDTHHMMSS) et Outlook (ISO) */
function buildRdvTimes(form) {
  const [year, month, day] = form.rdvDate.split('-').map(Number)
  const [hour, min]        = form.rdvTime.split(':').map(Number)
  const durationMin        = parseInt(form.rdvDuration || '60', 10)
  const pad = n => String(n).padStart(2, '0')

  const totalEndMin = hour * 60 + min + durationMin
  const endHour     = Math.floor(totalEndMin / 60) % 24
  const endMin      = totalEndMin % 60
  const endDay      = day + (Math.floor(totalEndMin / 60) >= 24 ? 1 : 0)

  return {
    googleStart:  `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(min)}00`,
    googleEnd:    `${year}${pad(month)}${pad(endDay)}T${pad(endHour)}${pad(endMin)}00`,
    outlookStart: `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(min)}:00`,
    outlookEnd:   `${year}-${pad(month)}-${pad(endDay)}T${pad(endHour)}:${pad(endMin)}:00`,
  }
}

/** Lien natif Google Agenda */
function getGoogleCalendarLink(form) {
  if (!form.rdvDate || !form.rdvTime) return ''
  const { googleStart, googleEnd } = buildRdvTimes(form)
  const nom = form.nom || 'Client'
  const text    = encodeURIComponent(`RDV RevSpeed x ${nom}`)
  const details = encodeURIComponent(`RDV ${form.rdvType || ''} avec ${nom}\nTriumph Moto Livry-Gargan`)
  const loc     = encodeURIComponent('Triumph Moto Livry-Gargan')
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${googleStart}/${googleEnd}&details=${details}&location=${loc}`
}

/** Lien natif Outlook / Apple Calendar */
function getOutlookCalendarLink(form) {
  if (!form.rdvDate || !form.rdvTime) return ''
  const { outlookStart, outlookEnd } = buildRdvTimes(form)
  const nom     = form.nom || 'Client'
  const subject = encodeURIComponent(`RDV RevSpeed x ${nom}`)
  const body    = encodeURIComponent(`RDV ${form.rdvType || ''} avec ${nom}\nTriumph Moto Livry-Gargan`)
  const loc     = encodeURIComponent('Triumph Moto Livry-Gargan')
  return `https://outlook.office.com/calendar/0/deeplink/compose?subject=${subject}&startdt=${outlookStart}&enddt=${outlookEnd}&body=${body}&location=${loc}`
}

/** Message de partage avec les deux liens agenda */
function buildRdvShareMessage(form) {
  const prenom  = form.nom ? form.nom.trim().split(/\s+/)[0] : ''
  const dateStr = form.rdvDate
    ? new Date(form.rdvDate + 'T00:00').toLocaleDateString('fr-FR', {
        weekday: 'long', day: '2-digit', month: 'long',
      })
    : ''
  const googleLink  = getGoogleCalendarLink(form)
  const outlookLink = getOutlookCalendarLink(form)

  // Format compact et lisible pour SMS/WA/Email
  return [
    `Bonjour ${prenom}, notre RDV est confirmé le ${dateStr} à ${form.rdvTime}.`,
    '',
    'Vous pouvez l\'ajouter à votre agenda ici :',
    `Google : ${googleLink}`,
    `Outlook/Apple : ${outlookLink}`,
  ].join('\n')
}

function buildForm(lead) {
  // Rétrocompat : si seul prochainRdv (ancien format datetime-local) est présent,
  // on en extrait rdvDate et rdvTime pour le nouveau formulaire.
  let rdvDate = lead.rdvDate ?? ''
  let rdvTime = lead.rdvTime ?? ''
  if (!rdvDate && lead.prochainRdv) {
    const dt = new Date(lead.prochainRdv)
    if (!isNaN(dt.getTime())) {
      rdvDate = dt.toISOString().split('T')[0]
      rdvTime = dt.toTimeString().slice(0, 5)
    }
  }

  return {
    nom:           lead.nom           ?? '',
    tel:           lead.tel           ?? '',
    email:         lead.email         ?? '',
    codePostal:    lead.codePostal    ?? '',
    status:        lead.status        ?? 'prospect',
    priorité:      lead.priorité      ?? 'moyenne',
    qualification: lead.qualification ?? '',
    vendeur:       lead.vendeur       ?? '',
    issueAppel:    lead.issueAppel    ?? '',
    // Nouveaux champs RDV structurés
    rdvDate,
    rdvTime,
    rdvType:       lead.rdvType       ?? '',
    rdvDuration:   lead.rdvDuration   ?? '',
    // Conservé pour rétrocompatibilité
    prochainRdv:   lead.prochainRdv   ?? '',
    notes:         lead.notes         ?? '',
  }
}


// ── EnvoiRapide — module d'envoi d'invitation calendrier ─────────────────────

function EnvoiRapide({ form }) {
  const [copied, setCopied] = useState(false)

  const googleLink  = getGoogleCalendarLink(form)
  const outlookLink = getOutlookCalendarLink(form)
  const message     = buildRdvShareMessage(form)
  const rawTel      = (form.tel || '').replace(/\D/g, '')
  const intlTel     = toIntlPhone(rawTel)

  // Liens d'envoi — WA avec numéro si dispo, sinon sans
  const waLink    = intlTel
    ? `https://wa.me/${intlTel}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`
  // SMS : avec numéro si dispo, sinon sms: vide pour choisir le destinataire
  const smsLink   = rawTel
    ? `sms:${rawTel}?&body=${encodeURIComponent(message)}`
    : `sms:?&body=${encodeURIComponent(message)}`
  const emailLink = `mailto:${form.email || ''}?subject=${encodeURIComponent('Confirmation RDV RevSpeed')}&body=${encodeURIComponent(message)}`

  function handleCopy() {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="space-y-3 mt-1">

      {/* ── Ajouter au calendrier ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
          📅 Ajouter au calendrier
        </p>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={googleLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[11px] font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: '#4285f4' }}
          >
            <GoogleCalIcon />
            Google Agenda
          </a>
          <a
            href={outlookLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[11px] font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: '#0078d4' }}
          >
            <OutlookIcon />
            Outlook / Apple
          </a>
        </div>
        {/* Badge universel */}
        <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
          <span>🔗</span>
          <span className="font-semibold text-blue-500">Invitation Universelle</span>
          <span>· Compatible Google / Outlook / Apple</span>
        </p>
      </div>

      {/* ── Message à envoyer ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
          💬 Message à envoyer
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-600 leading-relaxed font-sans break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
          {message}
        </div>
      </div>

      {/* ── 4 boutons d'envoi côte à côte ── */}
      <div className="grid grid-cols-4 gap-1.5">

        {/* WhatsApp */}
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-bold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: '#25D366' }}
          title="Envoyer via WhatsApp"
        >
          <BtnWaIcon />
          WhatsApp
        </a>

        {/* Email */}
        <a
          href={emailLink}
          className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-bold bg-blue-500 text-white transition-all hover:opacity-90 active:scale-95"
          title="Envoyer par email"
        >
          <BtnEmailIcon />
          Email
        </a>

        {/* SMS */}
        <a
          href={smsLink}
          className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-bold bg-violet-600 text-white transition-all hover:opacity-90 active:scale-95"
          title="Envoyer par SMS"
        >
          <BtnSmsIcon />
          SMS
        </a>

        {/* Copier */}
        <button
          type="button"
          onClick={handleCopy}
          className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 ${
            copied ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
          }`}
          title="Copier le message"
        >
          <BtnCopyIcon copied={copied} />
          {copied ? 'Copié !' : 'Copier'}
        </button>

      </div>
    </div>
  )
}

// ── Icônes boutons d'envoi ────────────────────────────────────────────────────

function BtnWaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

function BtnEmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}

function BtnSmsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      <line x1="9" y1="10" x2="9" y2="10" strokeWidth="3"/>
      <line x1="12" y1="10" x2="12" y2="10" strokeWidth="3"/>
      <line x1="15" y1="10" x2="15" y2="10" strokeWidth="3"/>
    </svg>
  )
}

function BtnCopyIcon({ copied }) {
  if (copied) return <span className="text-base leading-none">✓</span>
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  )
}

// ── Icônes mini pour les boutons calendrier ────────────────────────────────────

function GoogleCalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.95 }}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 1.97c-.392-.686-.93-1.188-1.6-1.49-.67-.3-1.38-.45-2.124-.45-1.38 0-2.54.49-3.48 1.47-.94.98-1.41 2.18-1.41 3.59 0 1.41.47 2.61 1.41 3.59.94.98 2.1 1.47 3.48 1.47.87 0 1.62-.2 2.25-.6.63-.4 1.1-.96 1.41-1.68H12v-2.64h6.5c.07.36.1.72.1 1.08 0 1.98-.66 3.6-1.98 4.86C15.3 20.86 13.78 21.5 12 21.5c-2.62 0-4.84-.92-6.66-2.76C3.52 16.9 2.6 14.68 2.6 12c0-2.68.92-4.9 2.74-6.66C7.16 3.58 9.38 2.5 12 2.5c2.04 0 3.84.57 5.4 1.7l-1.838 1.838V8.248z"/>
    </svg>
  )
}

function OutlookIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.95 }}>
      <path d="M24 7.387v13.276A1.34 1.34 0 0122.663 22H8.337A1.34 1.34 0 017 20.663V18h10.042a1.96 1.96 0 001.958-1.958V8h1.663A1.34 1.34 0 0122 9.337v.013L24 7.387zM16 2H1.337A1.34 1.34 0 000 3.337v13.326A1.34 1.34 0 001.337 18H16a1 1 0 001-1V3a1 1 0 00-1-1zM8.5 13.5c-1.93 0-3.5-1.57-3.5-3.5S6.57 6.5 8.5 6.5 12 8.07 12 10s-1.57 3.5-3.5 3.5zm0-5.75c-1.24 0-2.25 1.01-2.25 2.25S7.26 12.25 8.5 12.25s2.25-1.01 2.25-2.25S9.74 7.75 8.5 7.75z"/>
    </svg>
  )
}

// ── Sous-composants UI ────────────────────────────────────────────────────────

function Section({ children, border = true }) {
  return (
    <div className={`px-6 py-4 ${border ? 'border-b border-slate-100' : ''}`}>
      {children}
    </div>
  )
}

function SectionTitle({ icon, color, children }) {
  return (
    <p
      className="text-[11px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5"
      style={{ color: color ?? '#64748b' }}
    >
      <span>{icon}</span>
      {children}
    </p>
  )
}

function FieldLabel({ children }) {
  return <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{children}</p>
}

function StatusBadge({ status }) {
  const labels = { prospect: 'Nouveau lead', contact: 'En cours', devis: 'Message + mail', 'négociation': 'En attente', 'gagné': 'RDV OK', perdu: 'Perdu' }
  return <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{labels[status] ?? status}</span>
}

function PriorityBadge({ priorité }) {
  const cls = PRIORITY_COLORS[priorité] ?? 'bg-slate-100 text-slate-500 border border-slate-200'
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls}`}>{priorité}</span>
}

// ── Icônes SVG inline ────────────────────────────────────────────────────────

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.07 2.18 2 2 0 012 .07h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  )
}

function SmsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

/** Aperçu repliable du message pré-enregistré */
function MessagePreview({ message }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <span>💬</span> Message pré-enregistré
        </span>
        <span className="text-[10px] text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pt-2 pb-3 bg-white">
          <pre className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-sans">{message}</pre>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-2 text-[10px] font-semibold text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-1"
          >
            {copied ? '✓ Copié !' : '📋 Copier le message'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Classes Tailwind réutilisables ────────────────────────────────────────────

const inputClass = `
  w-full px-3 py-2.5 text-sm
  bg-slate-50 border border-slate-200 rounded-xl
  text-slate-800 placeholder-slate-400
  focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400
  transition-all duration-150
`

const selectClass = `
  w-full px-3 py-2.5 text-sm mt-1
  bg-white border border-slate-200 rounded-xl
  text-slate-700
  focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400
  transition-all duration-150 appearance-none cursor-pointer
`

const textareaClass = `
  w-full px-3 py-2.5 text-sm
  bg-slate-50 border border-slate-200 rounded-xl
  text-slate-700 placeholder-slate-400
  focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400
  transition-all duration-150 resize-none leading-relaxed
`
