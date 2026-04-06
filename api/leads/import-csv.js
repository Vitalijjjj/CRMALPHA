const prisma = require('../_lib/db')
const { withAuth } = require('../_lib/auth')
const { parseCSV } = require('../_lib/csv')

const VALID_STATUSES = new Set(['NEW', 'CONTACTED', 'PROPOSAL', 'WON', 'LOST'])

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { sub } = req.user

  // Accept CSV as plain text body or JSON { csv: "..." }
  let text = ''
  if (typeof req.body === 'string') {
    text = req.body
  } else if (req.body?.csv) {
    text = req.body.csv
  } else {
    return res.status(400).json({ error: 'Send CSV as plain text body or JSON { csv: "..." }' })
  }

  const rows = parseCSV(text)
  if (!rows.length) return res.status(400).json({ error: 'No valid rows found in CSV' })

  const errors = []
  const toCreate = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2 // +2 because row 1 is header

    if (!r.name) { errors.push(`Row ${rowNum}: missing name`); continue }
    if (!r.source) { errors.push(`Row ${rowNum}: missing source`); continue }

    const status = (r.status || 'NEW').toUpperCase()
    if (!VALID_STATUSES.has(status)) {
      errors.push(`Row ${rowNum}: invalid status "${r.status}"`); continue
    }

    const amount = parseFloat(r.amount) || 0
    toCreate.push({ name: r.name, source: r.source, status, amount, comment: r.comment || null, owner_id: sub })
  }

  if (!toCreate.length) {
    return res.status(400).json({ error: 'No valid rows to import', errors })
  }

  await prisma.lead.createMany({ data: toCreate })

  return res.status(201).json({
    imported: toCreate.length,
    skipped: errors.length,
    errors: errors.length ? errors : undefined,
  })
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES'] })
