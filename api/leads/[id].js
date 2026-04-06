const prisma = require('../_lib/db')
const { withAuth } = require('../_lib/auth')

const VALID_STATUSES = ['NEW', 'CONTACTED', 'PROPOSAL', 'WON', 'LOST']

async function handler(req, res) {
  const { id } = req.query
  if (req.method === 'PATCH') return updateLead(req, res, id)
  if (req.method === 'DELETE') return deleteLead(req, res, id)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function updateLead(req, res, id) {
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return res.status(404).json({ error: 'Lead not found' })

  const { name, source, status, amount, comment } = req.body

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` })
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(source !== undefined && { source }),
      ...(status !== undefined && { status }),
      ...(amount !== undefined && { amount: Number(amount) }),
      ...(comment !== undefined && { comment: comment || null }),
    },
    include: { owner: { select: { id: true, email: true } } },
  })
  return res.status(200).json(updated)
}

async function deleteLead(req, res, id) {
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return res.status(404).json({ error: 'Lead not found' })

  await prisma.lead.delete({ where: { id } })
  return res.status(200).json({ message: 'Lead deleted' })
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES'] })
