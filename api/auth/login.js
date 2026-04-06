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

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const valid = await argon2.verify(user.password_hash, password)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const payload = { sub: user.id, email: user.email, role: user.role }
  const accessToken = signAccess(payload)
  const refreshToken = signRefresh(payload)

  setRefreshCookie(res, refreshToken)

  return res.status(200).json({
    accessToken,
    user: { id: user.id, email: user.email, role: user.role, is_active: user.is_active },
  })
}
