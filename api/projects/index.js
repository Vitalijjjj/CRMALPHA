const prisma = require('../_lib/db')
const { withAuth, FULL_ACCESS } = require('../_lib/auth')

const PROJECT_SELECT = {
  id: true,
  name: true,
  client: true,
  type: true,
  deadline: true,
  progress: true,
  status: true,
  created_at: true,
  updated_at: true,
  pm: { select: { id: true, email: true } },
  dev: { select: { id: true, email: true } },
}

async function handler(req, res) {
  if (req.method === 'GET') return listProjects(req, res)
  if (req.method === 'POST') return createProject(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function listProjects(req, res) {
  const { role, sub } = req.user

  let where = { NOT: { name: '__PRIVATE_OPS__' } }

  if (role === 'DEV_WEBFLOW') {
    where = { type: 'WEBFLOW', members: { some: { user_id: sub } }, NOT: { name: '__PRIVATE_OPS__' } }
  } else if (role === 'DEV_WORDPRESS') {
    where = { type: 'WORDPRESS', members: { some: { user_id: sub } }, NOT: { name: '__PRIVATE_OPS__' } }
  }

  const projects = await prisma.project.findMany({
    where,
    select: PROJECT_SELECT,
    orderBy: { created_at: 'desc' },
  })

  return res.status(200).json(projects)
}

async function createProject(req, res) {
  const { role } = req.user

  if (!FULL_ACCESS.includes(role)) {
    return res.status(403).json({ error: 'Forbidden: only PM and OPERATIONS_SALES can create projects' })
  }

  const { name, client, type, deadline, pm_id, dev_id } = req.body

  if (!name || !client || !type) {
    return res.status(400).json({ error: 'name, client, and type are required' })
  }

  if (!['WEBFLOW', 'WORDPRESS'].includes(type)) {
    return res.status(400).json({ error: 'type must be WEBFLOW or WORDPRESS' })
  }

  const project = await prisma.project.create({
    data: {
      name,
      client,
      type,
      deadline: deadline ? new Date(deadline) : null,
      pm_id: pm_id || null,
      dev_id: dev_id || null,
    },
    select: PROJECT_SELECT,
  })

  return res.status(201).json(project)
}

module.exports = withAuth(handler)
