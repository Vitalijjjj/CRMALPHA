const prisma = require('../_lib/db')
const { withAuth, FULL_ACCESS } = require('../_lib/auth')

const VALID_TYPES = ['INCOME', 'EXPENSE']

async function handler(req, res) {
  if (req.method === 'GET') return listFinance(req, res)
  if (req.method === 'POST') return createRecord(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function listFinance(req, res) {
  const { role, sub } = req.user

  let where = {}

  if (role === 'PM') {
    // PM sees only records linked to their projects
    where = {
      project: { pm_id: sub },
    }
  }
  // OPERATIONS_SALES sees everything (no filter)

  const records = await prisma.financeRecord.findMany({
    where,
    include: {
      project: { select: { id: true, name: true } },
      lead:    { select: { id: true, name: true } },
      creator: { select: { id: true, email: true } },
    },
    orderBy: { date: 'desc' },
  })
  return res.status(200).json(records)
}

async function createRecord(req, res) {
  const { sub } = req.user
  const { type, project_id, lead_id, amount, date, category, description } = req.body

  if (!type || !amount || !date || !category || !description) {
    return res.status(400).json({ error: 'type, amount, date, category, description are required' })
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'type must be INCOME or EXPENSE' })
  }

  const record = await prisma.financeRecord.create({
    data: {
      type,
      amount: Number(amount),
      date: new Date(date),
      category,
      description,
      created_by: sub,
      project_id: project_id || null,
      lead_id: lead_id || null,
    },
    include: {
      project: { select: { id: true, name: true } },
      lead:    { select: { id: true, name: true } },
      creator: { select: { id: true, email: true } },
    },
  })
  return res.status(201).json(record)
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES', 'PM'] })
