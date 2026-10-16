/**
 * RevSpeed — SettingsView
 * Back office complet : vendeurs, templates, concessionnaire, alertes, sécurité.
 */

import { useState, useEffect } from 'react'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../../hooks/useSettings'
import { api } from '../../services/api'

// ── Composants UI réutilisables ───────────────────────────────────────────────

function SectionCard({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function Label({ children }) {
  return <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{children}</label>
}

function Input({ value, onChange, placeholder, type = 'text', ...props }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all"
      {...props}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all resize-none font-mono"
    />
  )
}

function Tag({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-xl border border-blue-100">
      {label}
      <button
        onClick={onRemove}
        className="text-blue-400 hover:text-red-500 transition-colors text-xs font-bold leading-none"
        title="Supprimer"
      >
        ✕
      </button>
    </span>
  )
}

function SaveBanner({ saved }) {
  if (!saved) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-semibold px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-bounce-once">
      ✓ Paramètres enregistrés
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function SettingsView() {
  const [settings, setSettings] = useState(() => loadSettings())
  const [saved,    setSaved]    = useState(false)
  const [newVendeur, setNewVendeur] = useState('')

  // Sync GAS
  const [syncState, setSyncState] = useState('idle') // 'idle' | 'loading' | 'ok' | 'error'
  const [syncMsg,   setSyncMsg]   = useState('')

  async function handleSyncToGAS() {
    setSyncState('loading')
    setSyncMsg('')
    try {
      const raw = localStorage.getItem('revspeed_v2')
      const leads = raw ? JSON.parse(raw) : []
      if (!leads.length) {
        setSyncState('error')
        setSyncMsg('Aucune donnée trouvée dans ce navigateur.')
        return
      }
      await api.saveLeads(leads)
      setSyncState('ok')
      setSyncMsg(`✓ ${leads.length} leads synchronisés vers Google Sheets`)
    } catch (e) {
      setSyncState('error')
      setSyncMsg('Erreur : ' + e.message)
    }
    setTimeout(() => setSyncState('idle'), 5000)
  }

  // SMS templates
  const [newSMS, setNewSMS] = useState('')
  // Email templates
  const [newEmailSujet, setNewEmailSujet] = useState('')
  const [newEmailCorps, setNewEmailCorps] = useState('')
  const [editEmailIdx, setEditEmailIdx] = useState(null)

  // Mot de passe
  const [showPwd, setShowPwd] = useState(false)

  function update(patch) {
    setSettings(s => ({ ...s, ...patch }))
  }

  function handleSave() {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function handleReset() {
    if (window.confirm('Remettre tous les paramètres par défaut ?')) {
      setSettings({ ...DEFAULT_SETTINGS })
    }
  }

  // ── Vendeurs ────────────────────────────────────────────────────────────────
  function addVendeur() {
    const v = newVendeur.trim()
    if (!v || settings.vendeurs.includes(v)) return
    update({ vendeurs: [...settings.vendeurs, v] })
    setNewVendeur('')
  }
  function removeVendeur(idx) {
    update({ vendeurs: settings.vendeurs.filter((_, i) => i !== idx) })
  }

  // ── SMS templates ───────────────────────────────────────────────────────────
  function addSMS() {
    const t = newSMS.trim()
    if (!t) return
    update({ templateSMS: [...settings.templateSMS, t] })
    setNewSMS('')
  }
  function removeSMS(idx) {
    update({ templateSMS: settings.templateSMS.filter((_, i) => i !== idx) })
  }
  function updateSMS(idx, val) {
    const arr = [...settings.templateSMS]
    arr[idx] = val
    update({ templateSMS: arr })
  }

  // ── Email templates ─────────────────────────────────────────────────────────
  function addEmail() {
    const s = newEmailSujet.trim()
    const c = newEmailCorps.trim()
    if (!s || !c) return
    update({ templateEmail: [...settings.templateEmail, { sujet: s, corps: c }] })
    setNewEmailSujet('')
    setNewEmailCorps('')
  }
  function removeEmail(idx) {
    update({ templateEmail: settings.templateEmail.filter((_, i) => i !== idx) })
    if (editEmailIdx === idx) setEditEmailIdx(null)
  }
  function updateEmail(idx, field, val) {
    const arr = settings.templateEmail.map((e, i) => i === idx ? { ...e, [field]: val } : e)
    update({ templateEmail: arr })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* ─── En-tête ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-800">⚙️ Paramètres</h1>
          <p className="text-sm text-slate-400 mt-0.5">Configuration du CRM RevSpeed</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
          >
            ↺ Défaut
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
          >
            💾 Enregistrer
          </button>
        </div>
      </div>

      {/* ─── 1. Concessionnaire ──────────────────────────────────────────── */}
      <SectionCard title="Concessionnaire" icon="🏢">
        <div>
          <Label>Nom du concessionnaire</Label>
          <Input
            value={settings.nomConcessionnaire}
            onChange={e => update({ nomConcessionnaire: e.target.value })}
            placeholder="Ex : Honda Renneville"
          />
          <p className="text-[11px] text-slate-400 mt-1">Utilisé dans les messages : <code className="bg-slate-100 px-1 rounded">{'{concessionnaire}'}</code></p>
        </div>
        <div>
          <Label>Nom du responsable / commercial par défaut</Label>
          <Input
            value={settings.nomCommercial}
            onChange={e => update({ nomCommercial: e.target.value })}
            placeholder="Ex : Max"
          />
          <p className="text-[11px] text-slate-400 mt-1">Utilisé dans les messages : <code className="bg-slate-100 px-1 rounded">{'{commercial}'}</code></p>
        </div>
        <div>
          <Label>Adresse (optionnel)</Label>
          <Input
            value={settings.adresseConcessionnaire}
            onChange={e => update({ adresseConcessionnaire: e.target.value })}
            placeholder="Ex : 12 rue de la Moto, 93000 Bondy"
          />
        </div>
      </SectionCard>

      {/* ─── 2. Équipe / Vendeurs ─────────────────────────────────────────── */}
      <SectionCard title="Équipe commerciale" icon="👥">
        <div>
          <Label>Vendeurs actifs</Label>
          <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-3 bg-slate-50 border border-slate-200 rounded-xl mb-3">
            {settings.vendeurs.length === 0 && (
              <span className="text-xs text-slate-400 italic">Aucun vendeur — ajoutez-en ci-dessous</span>
            )}
            {settings.vendeurs.map((v, i) => (
              <Tag key={i} label={v} onRemove={() => removeVendeur(i)} />
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newVendeur}
              onChange={e => setNewVendeur(e.target.value)}
              placeholder="Prénom Nom du vendeur"
              onKeyDown={e => e.key === 'Enter' && addVendeur()}
            />
            <button
              onClick={addVendeur}
              className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors"
            >
              + Ajouter
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ─── 3. Templates SMS ────────────────────────────────────────────── */}
      <SectionCard title="Templates SMS" icon="📱">
        <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          Variables disponibles : <code className="bg-white px-1 rounded border border-slate-200">{'{prenom}'}</code> <code className="bg-white px-1 rounded border border-slate-200">{'{commercial}'}</code> <code className="bg-white px-1 rounded border border-slate-200">{'{concessionnaire}'}</code>
        </div>

        {settings.templateSMS.map((t, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Template SMS #{i + 1}</Label>
              <button
                onClick={() => removeSMS(i)}
                className="text-xs text-red-400 hover:text-red-600 font-medium"
              >
                Supprimer
              </button>
            </div>
            <Textarea
              value={t}
              onChange={e => updateSMS(i, e.target.value)}
              rows={5}
            />
          </div>
        ))}

        <div className="border-t border-slate-100 pt-4 space-y-2">
          <Label>Nouveau template SMS</Label>
          <Textarea
            value={newSMS}
            onChange={e => setNewSMS(e.target.value)}
            placeholder={"Bonjour {prenom},\n\nC'est {commercial} de {concessionnaire}…"}
            rows={4}
          />
          <button
            onClick={addSMS}
            disabled={!newSMS.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors"
          >
            + Ajouter ce template
          </button>
        </div>
      </SectionCard>

      {/* ─── 4. Templates Email ──────────────────────────────────────────── */}
      <SectionCard title="Templates Email" icon="📧">
        <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          Variables disponibles : <code className="bg-white px-1 rounded border border-slate-200">{'{prenom}'}</code> <code className="bg-white px-1 rounded border border-slate-200">{'{commercial}'}</code> <code className="bg-white px-1 rounded border border-slate-200">{'{concessionnaire}'}</code>
        </div>

        {settings.templateEmail.map((tpl, i) => (
          <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-2.5 bg-slate-50 cursor-pointer"
              onClick={() => setEditEmailIdx(editEmailIdx === i ? null : i)}
            >
              <span className="text-sm font-semibold text-slate-700 truncate flex-1">
                {tpl.sujet || `Email #${i + 1}`}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); removeEmail(i) }}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Supprimer
                </button>
                <span className="text-slate-400 text-xs">{editEmailIdx === i ? '▲' : '▼'}</span>
              </div>
            </div>
            {editEmailIdx === i && (
              <div className="p-4 space-y-3">
                <div>
                  <Label>Sujet</Label>
                  <Input
                    value={tpl.sujet}
                    onChange={e => updateEmail(i, 'sujet', e.target.value)}
                    placeholder="Votre projet Moto – {concessionnaire}"
                  />
                </div>
                <div>
                  <Label>Corps de l'email</Label>
                  <Textarea
                    value={tpl.corps}
                    onChange={e => updateEmail(i, 'corps', e.target.value)}
                    rows={7}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <Label>Nouveau template email</Label>
          <div>
            <Label>Sujet</Label>
            <Input
              value={newEmailSujet}
              onChange={e => setNewEmailSujet(e.target.value)}
              placeholder="Votre projet Moto – {concessionnaire}"
            />
          </div>
          <div>
            <Label>Corps</Label>
            <Textarea
              value={newEmailCorps}
              onChange={e => setNewEmailCorps(e.target.value)}
              placeholder={"Bonjour {prenom},\n\nJe fais suite à votre demande…"}
              rows={5}
            />
          </div>
          <button
            onClick={addEmail}
            disabled={!newEmailSujet.trim() || !newEmailCorps.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors"
          >
            + Ajouter ce template
          </button>
        </div>
      </SectionCard>

      {/* ─── 5. Alertes & Relances ───────────────────────────────────────── */}
      <SectionCard title="Alertes & Relances" icon="🔔">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Délai de relance (jours)</Label>
            <Input
              type="number"
              value={settings.joursRelance}
              onChange={e => update({ joursRelance: parseInt(e.target.value) || 0 })}
              min={1}
              max={30}
            />
            <p className="text-[11px] text-slate-400 mt-1">Un lead sans action devient "à relancer" après ce délai</p>
          </div>
          <div>
            <Label>Lead froid (jours)</Label>
            <Input
              type="number"
              value={settings.joursLeadFroid}
              onChange={e => update({ joursLeadFroid: parseInt(e.target.value) || 0 })}
              min={1}
              max={60}
            />
            <p className="text-[11px] text-slate-400 mt-1">Un lead inactif est signalé "froid" après ce délai</p>
          </div>
        </div>
      </SectionCard>

      {/* ─── 6. Sécurité ────────────────────────────────────────────────── */}
      <SectionCard title="Sécurité" icon="🔒">
        <div>
          <Label>Mot de passe d'accès</Label>
          <div className="relative">
            <Input
              type={showPwd ? 'text' : 'password'}
              value={settings.motDePasse}
              onChange={e => update({ motDePasse: e.target.value })}
              placeholder="Laisser vide = aucune protection"
            />
            <button
              onClick={() => setShowPwd(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              {showPwd ? '🙈' : '👁'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Si renseigné, l'app demandera ce mot de passe au démarrage</p>
        </div>
      </SectionCard>

      {/* ─── 7. Synchronisation ─────────────────────────────────────────── */}
      <SectionCard title="Synchronisation" icon="☁️">
        <div>
          <p className="text-sm text-slate-600 mb-3">
            Pousse toutes les données de <strong>ce navigateur</strong> vers Google Sheets, pour les rendre disponibles sur tous les autres appareils.
          </p>
          <p className="text-xs text-slate-400 mb-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            ⚠️ À utiliser une seule fois depuis le navigateur qui contient vos données (Harold : depuis ton Mac/Chrome).
          </p>
          <button
            onClick={handleSyncToGAS}
            disabled={syncState === 'loading'}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              syncState === 'loading' ? 'bg-slate-200 text-slate-400 cursor-wait' :
              syncState === 'ok'      ? 'bg-emerald-600 text-white' :
              syncState === 'error'   ? 'bg-red-100 text-red-700 border border-red-200' :
                                        'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
            }`}
          >
            {syncState === 'loading' && <span className="animate-spin">⟳</span>}
            {syncState === 'loading' ? 'Synchronisation en cours…' :
             syncState === 'ok'      ? '✓ Synchronisé !' :
             syncState === 'error'   ? '✗ Erreur' :
                                       '☁️ Synchroniser vers Google Sheets'}
          </button>
          {syncMsg && (
            <p className={`text-xs mt-2 text-center font-medium ${syncState === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
              {syncMsg}
            </p>
          )}
        </div>
      </SectionCard>

      {/* ─── Bouton bas de page ──────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pb-8">
        <button
          onClick={handleReset}
          className="px-4 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
        >
          ↺ Remettre les défauts
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
        >
          💾 Enregistrer les paramètres
        </button>
      </div>

      <SaveBanner saved={saved} />
    </div>
  )
}
