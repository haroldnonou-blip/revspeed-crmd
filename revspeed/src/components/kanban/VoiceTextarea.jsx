import { useEffect, useRef, useState } from 'react'
import { cleanDictation } from '../../utils/cleanDictation'

/**
 * VoiceTextarea — zone de texte avec dictée vocale + bouton "Mettre au propre".
 *
 * - 🎤 Micro : reconnaissance vocale native (Web Speech API, fr-FR).
 *   Au 1er clic, demande l'autorisation micro (pop-up natif). Si le micro est
 *   bloqué, affiche une fenêtre d'aide expliquant comment le débloquer.
 * - ✨ Mettre au propre : nettoie la dictée (tics, répétitions, ponctuation),
 *   en local, sans IA.
 */
export default function VoiceTextarea({
  name, value, onChange, rows = 4, placeholder, className,
  summarize = false,
}) {
  const [listening, setListening]   = useState(false)
  const [cleaned, setCleaned]       = useState(false)
  const [error, setError]           = useState('')
  const [showMicHelp, setShowMicHelp] = useState(false)
  const recognitionRef = useRef(null)
  const baseTextRef    = useRef('')

  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null
  const voiceSupported = !!SR

  useEffect(() => () => {
    try { recognitionRef.current?.stop() } catch {}
  }, [])

  function emit(newValue) {
    onChange?.({ target: { name, value: newValue } })
  }

  // ── Permission micro ──────────────────────────────────────────────────
  // getUserMedia déclenche le pop-up natif si la permission n'est pas encore
  // décidée. Si l'utilisateur a bloqué, ça rejette → on montre l'aide.
  async function ensureMicPermission() {
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(t => t.stop())  // on relâche aussitôt
      }
      return true
    } catch {
      return false
    }
  }

  // ── Démarrer / arrêter la dictée ──────────────────────────────────────
  async function toggleListening() {
    setError('')
    if (listening) {
      try { recognitionRef.current?.stop() } catch {}
      setListening(false)
      return
    }
    if (!voiceSupported) {
      setError("La dictée vocale n'est pas disponible sur ce navigateur. Utilise Chrome ou Safari.")
      return
    }
    const granted = await ensureMicPermission()
    if (!granted) { setShowMicHelp(true); return }
    startRecognition()
  }

  function startRecognition() {
    const rec = new SR()
    rec.lang = 'fr-FR'
    rec.continuous = true
    rec.interimResults = true

    baseTextRef.current = value ? value.trimEnd() : ''
    let finalChunk = ''

    rec.onresult = (e) => {
      let interim = ''
      finalChunk = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript
        if (e.results[i].isFinal) finalChunk += txt
        else interim += txt
      }
      const prefix = baseTextRef.current ? baseTextRef.current + ' ' : ''
      emit((prefix + finalChunk + interim).replace(/\s+/g, ' ').trimStart())
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setShowMicHelp(true)
      } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
        setError('Erreur micro : ' + e.error)
      }
      setListening(false)
    }
    rec.onend = () => {
      const prefix = baseTextRef.current ? baseTextRef.current + ' ' : ''
      if (finalChunk) emit((prefix + finalChunk).replace(/\s+/g, ' ').trim())
      setListening(false)
    }

    recognitionRef.current = rec
    try { rec.start(); setListening(true) }
    catch { setError('Impossible de démarrer la dictée.') }
  }

  // ── Mettre au propre (local, instantané) ──────────────────────────────
  function handleSummarize() {
    const text = (value || '').trim()
    if (!text) { setError('Rien à mettre au propre — dicte ou écris d\'abord.'); return }
    setError('')
    emit(cleanDictation(text))
    setCleaned(true)
    setTimeout(() => setCleaned(false), 1800)
  }

  return (
    <div className="relative">
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        className={className}
      />

      <div className="flex items-center gap-2 mt-1.5">
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleListening}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              listening
                ? 'bg-red-500 text-white shadow-md animate-pulse'
                : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
            }`}
            title={listening ? 'Arrêter la dictée' : 'Dicter à la voix'}
          >
            <MicIcon />
            {listening ? 'Écoute… (stop)' : 'Dicter'}
          </button>
        )}

        {summarize && (
          <button
            type="button"
            onClick={handleSummarize}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              cleaned
                ? 'bg-emerald-500 text-white'
                : 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100'
            }`}
            title="Mettre au propre (enlève les tics, met majuscules et ponctuation)"
          >
            {cleaned ? '✓' : <SparkIcon />}
            {cleaned ? 'Mis au propre' : 'Mettre au propre'}
          </button>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-red-500 mt-1 font-medium">{error}</p>
      )}

      {showMicHelp && <MicHelpModal onClose={() => setShowMicHelp(false)} />}
    </div>
  )
}

// ── Fenêtre d'aide : comment débloquer le micro ───────────────────────────────
function MicHelpModal({ onClose }) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isMobile = /iphone|ipad|android/i.test(ua)
  const isSafari = /safari/i.test(ua) && !/chrome|crios|android/i.test(ua)

  let steps
  if (isSafari && !isMobile) {
    steps = [
      "Menu Safari (en haut) → « Réglages pour ce site web… »",
      "Ligne « Microphone » → choisis « Autoriser »",
      "Reviens ici et recharge la page",
    ]
  } else if (isMobile && isSafari) {
    steps = [
      "Touche « aA » à gauche de l'adresse → « Réglages du site web »",
      "« Microphone » → « Autoriser »",
      "Recharge la page",
    ]
  } else if (isMobile) {
    steps = [
      "Touche l'icône 🔒 (ou ⓘ) à gauche de l'adresse du site",
      "« Autorisations » → « Micro » → « Autoriser »",
      "Recharge la page",
    ]
  } else {
    // Chrome / Edge desktop
    steps = [
      "Clique sur l'icône 🔒 (ou les deux curseurs) juste à gauche de l'adresse « revspeed-crmd.vercel.app »",
      "Trouve « Microphone » et mets-le sur « Autoriser »",
      "Reviens ici et recharge la page",
    ]
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl">🎤</div>
          <div>
            <h3 className="font-black text-slate-800 text-base leading-tight">Autoriser le micro</h3>
            <p className="text-xs text-slate-500 mt-0.5">Le micro est bloqué pour ce site. Suis ces étapes :</p>
          </div>
        </div>

        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
              <span className="text-sm text-slate-700 leading-snug">{s}</span>
            </li>
          ))}
        </ol>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
          >
            🔄 J'ai autorisé — recharger
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold transition-colors"
          >
            Fermer
          </button>
        </div>

        <p className="text-[11px] text-slate-400 text-center">
          Astuce : tu peux aussi utiliser le micro du clavier de ton téléphone à la place.
        </p>
      </div>
    </div>
  )
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2zM19 15l.9 2.6L22.5 18l-2.6.9L19 21.5l-.9-2.6L15.5 18l2.6-.9L19 15z"/>
    </svg>
  )
}
