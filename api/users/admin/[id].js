const prisma = require('../../_lib/db')
const argon2 = require('argon2')
const { withAuth } = require('../../_lib/auth')

const HASH_OPTS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 }
const VALID_ROLES = ['OPERATIONS_SALES', 'PM', 'DEV_WEBFLOW', 'DEV_WORDPRESS']

async function handler(req, res) {
  const { id } = req.query
  if (req.method === 'PATCH')  return updateUser(req, res, id)
  if (req.method === 'DELETE') return deleteUser(req, res, id)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function updateUser(req, res, id) {
  const { sub } = req.user
  const { role, is_active, name, password } = req.body

  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Невалідна роль' })

  const data = {}
  if (role !== undefined) data.role = role
  if (is_active !== undefined) data.is_active = Boolean(is_active)
  if (name !== undefined) data.name = name || null
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

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES'] })
