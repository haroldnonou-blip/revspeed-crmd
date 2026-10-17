/**
 * cleanDictation — met au propre un texte dicté à la voix, sans IA.
 *
 * - Supprime les tics de langage (euh, ben, tu vois, nanana…)
 * - Collapse les répétitions immédiates (telle heure telle heure → telle heure)
 * - Découpe en phrases, met les majuscules et la ponctuation
 * - Corrige quelques casses utiles (WhatsApp, RDV, SMS…)
 *
 * Rapide, local, gratuit. Suffisant pour des notes de suivi commercial.
 */

// Tics de langage et hésitations à retirer (limites de mots, insensible à la casse)
const FILLERS = [
  'euh+', 'heu+', 'hum+', 'hmm+', 'mmh+', 'mh+',
  'bah', 'ben', 'ouais', 'ouai', 'bon ben',
  'tu vois', 'vous voyez', 'tu sais', 'vous savez',
  'en gros', 'genre', 'comment dire', 'je veux dire',
  'na(?: na)+', 'bla(?: bla)+', 'et tout ça', 'et tout', 'voilà quoi',
]

// Corrections de casse courantes
const CASE_FIXES = [
  [/\bwhatsapp\b/gi, 'WhatsApp'],
  [/\brdv\b/gi, 'RDV'],
  [/\bsms\b/gi, 'SMS'],
  [/\bmail\b/gi, 'mail'],
]

export function cleanDictation(input) {
  if (!input || !input.trim()) return ''

  let t = input.replace(/\s+/g, ' ').trim()

  // 1. Retirer les tics de langage + petites corrections d'apostrophe
  const fillerRe = new RegExp('\\b(?:' + FILLERS.join('|') + ')\\b', 'gi')
  t = t.replace(fillerRe, ' ')
  t = t.replace(/\bj\s+ai\b/gi, "j'ai")       // "j ai" → "j'ai"
       .replace(/\bl\s+ai\b/gi, "l'ai")       // "l ai" → "l'ai"
       .replace(/\bc\s+est\b/gi, "c'est")     // "c est" → "c'est"
       .replace(/\bd\s+accord\b/gi, "d'accord")

  // 2. Nettoyer ponctuation orpheline + espaces
  t = t
    .replace(/\s+([,.;!?])/g, '$1')      // espace avant ponctuation
    .replace(/([,;])\s*([,;])+/g, '$1')  // ponctuations multiples
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;.]+/, '')
    .trim()

  // 3. Collapser les répétitions immédiates — groupes de mots puis mots seuls
  try {
    // groupes de 2 à 4 mots répétés (ex: "telle heure telle heure" → "telle heure")
    t = t.replace(/\b((?:[\p{L}'-]+)(?:\s+[\p{L}'-]+){1,3})(?:\s+\1\b)+/giu, '$1')
    // mot seul répété (ex: "oui oui oui" → "oui")
    t = t.replace(/\b([\p{L}'-]+)(?:\s+\1\b)+/giu, '$1')
  } catch {
    t = t.replace(/\b((?:[A-Za-zÀ-ÿ'-]+)(?:\s+[A-Za-zÀ-ÿ'-]+){1,3})(?:\s+\1\b)+/gi, '$1')
    t = t.replace(/\b([A-Za-zÀ-ÿ'-]+)(?:\s+\1\b)+/gi, '$1')
  }

  // 4. Découper en phrases : sur ponctuation forte si présente, sinon sur virgules
  let parts = /[.!?]/.test(t)
    ? t.split(/(?<=[.!?])\s+/)
    : t.split(/\s*,\s*/)
  parts = parts.map(s => s.trim()).filter(Boolean)

  // 5. Capitaliser + ponctuation finale
  const sentences = parts.map(s => {
    s = s.replace(/^[\s,;.]+/, '').replace(/[\s,;]+$/, '').trim()
    if (!s) return ''
    s = s.charAt(0).toUpperCase() + s.slice(1)
    if (!/[.!?]$/.test(s)) s += '.'
    return s
  }).filter(Boolean)

  let out = sentences.join(' ')

  // 6. Corrections de casse
  for (const [re, rep] of CASE_FIXES) out = out.replace(re, rep)

  return out.trim()
}
