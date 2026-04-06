const prisma = require('../_lib/db')
const { withAuth } = require('../_lib/auth')

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const users = await prisma.user.findMany({
    where: { is_active: true },
    select: { id: true, email: true, role: true },
    orderBy: { email: 'asc' },
  })

  return res.status(200).json(users)
}

module.exports = withAuth(handler)
