const prisma = require('../_lib/db')
const { withAuth } = require('../_lib/auth')
const { parseCSV, toCSV } = require('../_lib/csv')

const LEAD_INCLUDE = {
  owner:     { select: { id: true, email: true } },
  status:    { select: { id: true, name: true, color: true, funnel_stage: true } },
  source:    { select: { id: true, name: true } },
  direction: { select: { id: true, name: true } },
}

const CSV_COLUMNS = [
  { key: 'name',       label: 'name' },
  { key: 'source',     label: 'source' },
  { key: 'status',     label: 'status' },
  { key: 'amount',     label: 'amount' },
  { key: 'comment',    label: 'comment' },
  { key: 'telegram',   label: 'telegram' },
  { key: 'owner',      label: 'owner_email' },
  { key: 'created_at', label: 'created_at' },
]

async function handler(req, res) {
  const { export: doExport, import: doImport, scope } = req.query

  if (scope === 'statuses')   return handleStatuses(req, res)
  if (scope === 'sources')    return handleSources(req, res)
  if (scope === 'directions') return handleDirections(req, res)
  if (scope === 'stats')      return handleStats(req, res)

  if (req.method === 'GET' && doExport === 'csv') return exportCSV(req, res)
  if (req.method === 'POST' && doImport === 'csv') return importCSV(req, res)

  if (req.method === 'GET')  return listLeads(req, res)
  if (req.method === 'POST') return createLead(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

// ── Lead list & create ────────────────────────────────────

async function listLeads(req, res) {
  const leads = await prisma.lead.findMany({
    include: LEAD_INCLUDE,
    orderBy: { created_at: 'desc' },
  })
  return res.status(200).json(leads)
}

async function createLead(req, res) {
  const { sub } = req.user
  const { name, status_id, source_id, telegram_username, amount, comment } = req.body

  if (!name) return res.status(400).json({ error: 'name is required' })

  const tg = telegram_username ? telegram_username.replace(/^@/, '') : null

  const lead = await prisma.lead.create({
    data: {
      name,
      status_id: status_id || null,
      source_id: source_id || null,
      telegram_username: tg,
      amount: amount ? Number(amount) : 0,
      comment: comment || null,
      owner_id: sub,
    },
    include: LEAD_INCLUDE,
  })
  return res.status(201).json(lead)
}

// ── Statuses CRUD ─────────────────────────────────────────

async function handleStatuses(req, res) {
  if (req.method === 'GET') {
    const statuses = await prisma.leadStatus.findMany({ orderBy: { sort_order: 'asc' } })
    return res.status(200).json(statuses)
  }
  if (req.method === 'POST') {
    const { name, color, sort_order } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })
    const existing = await prisma.leadStatus.findUnique({ where: { name } })
    if (existing) return res.status(409).json({ error: 'Status with this name already exists' })
    const maxOrder = await prisma.leadStatus.aggregate({ _max: { sort_order: true } })
    const status = await prisma.leadStatus.create({
      data: { name, color: color || '#6B7280', sort_order: sort_order ?? (maxOrder._max.sort_order ?? -1) + 1 },
    })
    return res.status(201).json(status)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

// ── Sources CRUD ──────────────────────────────────────────

async function handleSources(req, res) {
  if (req.method === 'GET') {
    const sources = await prisma.leadSource.findMany({ orderBy: { sort_order: 'asc' } })
    return res.status(200).json(sources)
  }
  if (req.method === 'POST') {
    const { name, sort_order } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })
    const existing = await prisma.leadSource.findUnique({ where: { name } })
    if (existing) return res.status(409).json({ error: 'Source with this name already exists' })
    const maxOrder = await prisma.leadSource.aggregate({ _max: { sort_order: true } })
    const source = await prisma.leadSource.create({
      data: { name, sort_order: sort_order ?? (maxOrder._max.sort_order ?? -1) + 1 },
    })
    return res.status(201).json(source)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

// ── CSV export / import ───────────────────────────────────

async function exportCSV(req, res) {
  const leads = await prisma.lead.findMany({
    include: LEAD_INCLUDE,
    orderBy: { created_at: 'desc' },
  })
  const rows = leads.map(l => ({
    ...l,
    status: l.status?.name || '',
    source: l.source?.name || '',
    telegram: l.telegram_username || '',
    owner: l.owner.email,
    created_at: l.created_at.toISOString().split('T')[0],
  }))
  const csv = toCSV(rows, CSV_COLUMNS)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`)
  return res.status(200).send(csv)
}

async function importCSV(req, res) {
  const { sub } = req.user
  let text = typeof req.body === 'string' ? req.body : req.body?.csv || ''
  if (!text) return res.status(400).json({ error: 'Send CSV as plain text body or JSON { csv: "..." }' })

  const rows = parseCSV(text)
  if (!rows.length) return res.status(400).json({ error: 'No valid rows found in CSV' })

  // Load status/source maps
  const [allStatuses, allSources] = await Promise.all([
    prisma.leadStatus.findMany(),
    prisma.leadSource.findMany(),
  ])
  const statusMap = Object.fromEntries(allStatuses.map(s => [s.name.toLowerCase(), s.id]))
  const sourceMap = Object.fromEntries(allSources.map(s => [s.name.toLowerCase(), s.id]))

  const errors = []
  const toCreate = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2
    if (!r.name) { errors.push(`Row ${rowNum}: missing name`); continue }
    const status_id = r.status ? (statusMap[r.status.toLowerCase()] || null) : null
    const source_id = r.source ? (sourceMap[r.source.toLowerCase()] || null) : null
    const tg = r.telegram ? r.telegram.replace(/^@/, '') : null
    toCreate.push({ name: r.name, status_id, source_id, telegram_username: tg, amount: parseFloat(r.amount) || 0, comment: r.comment || null, owner_id: sub })
  }

  if (!toCreate.length) return res.status(400).json({ error: 'No valid rows to import', errors })

  await prisma.lead.createMany({ data: toCreate })
  return res.status(201).json({ imported: toCreate.length, skipped: errors.length, errors: errors.length ? errors : undefined })
}

// ── Directions CRUD ───────────────────────────────────────

async function handleDirections(req, res) {
  if (req.method === 'GET') {
    const directions = await prisma.leadDirection.findMany({ orderBy: { sort_order: 'asc' } })
    return res.status(200).json(directions)
  }
  if (req.method === 'POST') {
    const { name, geo, method, tool, sort_order } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })
    const existing = await prisma.leadDirection.findUnique({ where: { name } })
    if (existing) return res.status(409).json({ error: 'Direction with this name already exists' })
    const maxOrder = await prisma.leadDirection.aggregate({ _max: { sort_order: true } })
    const direction = await prisma.leadDirection.create({
      data: { name, geo: geo||null, method: method||null, tool: tool||null, sort_order: sort_order ?? (maxOrder._max.sort_order ?? -1) + 1 },
    })
    return res.status(201).json(direction)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

// ── Stats ─────────────────────────────────────────────────

const CALL_STAGES        = ['call','proposal','interested','not_interested','thinking','sold']
const PROPOSAL_STAGES    = ['proposal','interested','not_interested','thinking','sold']
const INTERESTED_STAGES  = ['interested']
const NOTINT_STAGES      = ['not_interested']
const THINKING_STAGES    = ['thinking']
const SOLD_STAGES        = ['sold']

function pct(a, b) { return b === 0 ? 0 : Math.round(a * 1000 / b) / 10 }

async function handleStats(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { from, to, manager_id } = req.query
  const dateFilter = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(to + 'T23:59:59Z') } : {}),
  }
  const where = {
    ...(Object.keys(dateFilter).length ? { created_at: dateFilter } : {}),
    ...(manager_id ? { owner_id: manager_id } : {}),
  }

  // Load all leads with status funnel_stage
  const leads = await prisma.lead.findMany({
    where,
    include: {
      status:    { select: { funnel_stage: true } },
      direction: { select: { id: true, name: true, geo: true, method: true } },
      owner:     { select: { id: true, email: true, name: true } },
    },
  })

  // Group by direction
  const dirMap = {}
  const allDirections = await prisma.leadDirection.findMany({ where: { is_active: true }, orderBy: { sort_order: 'asc' } })
  allDirections.forEach(d => {
    dirMap[d.id] = { direction_id: d.id, direction: d.name, geo: d.geo, method: d.method,
      total_contacted: 0, total_calls: 0, total_proposals: 0, total_interested: 0,
      total_not_interested: 0, total_thinking: 0, total_sold: 0, revenue: 0 }
  })
  // Bucket for leads without direction
  dirMap['__none__'] = { direction_id: null, direction: 'Без напрямку', geo: null, method: null,
    total_contacted: 0, total_calls: 0, total_proposals: 0, total_interested: 0,
    total_not_interested: 0, total_thinking: 0, total_sold: 0, revenue: 0 }

  let kpi = { total_contacted:0, total_calls:0, total_proposals:0, total_interested:0,
    total_not_interested:0, total_thinking:0, total_sold:0, revenue:0 }

  for (const lead of leads) {
    const stage = lead.status?.funnel_stage || 'contacted'
    const key = lead.direction_id || '__none__'
    if (!dirMap[key]) continue
    const row = dirMap[key]

    row.total_contacted++
    kpi.total_contacted++

    if (CALL_STAGES.includes(stage))     { row.total_calls++;        kpi.total_calls++ }
    if (PROPOSAL_STAGES.includes(stage)) { row.total_proposals++;    kpi.total_proposals++ }
    if (stage === 'interested')          { row.total_interested++;   kpi.total_interested++ }
    if (stage === 'not_interested')      { row.total_not_interested++; kpi.total_not_interested++ }
    if (stage === 'thinking')            { row.total_thinking++;     kpi.total_thinking++ }
    if (stage === 'sold')                { row.total_sold++; row.revenue += lead.amount; kpi.total_sold++; kpi.revenue += lead.amount }
  }

  // Compute conversions per row
  const directions = Object.values(dirMap)
    .filter(r => r.total_contacted > 0 || r.direction_id !== null)
    .map(r => ({
      ...r,
      conv_to_call:     pct(r.total_calls,     r.total_contacted),
      conv_to_proposal: pct(r.total_proposals, r.total_calls),
      conv_to_sold:     pct(r.total_sold,      r.total_proposals),
      conv_total:       pct(r.total_sold,      r.total_contacted),
    }))

  const kpiWithConv = {
    ...kpi,
    conv_to_call:     pct(kpi.total_calls,     kpi.total_contacted),
    conv_to_proposal: pct(kpi.total_proposals, kpi.total_calls),
    conv_to_sold:     pct(kpi.total_sold,      kpi.total_proposals),
    conv_total:       pct(kpi.total_sold,      kpi.total_contacted),
  }

  return res.status(200).json({ kpi: kpiWithConv, directions, period: { from: from||null, to: to||null } })
}

module.exports = withAuth(handler, { roles: ['OPERATIONS_SALES'] })
