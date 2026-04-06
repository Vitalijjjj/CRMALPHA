const prisma = require('../_lib/db')
const argon2 = require('argon2')
const { withAuth } = require('../_lib/auth')

const HASH_OPTS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 }
const VALID_ROLES = ['OPERATIONS_SALES', 'PM', 'DEV_WEBFLOW', 'DEV_WORDPRESS']

async function handler(req, res) {
  const { scope, id } = req.query

  // Own profile
  if (scope === 'profile') {
    if (req.method === 'GET')   return getProfile(req, res)
    if (req.method === 'PATCH') return updateProfile(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Admin user management (ops_sales only)
  if (scope === 'admin') {
    if (req.user.role !== 'OPERATIONS_SALES') return res.status(403).json({ error: 'Forbidden' })
    if (id) {
      if (req.method === 'PATCH')  return updateUser(req, res, id)
      if (req.method === 'DELETE') return deleteUser(req, res, id)
      return res.status(405).json({ error: 'Method not allowed' })
    }
    if (req.method === 'GET')  return listUsersAdmin(req, res)
    if (req.method === 'POST') return createUser(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Default: simple list for dropdowns
  if (req.method === 'GET') return listUsers(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function listUsers(req, res) {
  const users = await prisma.user.findMany({
    where: { is_active: true },
    select: { id: true, email: true, name: true, role: true },
    orderBy: { email: 'asc' },
  })
  return res.status(200).json(users)
}

async function listUsersAdmin(req, res) {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, avatar_url: true, role: true, is_active: true, created_at: true },
    orderBy: { created_at: 'asc' },
  })
  return res.status(200).json(users)
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
    if (existing && existing.id !== sub) return res.status(409).json({ error: 'Email вже використовується' })
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

async function updateUser(req, res, id) {
  const { role, is_active, name, password } = req.body
  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Невалідна роль' })
  const data = {}
  if (role !== undefined)      data.role = role
  if (is_active !== undefined) data.is_active = Boolean(is_active)
  if (name !== undefined)      data.name = name || null
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Пароль мінімум 8 символів' })
    data.password_hash = await argon2.hash(password, HASH_OPTS)
    data.updated_at = new Date()
  }
  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, is_active: true },
  })
  return res.status(200).json(user)
}

async function deleteUser(req, res, id) {
  const { sub } = req.user
  if (id === sub) return res.status(400).json({ error: 'Не можна видалити себе' })
  await prisma.user.delete({ where: { id } })
  return res.status(200).json({ message: 'Користувача видалено' })
}

module.exports = withAuth(handler)
