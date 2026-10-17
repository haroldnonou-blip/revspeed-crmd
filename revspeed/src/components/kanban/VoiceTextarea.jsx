import { useEffect, useRef, useState } from 'react'
import { cleanDictation } from '../../utils/cleanDictation'

/**
 * VoiceTextarea — zone de texte avec dictée vocale + bouton "Résumer" (IA).
 *
 * - 🎤 Micro : utilise la reconnaissance vocale native du navigateur
 *   (Web Speech API, fr-FR). Appuyer pour dicter, appuyer à nouveau pour
 *   arrêter. Le texte dicté s'ajoute à la suite du contenu existant.
 * - ✨ Résumer (optionnel) : envoie le texte brut à une IA qui le nettoie
 *   et le structure en note claire. Affiché seulement si `summarize` = true.
 *
 * Props :
 *   name, value, onChange  — comme un <textarea> standard (onChange reçoit
 *                            un event synthétique { target: { name, value } })
 *   rows, placeholder, className
 *   summarize {boolean}     — affiche le bouton Résumer
 */
export default function VoiceTextarea({
  name, value, onChange, rows = 4, placeholder, className,
  summarize = false,
}) {
  const [listening, setListening] = useState(false)
  const [cleaned, setCleaned]     = useState(false)
  const [error, setError]         = useState('')
  const recognitionRef = useRef(null)
  const baseTextRef    = useRef('')   // texte présent au démarrage de la dictée

  // La reconnaissance vocale est-elle supportée ?
  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null
  const voiceSupported = !!SR

  // ── Nettoyage à la destruction ────────────────────────────────────────
  useEffect(() => () => {
    try { recognitionRef.current?.stop() } catch {}
  }, [])

  function emit(newValue) {
    onChange?.({ target: { name, value: newValue } })
  }

  // ── Démarrer / arrêter la dictée ──────────────────────────────────────
  function toggleListening() {
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
        setError("Micro bloqué — autorise le micro dans le navigateur.")
      } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
        setError('Erreur micro : ' + e.error)
      }
      setListening(false)
    }
    rec.onend = () => {
      // Fige le texte final (sans l'intermédiaire)
      const prefix = baseTextRef.current ? baseTextRef.current + ' ' : ''
      if (finalChunk) emit((prefix + finalChunk).replace(/\s+/g, ' ').trim())
      setListening(false)
    }

    recognitionRef.current = rec
    try { rec.start(); setListening(true) }
    catch { setError('Impossible de démarrer la dictée.') }
  }

  // ── Mettre au propre (local, instantané, sans IA) ─────────────────────
  function handleSummarize() {
    const text = (value || '').trim()
    if (!text) { setError('Rien à mettre au propre — dicte ou écris d\'abord.'); return }
    setError('')
    const clean = cleanDictation(text)
    emit(clean)
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

      {/* Barre d'outils : micro + résumer */}
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
