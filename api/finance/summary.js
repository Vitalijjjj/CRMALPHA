const prisma = require('../_lib/db')
const { withAuth } = require('../_lib/auth')

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { role, sub } = req.user

  const where = role === 'PM' ? { project: { pm_id: sub } } : {}

  const [incomeAgg, expenseAgg, byCategory, byMonth] = await Promise.all([
    prisma.financeRecord.aggregate({
      where: { ...where, type: 'INCOME' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.financeRecord.aggregate({
      where: { ...where, type: 'EXPENSE' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.financeRecord.groupBy({
      by: ['category', 'type'],
      where,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    }),
    // Last 6 months breakdown
    prisma.financeRecord.findMany({
      where: {
        ...where,
        date: { gte: new Date(Date.now() - 180 * 86400000) },
      },
      select: { type: true, amount: true, date: true },
      orderBy: { date: 'asc' },
    }),
  ])

  const totalIncome  = incomeAgg._sum.amount  || 0
  const totalExpense = expenseAgg._sum.amount || 0

  // Aggregate by month
  const monthMap = {}
  for (const r of byMonth) {
    const key = r.date.toISOString().slice(0, 7) // "YYYY-MM"
    if (!monthMap[key]) monthMap[key] = { month: key, income: 0, expense: 0 }
    if (r.type === 'INCOME') monthMap[key].income += r.amount
    else monthMap[key].expense += r.amount
  }

  return res.status(200).json({
    total_income:   totalIncome,
    total_expense:  totalExpense,
    profit:         totalIncome - totalExpense,
    income_count:   incomeAgg._count,
    expense_count:  expenseAgg._count,
    by_category:    byCategory.map(c => ({ category: c.category, type: c.type, total: c._sum.amount })),
    by_month:       Object.values(monthMap),
  })
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES', 'PM'] })
