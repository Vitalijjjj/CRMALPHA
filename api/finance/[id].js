const prisma = require('../_lib/db')
const { withAuth } = require('../_lib/auth')

const VALID_TYPES = ['INCOME', 'EXPENSE']

async function handler(req, res) {
  const { id } = req.query
  if (req.method === 'PATCH') return updateRecord(req, res, id)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function updateRecord(req, res, id) {
  const { role, sub } = req.user

  const record = await prisma.financeRecord.findUnique({
    where: { id },
    include: { project: { select: { pm_id: true } } },
  })
  if (!record) return res.status(404).json({ error: 'Finance record not found' })

  // PM can only update records for their own projects
  if (role === 'PM') {
    if (!record.project || record.project.pm_id !== sub) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }

  const { type, project_id, lead_id, amount, date, category, description } = req.body

  if (type && !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'type must be INCOME or EXPENSE' })
  }

  const updated = await prisma.financeRecord.update({
    where: { id },
    data: {
      ...(type !== undefined && { type }),
      ...(amount !== undefined && { amount: Number(amount) }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(category !== undefined && { category }),
      ...(description !== undefined && { description }),
      ...(project_id !== undefined && { project_id: project_id || null }),
      ...(lead_id !== undefined && { lead_id: lead_id || null }),
    },
    include: {
      project: { select: { id: true, name: true } },
      lead:    { select: { id: true, name: true } },
      creator: { select: { id: true, email: true } },
    },
  })
  return res.status(200).json(updated)
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES', 'PM'] })
