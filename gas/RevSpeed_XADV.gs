/**
 * RevSpeed — Apps Script XADV Carplay
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce script fait le pont entre le Google Sheet Facebook et le CRM RevSpeed.
 *
 * ENDPOINTS :
 *   GET  ?token=XXX              → retourne tous les leads normalisés (JSON)
 *   GET  ?token=XXX&id=l:123     → retourne un seul lead
 *   POST { token, action, ... }  → met à jour l'état CRM
 *
 * FEUILLES GÉRÉES :
 *   "Feuille 1"  → données brutes Facebook (NE PAS TOUCHER)
 *   "CRM_State"  → état CRM (statut, vendeur, notes, RDV) géré par RevSpeed
 *   "Vue Vendeur"→ feuille lisible pour les vendeurs (générée automatiquement)
 *
 * INSTALLATION :
 *   1. Extensions → Apps Script → coller ce code → Enregistrer
 *   2. Exécuter setupSheets() une première fois
 *   3. Déployer → Nouvelle déploiement → Application Web
 *      → Exécuter en tant que : Moi
 *      → Accès : Tout le monde
 *   4. Copier l'URL → l'ajouter dans Vercel : VITE_GAS_ENDPOINT
 *   5. Définir le token : Script Properties → API_TOKEN = votre_token_secret
 *      → l'ajouter dans Vercel : VITE_GAS_TOKEN
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Configuration ─────────────────────────────────────────────────────────────
const SHEET_LEADS   = 'Feuille 1'
const SHEET_CRM     = 'CRM_State'
const SHEET_VENDEUR = 'Vue Vendeur'

// ── Labels lisibles ───────────────────────────────────────────────────────────
const PROJETS = {
  'essayer_un_modèle_disponible':               'Essai moto',
  'obtenir_une_offre_de_financement_/_loa':     'Financement / LOA',
  'faire_estimer_la_reprise_de_mon_2-roues':    'Reprise 2-roues',
  'acheter_une_moto_neuve':                     'Achat neuf',
  'acheter_une_moto_occasion':                  'Achat occasion',
  'obtenir_des_infos_sur_un_modèle':            'Infos modèle',
}

const DELAIS = {
  'immédiat_(sous_15_jours)': 'Sous 15 jours',
  "d'ici_un_mois":            "D'ici 1 mois",
  'je_me_renseigne':          'Renseignement',
  "d'ici_3_mois":             "D'ici 3 mois",
  "d'ici_6_mois":             "D'ici 6 mois",
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

function checkToken(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN')
  if (!expected) return true // pas de token configuré = accès libre (dev)
  return token === expected
}

function unauthorized() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: 'Unauthorized' }))
    .setMimeType(ContentService.MimeType.JSON)
}

// ─────────────────────────────────────────────────────────────────────────────
// doGet — lecture des leads
// ─────────────────────────────────────────────────────────────────────────────

function doGet(e) {
  const params = e?.parameter ?? {}
  if (!checkToken(params.token)) return unauthorized()

  try {
    const leads = getLeads()

    // Filtre optionnel par ID
    if (params.id) {
      const lead = leads.find(l => l.id === params.id)
      return json({ ok: true, data: lead ?? null })
    }

    // Filtre optionnel aujourd'hui
    if (params.filter === 'today') {
      const today = new Date()
      const todayLeads = leads.filter(l => {
        if (!l.createdAt) return false
        const d = new Date(l.createdAt)
        return d.getDate()     === today.getDate() &&
               d.getMonth()    === today.getMonth() &&
               d.getFullYear() === today.getFullYear()
      })
      return json({ ok: true, data: todayLeads, count: todayLeads.length })
    }

    return json({ ok: true, data: leads, count: leads.length })

  } catch (err) {
    return json({ ok: false, error: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// doPost — écriture de l'état CRM
// ─────────────────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    if (!checkToken(body.token)) return unauthorized()

    const action = body.action

    if (action === 'updateLead') {
      const result = saveCrmState(body.lead)
      syncVueVendeur()
      return json({ ok: true, lead: result })
    }

    if (action === 'saveAll') {
      const leads = body.leads ?? []
      leads.forEach(l => saveCrmState(l))
      syncVueVendeur()
      return json({ ok: true, count: leads.length })
    }

    return json({ ok: false, error: 'Action inconnue: ' + action })

  } catch (err) {
    return json({ ok: false, error: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE — normalise Feuille 1 + fusionne CRM_State
// ─────────────────────────────────────────────────────────────────────────────

function getLeads() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName(SHEET_LEADS)
  if (!sheet) throw new Error('Feuille "' + SHEET_LEADS + '" introuvable')

  const data = sheet.getDataRange().getValues()
  if (data.length < 2) return []

  // Charger l'état CRM
  const crmMap = loadCrmState()

  // Ligne 0 = en-têtes, on détecte les colonnes dynamiquement
  const headers = data[0].map(h => String(h).trim().toLowerCase())
  const col = name => headers.indexOf(name)

  const leads = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const id  = String(row[col('id')] ?? '').trim()
    if (!id || id === 'id') continue

    // Nettoyage des préfixes Facebook
    const tel = String(row[col('phone_number')] ?? '').replace(/^p:/, '').trim()
    const cp  = String(row[col('zip_code')]     ?? '').replace(/^z:/, '').trim()

    // Date normalisée
    const rawDate  = row[col('created_time')]
    const createdAt = rawDate ? new Date(rawDate).toISOString() : null

    // Valeurs lisibles
    const projetRaw = String(row[col('quel_est_votre_projet_?')] ?? '').trim()
    const delaiRaw  = String(row[col('quel_est_votre_délai_pour_ce_projet_?')] ?? '').trim()

    const lead = {
      id,
      nom:         String(row[col('full_name')]    ?? '').trim(),
      tel,
      email:       String(row[col('email')]         ?? '').trim(),
      codePostal:  cp,
      createdAt,
      projet:      PROJETS[projetRaw]  ?? projetRaw.replace(/_/g, ' '),
      delai:       DELAIS[delaiRaw]    ?? delaiRaw.replace(/_/g, ' '),
      budget:      String(row[col('quel_serait_votre__budget_?_')] ?? '').trim(),
      campagne:    String(row[col('campaign_name')] ?? '').trim(),
      adName:      String(row[col('ad_name')]       ?? '').trim(),
      leadStatus:  String(row[col('lead_status')]   ?? '').trim(),
      // Champs CRM (défauts — écrasés par CRM_State si existants)
      status:      'prospect',
      priorité:    'moyenne',
      vendeur:     '',
      notes:       '',
      issueAppel:  '',
      rdvDate:     '',
      rdvTime:     '',
      rdvType:     '',
      rdvDuration: '',
      prochainRdv: '',
      archivedFrom: null,
      archivedAt:   null,
      updatedAt:    null,
    }

    // Fusionner avec l'état CRM si existant
    const crm = crmMap[id]
    if (crm) Object.assign(lead, crm)

    leads.push(lead)
  }

  // Tri : plus récent en premier
  leads.sort((a, b) => (b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : -1)
  return leads
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM_State — lecture / écriture
// ─────────────────────────────────────────────────────────────────────────────

const CRM_HEADERS = [
  'id', 'status', 'priorité', 'vendeur', 'notes', 'issueAppel',
  'rdvDate', 'rdvTime', 'rdvType', 'rdvDuration',
  'prochainRdv', 'archivedFrom', 'archivedAt', 'updatedAt'
]

function loadCrmState() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName(SHEET_CRM)
  if (!sheet || sheet.getLastRow() < 2) return {}

  const data = sheet.getDataRange().getValues()
  const map  = {}
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const id  = String(row[0]).trim()
    if (!id) continue
    map[id] = {
      status:       row[1]  || 'prospect',
      priorité:     row[2]  || 'moyenne',
      vendeur:      row[3]  || '',
      notes:        row[4]  || '',
      issueAppel:   row[5]  || '',
      rdvDate:      row[6]  || '',
      rdvTime:      row[7]  || '',
      rdvType:      row[8]  || '',
      rdvDuration:  row[9]  || '',
      prochainRdv:  row[10] || '',
      archivedFrom: row[11] || null,
      archivedAt:   row[12] || null,
      updatedAt:    row[13] || null,
    }
  }
  return map
}

function saveCrmState(lead) {
  if (!lead?.id) return null
  const ss    = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName(SHEET_CRM)
  if (!sheet) return null

  const data = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
    : []

  const ids = data.map(r => String(r[0]).trim())
  const idx = ids.indexOf(String(lead.id).trim())

  const row = [
    lead.id,
    lead.status       ?? 'prospect',
    lead.priorité     ?? 'moyenne',
    lead.vendeur      ?? '',
    lead.notes        ?? '',
    lead.issueAppel   ?? '',
    lead.rdvDate      ?? '',
    lead.rdvTime      ?? '',
    lead.rdvType      ?? '',
    lead.rdvDuration  ?? '',
    lead.prochainRdv  ?? '',
    lead.archivedFrom ?? '',
    lead.archivedAt   ?? '',
    new Date().toISOString(),
  ]

  if (idx >= 0) {
    sheet.getRange(idx + 2, 1, 1, row.length).setValues([row])
  } else {
    sheet.appendRow(row)
  }
  return lead
}

// ─────────────────────────────────────────────────────────────────────────────
// VUE VENDEUR — feuille lisible générée automatiquement
// ─────────────────────────────────────────────────────────────────────────────

function syncVueVendeur() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet()
  let vue   = ss.getSheetByName(SHEET_VENDEUR)
  if (!vue) vue = ss.insertSheet(SHEET_VENDEUR)

  const leads = getLeads()

  // En-têtes
  const headers = [
    '📅 Reçu le', '⏱️ J+', '🚦 Statut', '⚡ Priorité',
    '👤 Nom', '📞 Téléphone', '📧 Email', '📮 CP',
    '🎯 Projet', '⏰ Délai', '💰 Budget',
    '👔 Vendeur', '📝 Note', '📞 Appel 1', '📞 Appel 2', '📞 Appel 3',
    '🔁 Rappel', '📆 RDV', '🏁 Résultat',
  ]

  // Vider et réécrire
  vue.clearContents()
  vue.getRange(1, 1, 1, headers.length).setValues([headers])

  // Style en-têtes
  vue.getRange(1, 1, 1, headers.length)
    .setBackground('#1a1a2e')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
  vue.setFrozenRows(1)

  if (leads.length === 0) return

  const rows = leads.map(l => {
    const d   = l.createdAt ? new Date(l.createdAt) : null
    const pad = n => String(n).padStart(2, '0')
    const dateStr = d
      ? `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`
      : ''
    const age = d ? Math.floor((Date.now() - d.getTime()) / 86400000) : ''
    return [
      dateStr, age, l.status, l.priorité,
      l.nom, l.tel, l.email, l.codePostal,
      l.projet, l.delai, l.budget,
      l.vendeur, l.notes, l.rdvDate, '', '',
      l.prochainRdv, l.rdvDate, '',
    ]
  })

  vue.getRange(2, 1, rows.length, headers.length).setValues(rows)

  // Mise en forme conditionnelle statut (col C = 3)
  const statRange = vue.getRange('C2:C1000')
  const rules = [
    ['RDV OK',     '#34a853', '#fff'],
    ['CONTACTÉ',   '#4285f4', '#fff'],
    ['Répondeur',  '#fbbc04', '#000'],
    ['EN ATTENTE', '#ff9800', '#fff'],
    ['prospect',   '#e8eaed', '#444'],
    ['RDV KO',     '#ea4335', '#fff'],
    ['vendu',      '#0f9d58', '#fff'],
    ['archivé',    '#9e9e9e', '#fff'],
  ].map(([val, bg, fg]) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(val)
      .setBackground(bg)
      .setFontColor(fg)
      .setRanges([statRange])
      .build()
  )
  vue.setConditionalFormatRules(rules)
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP — initialisation (à exécuter une seule fois)
// ─────────────────────────────────────────────────────────────────────────────

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()

  // Créer CRM_State si elle n'existe pas
  if (!ss.getSheetByName(SHEET_CRM)) {
    const crm = ss.insertSheet(SHEET_CRM)
    crm.getRange(1, 1, 1, CRM_HEADERS.length).setValues([CRM_HEADERS])
    crm.getRange(1, 1, 1, CRM_HEADERS.length)
      .setBackground('#37474f')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
    crm.setFrozenRows(1)
  }

  // Générer la Vue Vendeur
  syncVueVendeur()

  SpreadsheetApp.getUi().alert(
    '✅ Setup terminé !\n\n' +
    '• Feuille CRM_State créée\n' +
    '• Vue Vendeur générée (' + getLeads().length + ' leads)\n\n' +
    'Prochaine étape : Déployer → Nouvelle déploiement → Application Web'
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DÉCLENCHEUR AUTO — sync Vue Vendeur quand Feuille 1 change
// ─────────────────────────────────────────────────────────────────────────────

function onLeadsChange(e) {
  try {
    if (e?.source?.getActiveSheet()?.getName() === SHEET_LEADS) {
      syncVueVendeur()
    }
  } catch (_) {}
}

function setupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onLeadsChange')
    .forEach(t => ScriptApp.deleteTrigger(t))

  ScriptApp.newTrigger('onLeadsChange')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onChange()
    .create()

  SpreadsheetApp.getUi().alert('✅ Déclencheur activé — Vue Vendeur se met à jour automatiquement !')
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST LOCAL (exécuter depuis l'éditeur Apps Script)
// ─────────────────────────────────────────────────────────────────────────────

function testGet() {
  const leads = getLeads()
  Logger.log('Leads trouvés : ' + leads.length)
  if (leads[0]) Logger.log(JSON.stringify(leads[0], null, 2))
}
