const prisma = require('../_lib/db')
const { withAuth } = require('../_lib/auth')

const PRIVATE_PROJECT_NAME = '__PRIVATE_OPS__'

async function getOrCreatePrivateProject() {
  let project = await prisma.project.findFirst({ where: { name: PRIVATE_PROJECT_NAME } })
  if (!project) {
    project = await prisma.project.create({
      data: { name: PRIVATE_PROJECT_NAME, client: 'internal', type: 'WEBFLOW', status: 'ACTIVE' },
    })
  }
  return project
}

async function handler(req, res) {
  const { id } = req.query

  // Single task operations
  if (id) {
    if (req.method === 'PATCH')  return updateTask(req, res, id)
    if (req.method === 'DELETE') return deleteTask(req, res, id)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Collection operations
  if (req.method === 'GET')  return listTasks(req, res)
  if (req.method === 'POST') return createTask(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function listTasks(req, res) {
  const project = await getOrCreatePrivateProject()
  const tasks = await prisma.task.findMany({
    where: { project_id: project.id },
    include: { creator: { select: { id: true, email: true, name: true } } },
    orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
  })
  return res.status(200).json(tasks)
}

async function createTask(req, res) {
  const { sub } = req.user
  const { title, priority, deadline } = req.body
  if (!title) return res.status(400).json({ error: 'Назва задачі обов\'язкова' })

  const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
  if (priority && !VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Невалідний пріоритет' })

  const project = await getOrCreatePrivateProject()
  const task = await prisma.task.create({
    data: {
      title, project_id: project.id, created_by: sub, assignee_id: sub,
      priority: priority || 'MEDIUM',
      deadline: deadline ? new Date(deadline) : null,
    },
    include: { creator: { select: { id: true, email: true, name: true } } },
  })
  return res.status(201).json(task)
}

async function updateTask(req, res, id) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { name: true } } },
  })
  if (!task || task.project.name !== PRIVATE_PROJECT_NAME) return res.status(404).json({ error: 'Задачу не знайдено' })

  const VALID_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']
  const { status, title, priority, deadline } = req.body
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Невалідний статус' })

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
  if (!task || task.project.name !== PRIVATE_PROJECT_NAME) return res.status(404).json({ error: 'Задачу не знайдено' })
  await prisma.task.delete({ where: { id } })
  return res.status(200).json({ message: 'Видалено' })
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES'] })
