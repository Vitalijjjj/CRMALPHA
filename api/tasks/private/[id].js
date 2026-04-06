const prisma = require('../../_lib/db')
const { withAuth } = require('../../_lib/auth')

const PRIVATE_PROJECT_NAME = '__PRIVATE_OPS__'

async function handler(req, res) {
  const { id } = req.query
  if (req.method === 'PATCH')  return updateTask(req, res, id)
  if (req.method === 'DELETE') return deleteTask(req, res, id)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function updateTask(req, res, id) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { name: true } } },
  })
  if (!task || task.project.name !== PRIVATE_PROJECT_NAME) {
    return res.status(404).json({ error: 'Задачу не знайдено' })
  }

  const VALID_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']
  const { status, title, priority, deadline } = req.body
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Невалідний статус' })
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(title !== undefined && { title }),
      ...(priority !== undefined && { priority }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
    },
    include: { creator: { select: { id: true, email: true, name: true } } },
  })
  return res.status(200).json(updated)
}

async function deleteTask(req, res, id) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { name: true } } },
  })
  if (!task || task.project.name !== PRIVATE_PROJECT_NAME) {
    return res.status(404).json({ error: 'Задачу не знайдено' })
  }
  await prisma.task.delete({ where: { id } })
  return res.status(200).json({ message: 'Видалено' })
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES'] })
