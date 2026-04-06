const argon2 = require('argon2')
const prisma = require('../_lib/db')
const { signAccess, signRefresh, setRefreshCookie } = require('../_lib/jwt')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return res.status(409).json({ error: 'Email already in use' })
  }

  const password_hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  })

  const user = await prisma.user.create({
    data: { email, password_hash },
    select: { id: true, email: true, role: true, is_active: true },
  })

  const payload = { sub: user.id, email: user.email, role: user.role }
  const accessToken = signAccess(payload)
  const refreshToken = signRefresh(payload)

  setRefreshCookie(res, refreshToken)

  return res.status(201).json({ accessToken, user })
}
