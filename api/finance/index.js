const prisma = require('../_lib/db')
const { withAuth } = require('../_lib/auth')

const VALID_TYPES = ['INCOME', 'EXPENSE']

async function handler(req, res) {
  // GET /api/finance?summary=true
  if (req.method === 'GET' && req.query.summary === 'true') return getSummary(req, res)
  if (req.method === 'GET')  return listFinance(req, res)
  if (req.method === 'POST') return createRecord(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function listFinance(req, res) {
  const { role, sub } = req.user
  const where = role === 'PM' ? { project: { pm_id: sub } } : {}

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
      type, amount: Number(amount), date: new Date(date), category, description,
      created_by: sub, project_id: project_id || null, lead_id: lead_id || null,
    },
    include: {
      project: { select: { id: true, name: true } },
      lead:    { select: { id: true, name: true } },
      creator: { select: { id: true, email: true } },
    },
  })
  return res.status(201).json(record)
}

async function getSummary(req, res) {
  const { role, sub } = req.user
  const where = role === 'PM' ? { project: { pm_id: sub } } : {}

  const [incomeAgg, expenseAgg, byCategory, byMonth] = await Promise.all([
    prisma.financeRecord.aggregate({ where: { ...where, type: 'INCOME' },  _sum: { amount: true }, _count: true }),
    prisma.financeRecord.aggregate({ where: { ...where, type: 'EXPENSE' }, _sum: { amount: true }, _count: true }),
    prisma.financeRecord.groupBy({
      by: ['category', 'type'], where, _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } },
    }),
    prisma.financeRecord.findMany({
      where: { ...where, date: { gte: new Date(Date.now() - 180 * 86400000) } },
      select: { type: true, amount: true, date: true },
      orderBy: { date: 'asc' },
    }),
  ])

  const totalIncome  = incomeAgg._sum.amount  || 0
  const totalExpense = expenseAgg._sum.amount || 0

  const monthMap = {}
  for (const r of byMonth) {
    const key = r.date.toISOString().slice(0, 7)
    if (!monthMap[key]) monthMap[key] = { month: key, income: 0, expense: 0 }
    if (r.type === 'INCOME') monthMap[key].income += r.amount
    else monthMap[key].expense += r.amount
  }

  return res.status(200).json({
    total_income:  totalIncome,
    total_expense: totalExpense,
    profit:        totalIncome - totalExpense,
    income_count:  incomeAgg._count,
    expense_count: expenseAgg._count,
    by_category:   byCategory.map(c => ({ category: c.category, type: c.type, total: c._sum.amount })),
    by_month:      Object.values(monthMap),
  })
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES', 'PM'] })
