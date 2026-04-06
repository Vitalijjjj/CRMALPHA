const prisma = require('../_lib/db')
const { withAuth } = require('../_lib/auth')
const { parseCSV, toCSV } = require('../_lib/csv')

const VALID_STATUSES = new Set(['NEW', 'CONTACTED', 'PROPOSAL', 'WON', 'LOST'])

const CSV_COLUMNS = [
  { key: 'name',       label: 'name' },
  { key: 'source',     label: 'source' },
  { key: 'status',     label: 'status' },
  { key: 'amount',     label: 'amount' },
  { key: 'comment',    label: 'comment' },
  { key: 'owner',      label: 'owner_email' },
  { key: 'created_at', label: 'created_at' },
]

async function handler(req, res) {
  const { export: doExport, import: doImport } = req.query

  // GET /api/leads?export=csv
  if (req.method === 'GET' && doExport === 'csv') return exportCSV(req, res)
  // POST /api/leads?import=csv
  if (req.method === 'POST' && doImport === 'csv') return importCSV(req, res)

  if (req.method === 'GET')  return listLeads(req, res)
  if (req.method === 'POST') return createLead(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function listLeads(req, res) {
  const leads = await prisma.lead.findMany({
    include: { owner: { select: { id: true, email: true } } },
    orderBy: { created_at: 'desc' },
  })
  return res.status(200).json(leads)
}

async function createLead(req, res) {
  const { sub } = req.user
  const { name, source, status, amount, comment } = req.body

  if (!name || !source) return res.status(400).json({ error: 'name and source are required' })
  if (status && !VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` })
  }

  const lead = await prisma.lead.create({
    data: { name, source, status: status || 'NEW', amount: amount ? Number(amount) : 0, comment: comment || null, owner_id: sub },
    include: { owner: { select: { id: true, email: true } } },
  })
  return res.status(201).json(lead)
}

async function exportCSV(req, res) {
  const leads = await prisma.lead.findMany({
    include: { owner: { select: { email: true } } },
    orderBy: { created_at: 'desc' },
  })
  const rows = leads.map(l => ({ ...l, owner: l.owner.email, created_at: l.created_at.toISOString().split('T')[0] }))
  const csv = toCSV(rows, CSV_COLUMNS)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`)
  return res.status(200).send(csv)
}

async function importCSV(req, res) {
  const { sub } = req.user
  let text = typeof req.body === 'string' ? req.body : req.body?.csv || ''
  if (!text) return res.status(400).json({ error: 'Send CSV as plain text body or JSON { csv: "..." }' })

  const rows = parseCSV(text)
  if (!rows.length) return res.status(400).json({ error: 'No valid rows found in CSV' })

  const errors = []
  const toCreate = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2
    if (!r.name)   { errors.push(`Row ${rowNum}: missing name`);   continue }
    if (!r.source) { errors.push(`Row ${rowNum}: missing source`); continue }
    const status = (r.status || 'NEW').toUpperCase()
    if (!VALID_STATUSES.has(status)) { errors.push(`Row ${rowNum}: invalid status "${r.status}"`); continue }
    toCreate.push({ name: r.name, source: r.source, status, amount: parseFloat(r.amount) || 0, comment: r.comment || null, owner_id: sub })
  }

  if (!toCreate.length) return res.status(400).json({ error: 'No valid rows to import', errors })

  await prisma.lead.createMany({ data: toCreate })
  return res.status(201).json({ imported: toCreate.length, skipped: errors.length, errors: errors.length ? errors : undefined })
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES'] })
