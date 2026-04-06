const prisma = require('../../_lib/db')
const { withAuth, FULL_ACCESS } = require('../../_lib/auth')
const { recalculateProgress } = require('../../_lib/progress')

async function handler(req, res) {
  const { id: projectId } = req.query

  if (req.method === 'GET') return listTasks(req, res, projectId)
  if (req.method === 'POST') return createTask(req, res, projectId)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function getProjectWithMembership(projectId, userId) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: { members: { select: { user_id: true } } },
  })
}

async function listTasks(req, res, projectId) {
  const { role, sub } = req.user

  const project = await getProjectWithMembership(projectId, sub)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const isMember = project.members.some(m => m.user_id === sub)

  if (!FULL_ACCESS.includes(role) && !isMember) {
    return res.status(403).json({ error: 'Forbidden: you are not a member of this project' })
  }

  const tasks = await prisma.task.findMany({
    where: { project_id: projectId },
    include: {
      assignee: { select: { id: true, email: true, role: true } },
      creator: { select: { id: true, email: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
  })

  return res.status(200).json(tasks)
}

async function createTask(req, res, projectId) {
  const { role, sub } = req.user

  const project = await getProjectWithMembership(projectId, sub)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const isMember = project.members.some(m => m.user_id === sub)

  if (!FULL_ACCESS.includes(role) && !isMember) {
    return res.status(403).json({ error: 'Forbidden: you are not a member of this project' })
  }

  const { title, assignee_id, priority, deadline } = req.body

  if (!title) {
    return res.status(400).json({ error: 'title is required' })
  }

  const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` })
  }

  const task = await prisma.task.create({
    data: {
      title,
      project_id: projectId,
      created_by: sub,
      assignee_id: assignee_id || null,
      priority: priority || 'MEDIUM',
      deadline: deadline ? new Date(deadline) : null,
    },
    include: {
      assignee: { select: { id: true, email: true } },
      creator: { select: { id: true, email: true } },
    },
  })

  await recalculateProgress(projectId)

  return res.status(201).json(task)
}

module.exports = withAuth(handler)
