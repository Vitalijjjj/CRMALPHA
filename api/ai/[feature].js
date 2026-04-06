const Anthropic = require('@anthropic-ai/sdk')
const prisma = require('../_lib/db')
const { withAuth } = require('../_lib/auth')
const { checkRateLimit, DAILY_LIMIT } = require('../_lib/ratelimit')

const MODEL = 'claude-sonnet-4-20250514'
const MAX_TOKENS = 1024

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

module.exports = withAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { feature } = req.query
  if (feature === 'analyze')       return analyze(req, res)
  if (feature === 'generate-spec') return generateSpec(req, res)
  return res.status(404).json({ error: 'Unknown AI feature' })
})

// ─── POST /api/ai/analyze — OPERATIONS_SALES only ────────────────────────────
async function analyze(req, res) {
  const { role, sub } = req.user

  if (role !== 'OPERATIONS_SALES') {
    return res.status(403).json({ error: 'Forbidden: OPERATIONS_SALES only' })
  }

  const { question } = req.body
  if (!question?.trim()) return res.status(400).json({ error: 'question is required' })

  // Rate limit
  const limit = await checkRateLimit(sub)
  if (!limit.allowed) {
    return res.status(429).json({
      error: `Daily AI limit reached (${DAILY_LIMIT} requests/day). Try again tomorrow.`,
      remaining: 0,
    })
  }

  // Gather live data from DB
  const now = new Date()
  const [projects, overdueTasks, leads, finance] = await Promise.all([
    prisma.project.findMany({
      select: { name: true, client: true, type: true, status: true, progress: true, deadline: true },
      orderBy: { created_at: 'desc' },
    }),
    prisma.task.findMany({
      where: { status: { not: 'DONE' }, deadline: { lt: now } },
      include: {
        project: { select: { name: true } },
        assignee: { select: { email: true } },
      },
      orderBy: { deadline: 'asc' },
    }),
    prisma.lead.findMany({
      select: { name: true, status: true, amount: true, source: true },
      orderBy: { created_at: 'desc' },
      take: 20,
    }),
    prisma.financeRecord.groupBy({
      by: ['type'],
      _sum: { amount: true },
    }),
  ])

  const income  = finance.find(f => f.type === 'INCOME')?._sum?.amount  || 0
  const expense = finance.find(f => f.type === 'EXPENSE')?._sum?.amount || 0

  const context = buildAnalyticsContext({ projects, overdueTasks, leads, income, expense })

  const prompt = `Ти — бізнес-аналітик агентства. Відповідай ВИКЛЮЧНО українською мовою.

Актуальні дані агентства:
${context}

Питання від менеджера: ${question}

Надай стислий executive summary (до 300 слів). Виділи критичні проблеми, що потребують негайних дій, та конкретні рекомендації.`

  const client = getClient()
  if (!client) {
    return res.status(503).json({ error: 'AI недоступний: ANTHROPIC_API_KEY не налаштовано' })
  }

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    })

    const tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
    const result = message.content[0]?.text || ''

    await prisma.aiLog.create({
      data: { user_id: sub, feature: 'analyze', tokens_used: tokensUsed },
    })

    return res.status(200).json({
      result,
      tokens_used: tokensUsed,
      remaining_requests: limit.remaining - 1,
    })
  } catch (err) {
    console.error('Anthropic error:', err.message)
    return res.status(502).json({ error: 'AI сервіс тимчасово недоступний. Спробуйте пізніше.' })
  }
}

// ─── POST /api/ai/generate-spec — PM only ────────────────────────────────────
async function generateSpec(req, res) {
  const { role, sub } = req.user

  if (role !== 'PM' && role !== 'OPERATIONS_SALES') {
    return res.status(403).json({ error: 'Forbidden: PM or OPERATIONS_SALES only' })
  }

  const { brief, project_id, notes } = req.body
  if (!brief?.trim()) return res.status(400).json({ error: 'brief is required' })

  // Rate limit
  const limit = await checkRateLimit(sub)
  if (!limit.allowed) {
    return res.status(429).json({
      error: `Daily AI limit reached (${DAILY_LIMIT} requests/day). Try again tomorrow.`,
      remaining: 0,
    })
  }

  // Optionally fetch project context
  let projectContext = ''
  if (project_id) {
    const project = await prisma.project.findUnique({
      where: { id: project_id },
      select: { name: true, client: true, type: true, deadline: true },
    })
    if (project) {
      projectContext = `\nПроєкт: ${project.name} | Клієнт: ${project.client} | Тип: ${project.type}${project.deadline ? ` | Дедлайн: ${project.deadline.toISOString().split('T')[0]}` : ''}`
    }
  }

  const prompt = `Ти — досвідчений проєктний менеджер IT-агентства. Відповідай ВИКЛЮЧНО українською мовою.
${projectContext}

Бриф від клієнта:
${brief}
${notes ? `\nДодаткові нотатки:\n${notes}` : ''}

Згенеруй структуроване Технічне завдання (ТЗ) у такому форматі:

# [Назва проєкту]

## Мета
[Чітко сформульована ціль проєкту — 2-3 речення]

## Опис
[Загальний опис продукту — що це, для кого, яку проблему вирішує]

## Функціонал
[Маркований список ключових функцій і можливостей]

## Технічні вимоги
[Стек, платформа, інтеграції, обмеження]

## Етапи розробки
[Пронумерований список з орієнтовними термінами для кожного етапу]

## Дедлайн
[Загальний дедлайн або орієнтовна тривалість]

## Відповідальні
[Ролі команди: PM, Dev, Designer тощо]

## Ризики
[Маркований список потенційних ризиків і способів їх мінімізації]`

  const client = getClient()
  if (!client) {
    return res.status(503).json({ error: 'AI недоступний: ANTHROPIC_API_KEY не налаштовано' })
  }

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    })

    const tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
    const content = message.content[0]?.text || ''

    // Extract title from first line (# Title)
    const titleMatch = content.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1].trim() : 'Технічне завдання'

    // Save to documents table
    const doc = await prisma.document.create({
      data: {
        title,
        content,
        type: 'SPEC',
        created_by: sub,
        project_id: project_id || null,
      },
    })

    // Log AI call
    await prisma.aiLog.create({
      data: { user_id: sub, feature: 'generate-spec', tokens_used: tokensUsed },
    })

    return res.status(201).json({
      document: doc,
      tokens_used: tokensUsed,
      remaining_requests: limit.remaining - 1,
    })
  } catch (err) {
    console.error('Anthropic error:', err.message)
    return res.status(502).json({ error: 'AI service unavailable. Try again later.' })
  }
}

// ─── Context builder ──────────────────────────────────────────────────────────
function buildAnalyticsContext({ projects, overdueTasks, leads, income, expense }) {
  const active    = projects.filter(p => p.status === 'ACTIVE').length
  const completed = projects.filter(p => p.status === 'COMPLETED').length
  const onHold    = projects.filter(p => p.status === 'ON_HOLD').length

  const wonLeads  = leads.filter(l => l.status === 'WON')
  const pipeline  = leads.filter(l => !['WON','LOST'].includes(l.status))
  const pipeValue = pipeline.reduce((s, l) => s + l.amount, 0)

  const overdueList = overdueTasks.slice(0, 10).map(t =>
    `  - "${t.title}" (${t.project?.name || '?'}) — виконавець: ${t.assignee?.email || 'не призначено'}, дедлайн: ${t.deadline?.toISOString().split('T')[0]}`
  ).join('\n')

  return `
ПРОЄКТИ (всього ${projects.length}):
  Активних: ${active} | Завершених: ${completed} | На паузі: ${onHold}
  Проєкти: ${projects.map(p => `${p.name} (${p.type}, ${p.status}, прогрес ${p.progress}%)`).join('; ')}

ПРОСТРОЧЕНІ ЗАДАЧІ (${overdueTasks.length} шт.):
${overdueList || '  Немає прострочених задач'}

ФІНАНСИ:
  Дохід: $${income.toLocaleString()} | Витрати: $${expense.toLocaleString()} | Прибуток: $${(income - expense).toLocaleString()}

ЛІДИ (${leads.length} всього):
  Виграно: ${wonLeads.length} ($${wonLeads.reduce((s,l)=>s+l.amount,0).toLocaleString()})
  Воронка: ${pipeline.length} лідів на суму $${pipeValue.toLocaleString()}
`.trim()
}
