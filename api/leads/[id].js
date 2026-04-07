const prisma = require('../_lib/db')
const { withAuth } = require('../_lib/auth')

const LEAD_INCLUDE = {
  owner:     { select: { id: true, email: true } },
  status:    { select: { id: true, name: true, color: true } },
  source:    { select: { id: true, name: true } },
  direction: { select: { id: true, name: true } },
}

async function handler(req, res) {
  const { id, scope } = req.query

  if (scope === 'status')    return handleStatusItem(req, res, id)
  if (scope === 'source')    return handleSourceItem(req, res, id)
  if (scope === 'direction') return handleDirectionItem(req, res, id)

  if (req.method === 'PATCH')  return updateLead(req, res, id)
  if (req.method === 'DELETE') return deleteLead(req, res, id)
  return res.status(405).json({ error: 'Method not allowed' })
}

// ── Lead update / delete ──────────────────────────────────

async function updateLead(req, res, id) {
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return res.status(404).json({ error: 'Lead not found' })

  const { name, status_id, source_id, direction_id, telegram_username, amount, comment } = req.body

  const tg = telegram_username !== undefined
    ? (telegram_username ? telegram_username.replace(/^@/, '') : null)
    : undefined

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(status_id !== undefined && { status_id: status_id || null }),
      ...(source_id !== undefined && { source_id: source_id || null }),
      ...(direction_id !== undefined && { direction_id: direction_id || null }),
      ...(tg !== undefined && { telegram_username: tg }),
      ...(amount !== undefined && { amount: Number(amount) }),
      ...(comment !== undefined && { comment: comment || null }),
    },
    include: LEAD_INCLUDE,
  })
  return res.status(200).json(updated)
}

async function deleteLead(req, res, id) {
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return res.status(404).json({ error: 'Lead not found' })

  await prisma.lead.delete({ where: { id } })
  return res.status(200).json({ message: 'Lead deleted' })
}

// ── Status admin (PATCH/DELETE a LeadStatus by id) ────────

async function handleStatusItem(req, res, id) {
  if (req.method === 'PATCH') {
    const { name, color, sort_order, is_active } = req.body
    if (name) {
      const existing = await prisma.leadStatus.findFirst({ where: { name, NOT: { id } } })
      if (existing) return res.status(409).json({ error: 'Status with this name already exists' })
    }
    const updated = await prisma.leadStatus.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(sort_order !== undefined && { sort_order: Number(sort_order) }),
        ...(is_active !== undefined && { is_active: Boolean(is_active) }),
      },
    })
    return res.status(200).json(updated)
  }
  if (req.method === 'DELETE') {
    const status = await prisma.leadStatus.findUnique({ where: { id } })
    if (!status) return res.status(404).json({ error: 'Status not found' })
    // Unlink leads before deleting
    await prisma.lead.updateMany({ where: { status_id: id }, data: { status_id: null } })
    await prisma.leadStatus.delete({ where: { id } })
    return res.status(200).json({ message: 'Status deleted' })
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

// ── Source admin (PATCH/DELETE a LeadSource by id) ────────

async function handleSourceItem(req, res, id) {
  if (req.method === 'PATCH') {
    const { name, sort_order, is_active } = req.body
    if (name) {
      const existing = await prisma.leadSource.findFirst({ where: { name, NOT: { id } } })
      if (existing) return res.status(409).json({ error: 'Source with this name already exists' })
    }
    const updated = await prisma.leadSource.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(sort_order !== undefined && { sort_order: Number(sort_order) }),
        ...(is_active !== undefined && { is_active: Boolean(is_active) }),
      },
    })
    return res.status(200).json(updated)
  }
  if (req.method === 'DELETE') {
    const source = await prisma.leadSource.findUnique({ where: { id } })
    if (!source) return res.status(404).json({ error: 'Source not found' })
    // Unlink leads before deleting
    await prisma.lead.updateMany({ where: { source_id: id }, data: { source_id: null } })
    await prisma.leadSource.delete({ where: { id } })
    return res.status(200).json({ message: 'Source deleted' })
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

// ── Direction admin ───────────────────────────────────────

async function handleDirectionItem(req, res, id) {
  if (req.method === 'PATCH') {
    const { name, geo, method, tool, sort_order, is_active } = req.body
    if (name) {
      const existing = await prisma.leadDirection.findFirst({ where: { name, NOT: { id } } })
      if (existing) return res.status(409).json({ error: 'Direction with this name already exists' })
    }
    const updated = await prisma.leadDirection.update({
      where: { id },
      data: {
        ...(name       !== undefined && { name }),
        ...(geo        !== undefined && { geo: geo || null }),
        ...(method     !== undefined && { method: method || null }),
        ...(tool       !== undefined && { tool: tool || null }),
        ...(sort_order !== undefined && { sort_order: Number(sort_order) }),
        ...(is_active  !== undefined && { is_active: Boolean(is_active) }),
      },
    })
    return res.status(200).json(updated)
  }
  if (req.method === 'DELETE') {
    const dir = await prisma.leadDirection.findUnique({ where: { id } })
    if (!dir) return res.status(404).json({ error: 'Direction not found' })
    await prisma.lead.updateMany({ where: { direction_id: id }, data: { direction_id: null } })
    await prisma.leadDirection.delete({ where: { id } })
    return res.status(200).json({ message: 'Direction deleted' })
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES'] })
