/**
 * RevSpeed — Vue Vendeur XADV Carplay
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce script crée et maintient la "Feuille 2" (vue vendeur propre)
 * en synchronisation avec la "Feuille 1" (données brutes Facebook).
 *
 * INSTALLATION :
 *   1. Extensions → Apps Script → coller ce code → Enregistrer
 *   2. Exécuter setupVueVendeur() une première fois (bouton ▶)
 *   3. Activer le déclencheur automatique : setupTrigger()
 *
 * RÉSULTAT :
 *   - Feuille 2 se remplit automatiquement quand Feuille 1 reçoit des leads
 *   - Téléphone sans "p:" → copier-coller direct
 *   - Code postal sans "z:" → copier-coller direct
 *   - Date lisible (12/10/2026 à 18h49)
 *   - Ancienneté du lead en jours
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SOURCE_SHEET  = 'Feuille 1'
const VENDEUR_SHEET = 'Feuille 2'

// ── Colonnes source (Feuille 1) ───────────────────────────────────────────────
// A=id B=created_time C=ad_id D=ad_name E=adset_id F=adset_name G=campaign_id
// H=campaign_name I=form_id J=form_name K=is_organic L=platform
// M=quel_est_votre_projet_? N=quel_est_votre_délai_pour_ce_projet_?
// O=quel_serait_votre__budget_?_ P=email Q=full_name R=phone_number
// S=zip_code T=lead_status

// ── Labels lisibles pour les valeurs Facebook ─────────────────────────────────
const PROJETS = {
  'essayer_un_modèle_disponible':               '🏍️ Essai moto',
  'obtenir_une_offre_de_financement_/_loa':     '💳 Financement / LOA',
  'faire_estimer_la_reprise_de_mon_2-roues':    '🔄 Reprise 2-roues',
  'acheter_une_moto_neuve':                     '🆕 Achat neuf',
  'acheter_une_moto_occasion':                  '🔍 Achat occasion',
  'obtenir_des_infos_sur_un_modèle':            'ℹ️ Infos modèle',
}

const DELAIS = {
  'immédiat_(sous_15_jours)': '🔥 -15 jours',
  "d'ici_un_mois":            '📅 1 mois',
  'je_me_renseigne':          '👀 Renseignement',
  'd\'ici_3_mois':            '📆 3 mois',
  'd\'ici_6_mois':            '🗓️ 6 mois',
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP — initialise la Feuille 2 avec les en-têtes et les données existantes
// ─────────────────────────────────────────────────────────────────────────────

function setupVueVendeur() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet()
  const source = ss.getSheetByName(SOURCE_SHEET)
  let   vue    = ss.getSheetByName(VENDEUR_SHEET)

  if (!vue) vue = ss.insertSheet(VENDEUR_SHEET)

  // En-têtes
  const headers = [
    '📅 Reçu le',
    '⏱️ Ancienneté (j)',
    '👤 Nom',
    '📞 Téléphone',
    '📧 Email',
    '📮 Code postal',
    '🎯 Projet',
    '⏰ Délai',
    '💰 Budget',
    '🚦 Statut',
    '👔 Vendeur',
    '📝 Note vendeur',
    '📞 Appel 1',
    '📞 Appel 2',
    '📞 Appel 3',
    '🔁 Rappel client',
    '📆 Date RDV',
    '🏁 Résultat',
    '🔑 ID lead',   // caché en col S, utile pour debug
  ]

  // Ligne 1 : en-têtes
  vue.getRange(1, 1, 1, headers.length).setValues([headers])

  // Style en-têtes
  const headerRange = vue.getRange(1, 1, 1, headers.length)
  headerRange
    .setBackground('#1a1a2e')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(11)
  vue.setFrozenRows(1)
  vue.setFrozenColumns(1)

  // Synchroniser toutes les données existantes
  syncAllLeads()

  // Largeurs de colonnes
  vue.setColumnWidth(1, 160)   // date
  vue.setColumnWidth(2, 100)   // ancienneté
  vue.setColumnWidth(3, 180)   // nom
  vue.setColumnWidth(4, 140)   // téléphone
  vue.setColumnWidth(5, 220)   // email
  vue.setColumnWidth(6, 100)   // CP
  vue.setColumnWidth(7, 200)   // projet
  vue.setColumnWidth(8, 160)   // délai
  vue.setColumnWidth(9, 120)   // budget
  vue.setColumnWidth(10, 130)  // statut
  vue.setColumnWidth(11, 120)  // vendeur
  vue.setColumnWidth(12, 280)  // note
  vue.setColumnWidth(13, 120)  // appel 1
  vue.setColumnWidth(14, 120)  // appel 2
  vue.setColumnWidth(15, 120)  // appel 3
  vue.setColumnWidth(16, 130)  // rappel
  vue.setColumnWidth(17, 120)  // rdv
  vue.setColumnWidth(18, 130)  // résultat
  vue.setColumnWidth(19, 160)  // id (caché)

  // Mise en forme conditionnelle — colonne Statut (col 10)
  applyConditionalFormatting(vue)

  SpreadsheetApp.getUi().alert('✅ Vue vendeur créée avec ' + (vue.getLastRow() - 1) + ' leads !')
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC — recopie tous les leads de Feuille 1 vers Feuille 2
//        en préservant les données CRM déjà saisies par les vendeurs
// ─────────────────────────────────────────────────────────────────────────────

function syncAllLeads() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet()
  const source = ss.getSheetByName(SOURCE_SHEET)
  const vue    = ss.getSheetByName(VENDEUR_SHEET)
  if (!source || !vue) return

  const srcData = source.getDataRange().getValues()
  if (srcData.length < 2) return

  // Construire un index des leads déjà dans la vue (par ID)
  const vueData   = vue.getLastRow() > 1 ? vue.getRange(2, 1, vue.getLastRow() - 1, 19).getValues() : []
  const existingIds = {}
  vueData.forEach((row, i) => {
    const id = row[18]  // col S = ID lead
    if (id) existingIds[id] = i + 2  // numéro de ligne dans la feuille
  })

  // Parcourir les leads source (skip ligne 1 = en-têtes)
  for (let i = 1; i < srcData.length; i++) {
    const row = srcData[i]
    const id  = String(row[0]).trim()
    if (!id || id === 'id') continue

    const lineNumber = existingIds[id]

    // Transformer les données
    const created    = parseDate(row[1])
    const dateStr    = created ? formatDate(created) : ''
    const age        = created ? Math.floor((Date.now() - created.getTime()) / 86400000) : ''
    const nom        = String(row[16]).trim()                            // Q = full_name
    const tel        = String(row[17]).replace(/^p:/, '').trim()        // R = phone_number
    const email      = String(row[15]).trim()                            // P = email
    const cp         = String(row[18] || '').replace(/^z:/, '').trim()  // S = zip_code (source col S = index 18)
    // Note: dans srcData, index 0=A ... 18=S, 19=T
    const cpClean    = String(srcData[i][18] || '').replace(/^z:/, '').trim()
    const projet     = labelProjet(String(row[12]).trim())               // M
    const delai      = labelDelai(String(row[13]).trim())                // N
    const budget     = String(row[14]).trim()                            // O
    const statut     = String(row[19]).trim()                            // T = lead_status

    if (lineNumber) {
      // Lead existant — mettre à jour seulement les colonnes non-CRM (cols 1-9 + 19)
      const targetRow = vue.getRange(lineNumber, 1, 1, 19).getValues()[0]
      vue.getRange(lineNumber, 1, 1, 9).setValues([[dateStr, age, nom, tel, email, cpClean, projet, delai, budget]])
      // Col 10 (statut) : mettre à jour si pas encore modifié par vendeur
      if (!targetRow[9] || targetRow[9] === 'CREATED') {
        vue.getRange(lineNumber, 10).setValue(statut)
      }
      vue.getRange(lineNumber, 19).setValue(id)  // toujours garder l'ID
    } else {
      // Nouveau lead — ajouter une ligne
      const newRow = [
        dateStr, age, nom, tel, email, cpClean, projet, delai, budget,
        statut,   // statut
        '',       // vendeur
        '',       // note
        '', '', '', '', '', '',  // appels + RDV + résultat
        id,       // ID caché
      ]
      vue.appendRow(newRow)
      const newLine = vue.getLastRow()
      // Colorier la ligne "New lead" en vert pâle
      vue.getRange(newLine, 1, 1, 18).setBackground('#e6f4ea')
    }
  }

  // Mettre à jour l'ancienneté pour tous les leads (col 2)
  refreshAnciennete(vue)
}

// ─────────────────────────────────────────────────────────────────────────────
// DÉCLENCHEUR — s'exécute automatiquement à chaque modification de Feuille 1
// ─────────────────────────────────────────────────────────────────────────────

function onSheetChange(e) {
  if (!e) return
  const sheet = e.source.getActiveSheet()
  if (sheet.getName() !== SOURCE_SHEET) return
  syncAllLeads()
}

function setupTrigger() {
  // Supprimer les anciens déclencheurs pour éviter les doublons
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'onSheetChange') ScriptApp.deleteTrigger(t)
  })
  ScriptApp.newTrigger('onSheetChange')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onChange()
    .create()
  SpreadsheetApp.getUi().alert('✅ Déclencheur activé — la vue vendeur se met à jour automatiquement !')
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function parseDate(raw) {
  if (!raw) return null
  try { return new Date(raw) } catch { return null }
}

function formatDate(d) {
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} à ${pad(d.getHours())}h${pad(d.getMinutes())}`
}

function labelProjet(raw) {
  return PROJETS[raw] || raw.replace(/_/g, ' ')
}

function labelDelai(raw) {
  return DELAIS[raw] || raw.replace(/_/g, ' ')
}

function refreshAnciennete(vue) {
  const lastRow = vue.getLastRow()
  if (lastRow < 2) return
  const now = Date.now()
  const dates = vue.getRange(2, 1, lastRow - 1, 1).getValues()
  const ages  = dates.map(([dateStr]) => {
    if (!dateStr) return ['']
    // Parser notre format jj/mm/aaaa à HHhMM
    const m = String(dateStr).match(/(\d{2})\/(\d{2})\/(\d{4}) à (\d{2})h(\d{2})/)
    if (!m) return ['']
    const d = new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5])
    return [Math.floor((now - d.getTime()) / 86400000)]
  })
  vue.getRange(2, 2, lastRow - 1, 1).setValues(ages)
}

function applyConditionalFormatting(vue) {
  const range   = vue.getRange('J2:J1000')
  const rules   = []
  const statuts = [
    { value: 'RDV OK',      bg: '#34a853', fg: '#ffffff' },
    { value: 'CONTACTÉ',    bg: '#4285f4', fg: '#ffffff' },
    { value: 'Répondeur',   bg: '#fbbc04', fg: '#000000' },
    { value: 'EN ATTENTE',  bg: '#ff9800', fg: '#ffffff' },
    { value: 'CREATED',     bg: '#e8eaed', fg: '#444444' },
    { value: 'RDV KO',      bg: '#ea4335', fg: '#ffffff' },
    { value: 'VENDU',       bg: '#0f9d58', fg: '#ffffff' },
    { value: 'PERDU',       bg: '#9e9e9e', fg: '#ffffff' },
  ]
  statuts.forEach(({ value, bg, fg }) => {
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(value)
      .setBackground(bg)
      .setFontColor(fg)
      .setRanges([range])
      .build()
    rules.push(rule)
  })
  vue.setConditionalFormatRules(rules)
}
