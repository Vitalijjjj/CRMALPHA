const prisma = require('../_lib/db')
const { withAuth, FULL_ACCESS } = require('../_lib/auth')

async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'GET') return getProject(req, res, id)
  if (req.method === 'PUT') return updateProject(req, res, id)
  if (req.method === 'DELETE') return deleteProject(req, res, id)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function getProject(req, res, id) {
  const { role, sub } = req.user

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      pm: { select: { id: true, email: true } },
      dev: { select: { id: true, email: true } },
      members: {
        include: { user: { select: { id: true, email: true, role: true } } },
      },
      tasks: {
        include: {
          assignee: { select: { id: true, email: true } },
          creator: { select: { id: true, email: true } },
        },
        orderBy: { created_at: 'desc' },
      },
    },
  })

  if (!project) return res.status(404).json({ error: 'Project not found' })

  if (role === 'DEV_WEBFLOW' || role === 'DEV_WORDPRESS') {
    const expectedType = role === 'DEV_WEBFLOW' ? 'WEBFLOW' : 'WORDPRESS'
    if (project.type !== expectedType) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const isMember = project.members.some(m => m.user_id === sub)
    if (!isMember) return res.status(403).json({ error: 'Forbidden' })
  }

  return res.status(200).json(project)
}

async function updateProject(req, res, id) {
  const { role, sub } = req.user

  const project = await prisma.project.findUnique({
    where: { id },
    include: { members: true },
  })

  if (!project) return res.status(404).json({ error: 'Project not found' })

  if (!FULL_ACCESS.includes(role)) {
    const isMember = project.members.some(m => m.user_id === sub)
    if (!isMember) return res.status(403).json({ error: 'Forbidden' })

    const { progress } = req.body
    if (progress === undefined) {
      return res.status(403).json({ error: 'DEV roles can only update progress' })
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { progress: Math.min(100, Math.max(0, Number(progress))) },
    })
    return res.status(200).json(updated)
  }

  const { name, client, type, deadline, progress, status, pm_id, dev_id } = req.body

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(client !== undefined && { client }),
      ...(type !== undefined && { type }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(progress !== undefined && { progress: Math.min(100, Math.max(0, Number(progress))) }),
      ...(status !== undefined && { status }),
      ...(pm_id !== undefined && { pm_id: pm_id || null }),
      ...(dev_id !== undefined && { dev_id: dev_id || null }),
    },
    include: {
      pm: { select: { id: true, email: true } },
      dev: { select: { id: true, email: true } },
    },
  })

  return res.status(200).json(updated)
}

async function deleteProject(req, res, id) {
  const { role } = req.user

  if (role !== 'OPERATIONS_SALES') {
    return res.status(403).json({ error: 'Forbidden: only OPERATIONS_SALES can delete projects' })
  }

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return res.status(404).json({ error: 'Project not found' })

  await prisma.project.delete({ where: { id } })

  return res.status(200).json({ message: 'Project deleted' })
}

module.exports = withAuth(handler)
