/**
 * RevSpeed CRM — Google Apps Script
 * Concession Honda Renneville (Villemomble)
 * 
 * Ce script expose une API REST depuis le Google Sheet du client.
 * RevSpeed CRM l'appelle pour lire et sauvegarder l'état des leads.
 * 
 * DÉPLOIEMENT :
 *   1. Ouvrir le Google Sheet Honda
 *   2. Extensions → Apps Script → coller ce code
 *   3. Déployer → Nouveau déploiement → Application Web
 *      - Exécuter en tant que : Moi
 *      - Accès : Tout le monde
 *   4. Copier l'URL → variable VITE_GAS_ENDPOINT sur Vercel
 *
 * SÉCURITÉ :
 *   Apps Script → Paramètres du projet → Variables de script
 *   Nom : API_TOKEN  |  Valeur : Honda_RS_2024!
 */

const SHEET_NAME     = 'Feuille 1'
const CRM_SHEET_NAME = 'CRM_State'
const SHEET_ID       = '1z52oCDZUPpOf58FjpaBFcECdFICn6GTDwdvZUJzqY6k'

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID)
  return ss.getSheetByName(name) || ss.insertSheet(name)
}

function ok(data)  { return ContentService.createTextOutput(JSON.stringify({ ok: true,  data })).setMimeType(ContentService.MimeType.JSON) }
function err(msg)  { return ContentService.createTextOutput(JSON.stringify({ ok: false, error: msg })).setMimeType(ContentService.MimeType.JSON) }

function checkToken(params) {
  const token = PropertiesService.getScriptProperties().getProperty('API_TOKEN')
  if (!token) return true
  return params.token === token
}

function normalizeRow(headers, row) {
  const r = {}
  headers.forEach((h, i) => { r[h] = row[i] ?? '' })
  const tel = String(r.phone ?? '').replace(/^p:/, '').trim()
  let createdAt = Date.now()
  try { if (r.created_time) createdAt = new Date(r.created_time).getTime() } catch(_) {}
  return {
    id:           String(r.id ?? ''),
    nom:          String(r.first_name ?? '').trim(),
    tel,
    email:        String(r.email ?? '').trim(),
    createdAt,
    intention:    String(r['vous_souhaitez_:_'] ?? '').replace(/_/g, ' ').trim(),
    adName:       String(r.ad_name ?? '').trim(),
    campaignName: String(r.campaign_name ?? '').trim(),
    leadStatus:   String(r.lead_status ?? '').trim(),
    status:       'prospect',
    priorité:     'moyenne',
    vendeur:      '',
    notes:        '',
    issueAppel:   '',
    rdvDate:      '',
    rdvTime:      '',
    rdvType:      '',
    archivedFrom: '',
    archivedAt:   '',
    updatedAt:    '',
  }
}

function doGet(e) {
  if (!checkToken(e.parameter)) return err('Unauthorized')
  try {
    const fbSheet = getSheet(SHEET_NAME)
    const fbData  = fbSheet.getDataRange().getValues()
    if (fbData.length < 2) return ok([])
    const headers = fbData[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_'))
    const leads   = fbData.slice(1)
      .map(row => normalizeRow(headers, row))
      .filter(l => l.id && !l.nom.toLowerCase().includes('test lead'))

    const crmSheet = getSheet(CRM_SHEET_NAME)
    const crmData  = crmSheet.getDataRange().getValues()
    const crmMap   = {}
    if (crmData.length > 1) {
      const crmHeaders = crmData[0]
      crmData.slice(1).forEach(row => {
        const id = String(row[0])
        const state = {}
        crmHeaders.forEach((h, i) => { state[h] = row[i] })
        crmMap[id] = state
      })
    }

    const CRM_FIELDS = ['status','priorité','vendeur','notes','issueAppel',
      'rdvDate','rdvTime','rdvType','archivedFrom','archivedAt','updatedAt']

    const merged = leads.map(lead => {
      const crm = crmMap[lead.id]
      if (!crm) return lead
      const overrides = {}
      CRM_FIELDS.forEach(f => { if (crm[f] !== undefined && crm[f] !== '') overrides[f] = crm[f] })
      return { ...lead, ...overrides }
    })

    return ok(merged)
  } catch(ex) { return err(String(ex)) }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    if (!checkToken(body)) return err('Unauthorized')
    const { action, leads, lead } = body
    if (action === 'saveAll' && Array.isArray(leads)) {
      saveCrmState(leads)
      return ok({ saved: leads.length })
    }
    if (action === 'updateLead' && lead) {
      updateCrmLead(lead)
      return ok({ updated: lead.id })
    }
    return err('Action inconnue')
  } catch(ex) { return err(String(ex)) }
}

const CRM_COLS = ['id','status','priorité','vendeur','notes','issueAppel',
  'rdvDate','rdvTime','rdvType','archivedFrom','archivedAt','updatedAt']

function saveCrmState(leads) {
  const sheet = getSheet(CRM_SHEET_NAME)
  sheet.clearContents()
  sheet.appendRow(CRM_COLS)
  const rows = leads.map(l => CRM_COLS.map(c => l[c] ?? ''))
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, CRM_COLS.length).setValues(rows)
}

function updateCrmLead(lead) {
  const sheet = getSheet(CRM_SHEET_NAME)
  const data  = sheet.getDataRange().getValues()
  if (data.length === 0) {
    sheet.appendRow(CRM_COLS)
    sheet.appendRow(CRM_COLS.map(c => lead[c] ?? ''))
    return
  }
  const ids = data.slice(1).map(r => String(r[0]))
  const idx = ids.indexOf(String(lead.id))
  if (idx >= 0) {
    const rowNum = idx + 2
    CRM_COLS.forEach((col, i) => {
      if (lead[col] !== undefined) sheet.getRange(rowNum, i + 1).setValue(lead[col])
    })
  } else {
    sheet.appendRow(CRM_COLS.map(c => lead[c] ?? ''))
  }
}

function testGet() {
  const result = doGet({ parameter: { token: PropertiesService.getScriptProperties().getProperty('API_TOKEN') } })
  Logger.log(result.getContent().substring(0, 500))
}
