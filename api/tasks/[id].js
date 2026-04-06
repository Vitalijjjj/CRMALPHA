const prisma = require('../_lib/db')
const { withAuth, FULL_ACCESS } = require('../_lib/auth')
const { recalculateProgress } = require('../_lib/progress')

const VALID_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']

async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'PATCH') return updateTask(req, res, id)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function updateTask(req, res, id) {
  const { role, sub } = req.user

  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { id: true } } },
  })

  if (!task) return res.status(404).json({ error: 'Task not found' })

  const isAssignee = task.assignee_id === sub
  const hasFullAccess = FULL_ACCESS.includes(role)

  if (!isAssignee && !hasFullAccess) {
    return res.status(403).json({ error: 'Forbidden: only the assignee, PM or OPERATIONS_SALES can update task status' })
  }

  const { status } = req.body

  if (!status) return res.status(400).json({ error: 'status is required' })

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` })
  }

  const updated = await prisma.task.update({
    where: { id },
    data: { status },
    include: {
      assignee: { select: { id: true, email: true } },
      creator: { select: { id: true, email: true } },
      project: { select: { id: true, name: true, progress: true } },
    },
  })

  const progress = await recalculateProgress(task.project.id)

  return res.status(200).json({ ...updated, project: { ...updated.project, progress } })
}

module.exports = withAuth(handler)
