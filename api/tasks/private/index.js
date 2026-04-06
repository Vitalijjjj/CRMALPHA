const prisma = require('../../_lib/db')
const { withAuth } = require('../../_lib/auth')

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
  if (req.method === 'GET')  return listPrivateTasks(req, res)
  if (req.method === 'POST') return createPrivateTask(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function listPrivateTasks(req, res) {
  const project = await getOrCreatePrivateProject()
  const tasks = await prisma.task.findMany({
    where: { project_id: project.id },
    include: {
      creator: { select: { id: true, email: true, name: true } },
    },
    orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
  })
  return res.status(200).json(tasks)
}

async function createPrivateTask(req, res) {
  const { sub } = req.user
  const { title, priority, deadline } = req.body
  if (!title) return res.status(400).json({ error: 'Назва задачі обов\'язкова' })

  const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Невалідний пріоритет' })
  }

  const project = await getOrCreatePrivateProject()
  const task = await prisma.task.create({
    data: {
      title,
      project_id: project.id,
      created_by: sub,
      assignee_id: sub,
      priority: priority || 'MEDIUM',
      deadline: deadline ? new Date(deadline) : null,
    },
    include: {
      creator: { select: { id: true, email: true, name: true } },
    },
  })
  return res.status(201).json(task)
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES'] })
