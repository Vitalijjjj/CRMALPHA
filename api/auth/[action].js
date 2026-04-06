const argon2 = require('argon2')
const prisma = require('../_lib/db')
const { signAccess, signRefresh, verifyRefresh, setRefreshCookie, clearRefreshCookie } = require('../_lib/jwt')

const HASH_OPTS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 }
const VALID_ROLES = ['OPERATIONS_SALES', 'PM', 'DEV_WEBFLOW', 'DEV_WORDPRESS']

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  )
}

module.exports = async function handler(req, res) {
  const { action } = req.query

  if (action === 'login')   return login(req, res)
  if (action === 'register') return register(req, res)
  if (action === 'refresh') return refresh(req, res)
  if (action === 'logout')  return logout(req, res)

  return res.status(404).json({ error: 'Unknown auth action' })
}

// POST /api/auth/login
async function login(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await argon2.verify(user.password_hash, password)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const payload = { sub: user.id, email: user.email, role: user.role }
  setRefreshCookie(res, signRefresh(payload))

  return res.status(200).json({
    accessToken: signAccess(payload),
    user: { id: user.id, email: user.email, role: user.role, is_active: user.is_active },
  })
}

// POST /api/auth/register
async function register(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password, role } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ error: 'Email already in use' })

  const password_hash = await argon2.hash(password, HASH_OPTS)
  const assignedRole = role && VALID_ROLES.includes(role) ? role : 'OPERATIONS_SALES'

  const user = await prisma.user.create({
    data: { email, password_hash, role: assignedRole },
    select: { id: true, email: true, role: true, is_active: true },
  })

  const payload = { sub: user.id, email: user.email, role: user.role }
  setRefreshCookie(res, signRefresh(payload))

  return res.status(201).json({ accessToken: signAccess(payload), user })
}

// POST /api/auth/refresh
async function refresh(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = parseCookies(req)['refresh_token']
  if (!token) return res.status(401).json({ error: 'No refresh token' })

  let payload
  try { payload = verifyRefresh(token) }
  catch { return res.status(401).json({ error: 'Invalid or expired refresh token' }) }

  // Verify user still exists and session wasn't revoked by a password change
  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user || !user.is_active) return res.status(401).json({ error: 'Session expired' })

  // If token was issued before the last password update — force re-login
  if (payload.iat * 1000 < new Date(user.updated_at).getTime()) {
    clearRefreshCookie(res)
    return res.status(401).json({ error: 'Session expired. Please log in again.' })
  }

  const newPayload = { sub: user.id, email: user.email, role: user.role }
  setRefreshCookie(res, signRefresh(newPayload))

  return res.status(200).json({ accessToken: signAccess(newPayload) })
}

// POST /api/auth/logout
async function logout(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  clearRefreshCookie(res)
  return res.status(200).json({ message: 'Logged out' })
}
