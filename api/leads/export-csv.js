const prisma = require('../_lib/db')
const { withAuth } = require('../_lib/auth')
const { toCSV } = require('../_lib/csv')

const COLUMNS = [
  { key: 'name',       label: 'name' },
  { key: 'source',     label: 'source' },
  { key: 'status',     label: 'status' },
  { key: 'amount',     label: 'amount' },
  { key: 'comment',    label: 'comment' },
  { key: 'owner',      label: 'owner_email' },
  { key: 'created_at', label: 'created_at' },
]

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const leads = await prisma.lead.findMany({
    include: { owner: { select: { email: true } } },
    orderBy: { created_at: 'desc' },
  })

  const rows = leads.map(l => ({
    ...l,
    owner: l.owner.email,
    created_at: l.created_at.toISOString().split('T')[0],
  }))

  const csv = toCSV(rows, COLUMNS)

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`)
  return res.status(200).send(csv)
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES'] })
