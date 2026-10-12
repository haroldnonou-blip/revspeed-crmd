/**
 * RevSpeed — LoginGate
 * Protège l'accès au CRM par un mot de passe configuré via VITE_ACCESS_PASSWORD.
 * Si la variable n'est pas définie, l'accès est libre (mode dev).
 *
 * Le token est stocké en sessionStorage (disparaît à la fermeture de l'onglet).
 */

import { useState } from 'react'

const PASSWORD    = import.meta.env.VITE_ACCESS_PASSWORD ?? ''
const SESSION_KEY = 'revspeed_auth'

function isAuthenticated() {
  if (!PASSWORD) return true  // pas de mot de passe configuré → accès libre
  try { return sessionStorage.getItem(SESSION_KEY) === 'ok' } catch { return false }
}

export default function LoginGate({ children }) {
  const [authed, setAuthed] = useState(isAuthenticated)
  const [input,  setInput]  = useState('')
  const [error,  setError]  = useState(false)

  if (authed) return children

  function handleSubmit(e) {
    e.preventDefault()
    if (input === PASSWORD) {
      try { sessionStorage.setItem(SESSION_KEY, 'ok') } catch {}
      setAuthed(true)
    } else {
      setError(true)
      setInput('')
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Rev<span style={{ color: '#3b82f6' }}>Speed</span>
            <span className="ml-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">CRM</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Accès sécurisé</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Mot de passe
            </label>
            <input
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="••••••••"
              autoFocus
              className={`w-full px-4 py-3 rounded-xl border text-sm transition-all outline-none ${
                error
                  ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-400/40'
                  : 'border-slate-200 focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400'
              }`}
            />
            {error && (
              <p className="text-red-500 text-xs mt-1.5 font-medium">Mot de passe incorrect</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!input}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-sm transition-colors"
          >
            Accéder au CRM →
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-300">
          RevSpeed CRM · Usage strictement professionnel
        </p>
      </div>
    </div>
  )
}
