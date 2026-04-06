const prisma = require('../../_lib/db')
const { withAuth } = require('../../_lib/auth')

async function handler(req, res) {
  if (req.method === 'GET')   return getProfile(req, res)
  if (req.method === 'PATCH') return updateProfile(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function getProfile(req, res) {
  const { sub } = req.user
  const user = await prisma.user.findUnique({
    where: { id: sub },
    select: { id: true, email: true, name: true, avatar_url: true, role: true },
  })
  return res.status(200).json(user)
}

async function updateProfile(req, res) {
  const { sub } = req.user
  const { name, avatar_url, email } = req.body

  if (email && email !== req.user.email) {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing && existing.id !== sub) {
      return res.status(409).json({ error: 'Email вже використовується' })
    }
  }

  const user = await prisma.user.update({
    where: { id: sub },
    data: {
      ...(name !== undefined && { name: name || null }),
      ...(avatar_url !== undefined && { avatar_url: avatar_url || null }),
      ...(email && { email }),
    },
    select: { id: true, email: true, name: true, avatar_url: true, role: true },
  })

  return res.status(200).json(user)
}

module.exports = withAuth(handler)
