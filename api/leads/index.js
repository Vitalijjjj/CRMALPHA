const prisma = require('../_lib/db')
const { withAuth } = require('../_lib/auth')

const VALID_STATUSES = ['NEW', 'CONTACTED', 'PROPOSAL', 'WON', 'LOST']

async function handler(req, res) {
  if (req.method === 'GET') return listLeads(req, res)
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

  if (!name || !source) {
    return res.status(400).json({ error: 'name and source are required' })
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` })
  }

  const lead = await prisma.lead.create({
    data: {
      name,
      source,
      status: status || 'NEW',
      amount: amount ? Number(amount) : 0,
      comment: comment || null,
      owner_id: sub,
    },
    include: { owner: { select: { id: true, email: true } } },
  })
  return res.status(201).json(lead)
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES'] })
