const prisma = require('../../_lib/db')
const argon2 = require('argon2')
const { withAuth } = require('../../_lib/auth')

const HASH_OPTS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 }
const VALID_ROLES = ['OPERATIONS_SALES', 'PM', 'DEV_WEBFLOW', 'DEV_WORDPRESS']

async function handler(req, res) {
  if (req.method === 'GET')  return listUsers(req, res)
  if (req.method === 'POST') return createUser(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function listUsers(req, res) {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, avatar_url: true, role: true, is_active: true, created_at: true },
    orderBy: { created_at: 'asc' },
  })
  return res.status(200).json(users)
}

async function createUser(req, res) {
  const { email, password, role, name } = req.body

  if (!email || !password) return res.status(400).json({ error: 'Email та пароль обов\'язкові' })
  if (password.length < 8)  return res.status(400).json({ error: 'Пароль мінімум 8 символів' })
  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Невалідна роль' })

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ error: 'Email вже використовується' })

  const password_hash = await argon2.hash(password, HASH_OPTS)
  const user = await prisma.user.create({
    data: { email, password_hash, role: role || 'PM', name: name || null },
    select: { id: true, email: true, name: true, role: true, is_active: true, created_at: true },
  })
  return res.status(201).json(user)
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES'] })
