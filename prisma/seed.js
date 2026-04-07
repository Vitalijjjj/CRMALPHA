const { PrismaClient } = require('@prisma/client')
const argon2 = require('argon2')

const prisma = new PrismaClient()

const HASH_OPTS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 }

async function main() {
  console.log('🌱 Seeding database...')

  // Wipe existing data in correct order
  await prisma.financeRecord.deleteMany()
  await prisma.lead.deleteMany()
  await prisma.leadStatus.deleteMany()
  await prisma.leadSource.deleteMany()
  await prisma.leadDirection.deleteMany()
  await prisma.taskComment.deleteMany()
  await prisma.task.deleteMany()
  await prisma.projectMember.deleteMany()
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()

  const pw = await argon2.hash('password123', HASH_OPTS)

  // ── Users ──────────────────────────────────────────────
  const [ops, pm, wf, wp] = await Promise.all([
    prisma.user.create({ data: { email: 'ops@agency.com', password_hash: pw, role: 'OPERATIONS_SALES' } }),
    prisma.user.create({ data: { email: 'pm@agency.com',  password_hash: pw, role: 'PM' } }),
    prisma.user.create({ data: { email: 'webflow@agency.com', password_hash: pw, role: 'DEV_WEBFLOW' } }),
    prisma.user.create({ data: { email: 'wordpress@agency.com', password_hash: pw, role: 'DEV_WORDPRESS' } }),
  ])
  console.log('✅ Users created')

  // ── Projects ────────────────────────────────────────────
  const now = new Date()
  const due = (n) => new Date(now.getTime() + n * 86400000)

  const [p1, p2, p3, p4, p5, p6] = await Promise.all([
    prisma.project.create({ data: { name: 'AutoBrand Website',  client: 'AutoBrand LLC',    type: 'WEBFLOW',    deadline: due(15), progress: 65, status: 'ACTIVE',    pm_id: pm.id, dev_id: wf.id } }),
    prisma.project.create({ data: { name: 'TechBlog Rebuild',   client: 'TechBlog Media',   type: 'WEBFLOW',    deadline: due(-2), progress: 30, status: 'ACTIVE',    pm_id: pm.id, dev_id: wf.id } }),
    prisma.project.create({ data: { name: 'KFC Landing',        client: 'KFC Ukraine',      type: 'WORDPRESS',  deadline: due(1),  progress: 80, status: 'ACTIVE',    pm_id: pm.id, dev_id: wp.id } }),
    prisma.project.create({ data: { name: 'MedClinic Portal',   client: 'MedClinic Group',  type: 'WORDPRESS',  deadline: due(30), progress: 20, status: 'ACTIVE',    pm_id: pm.id, dev_id: wp.id } }),
    prisma.project.create({ data: { name: 'FashionStore',       client: 'Moda UA',          type: 'WEBFLOW',    deadline: due(5),  progress: 95, status: 'COMPLETED', pm_id: pm.id, dev_id: wf.id } }),
    prisma.project.create({ data: { name: 'LawFirm Site',       client: 'Lexis Partners',   type: 'WORDPRESS',  deadline: due(60), progress: 10, status: 'ON_HOLD',   pm_id: pm.id, dev_id: wp.id } }),
  ])
  console.log('✅ Projects created')

  // ── Project members ──────────────────────────────────────
  const members = [
    // webflow projects — add webflow dev + pm
    { project_id: p1.id, user_id: wf.id, access_level: 'EDITOR' },
    { project_id: p1.id, user_id: pm.id, access_level: 'ADMIN' },
    { project_id: p2.id, user_id: wf.id, access_level: 'EDITOR' },
    { project_id: p2.id, user_id: pm.id, access_level: 'ADMIN' },
    { project_id: p5.id, user_id: wf.id, access_level: 'EDITOR' },
    { project_id: p5.id, user_id: pm.id, access_level: 'ADMIN' },
    // wordpress projects — add wordpress dev + pm
    { project_id: p3.id, user_id: wp.id, access_level: 'EDITOR' },
    { project_id: p3.id, user_id: pm.id, access_level: 'ADMIN' },
    { project_id: p4.id, user_id: wp.id, access_level: 'EDITOR' },
    { project_id: p4.id, user_id: pm.id, access_level: 'ADMIN' },
    { project_id: p6.id, user_id: wp.id, access_level: 'EDITOR' },
    { project_id: p6.id, user_id: pm.id, access_level: 'ADMIN' },
  ]
  await prisma.projectMember.createMany({ data: members })
  console.log('✅ Project members created')

  // ── Tasks ────────────────────────────────────────────────
  const tasks = [
    { title: 'Header animations',     project_id: p1.id, assignee_id: wf.id, created_by: pm.id, priority: 'HIGH',   status: 'IN_PROGRESS', deadline: due(-2) },
    { title: 'Mobile navigation',     project_id: p1.id, assignee_id: wf.id, created_by: pm.id, priority: 'MEDIUM', status: 'TODO',        deadline: due(3)  },
    { title: 'Client content review', project_id: p1.id, assignee_id: pm.id, created_by: pm.id, priority: 'HIGH',   status: 'TODO',        deadline: due(4)  },
    { title: 'CMS collections setup', project_id: p2.id, assignee_id: wf.id, created_by: pm.id, priority: 'URGENT', status: 'TODO',        deadline: due(-4) },
    { title: 'SEO meta tags',         project_id: p2.id, assignee_id: wf.id, created_by: pm.id, priority: 'LOW',    status: 'REVIEW',      deadline: due(-1) },
    { title: 'WooCommerce setup',     project_id: p3.id, assignee_id: wp.id, created_by: pm.id, priority: 'HIGH',   status: 'IN_PROGRESS', deadline: due(1)  },
    { title: 'Form integrations',     project_id: p3.id, assignee_id: wp.id, created_by: pm.id, priority: 'MEDIUM', status: 'IN_PROGRESS', deadline: due(-3) },
    { title: 'Final QA pass',         project_id: p3.id, assignee_id: pm.id, created_by: pm.id, priority: 'URGENT', status: 'TODO',        deadline: due(1)  },
    { title: 'Appointment booking',   project_id: p4.id, assignee_id: wp.id, created_by: pm.id, priority: 'HIGH',   status: 'TODO',        deadline: due(14) },
    { title: 'Homepage hero',         project_id: p5.id, assignee_id: wf.id, created_by: pm.id, priority: 'LOW',    status: 'DONE',        deadline: due(5)  },
    { title: 'Product gallery',       project_id: p5.id, assignee_id: wf.id, created_by: pm.id, priority: 'MEDIUM', status: 'DONE',        deadline: due(2)  },
    { title: 'Multilingual plugin',   project_id: p6.id, assignee_id: wp.id, created_by: pm.id, priority: 'MEDIUM', status: 'TODO',        deadline: due(30) },
  ]
  await prisma.task.createMany({ data: tasks })
  console.log('✅ Tasks created')

  // Recalculate progress for all projects based on actual tasks
  for (const p of [p1, p2, p3, p4, p5, p6]) {
    const [total, done] = await Promise.all([
      prisma.task.count({ where: { project_id: p.id } }),
      prisma.task.count({ where: { project_id: p.id, status: 'DONE' } }),
    ])
    const progress = total === 0 ? 0 : Math.round((done / total) * 100)
    await prisma.project.update({ where: { id: p.id }, data: { progress } })
  }
  console.log('✅ Progress recalculated')

  // ── Lead Statuses (with funnel_stage) ────────────────────
  const statusData = [
    { name: 'Новий',      color: '#6B7280', sort_order: 0, is_system: true, funnel_stage: 'contacted' },
    { name: 'Написав',    color: '#8B5CF6', sort_order: 1, is_system: true, funnel_stage: 'contacted' },
    { name: 'Колл',       color: '#3B82F6', sort_order: 2, is_system: true, funnel_stage: 'call' },
    { name: 'КП',         color: '#F59E0B', sort_order: 3, is_system: true, funnel_stage: 'proposal' },
    { name: 'Цікаво',     color: '#10B981', sort_order: 4, is_system: true, funnel_stage: 'interested' },
    { name: 'Не цікаво',  color: '#EF4444', sort_order: 5, is_system: true, funnel_stage: 'not_interested' },
    { name: 'Думає',      color: '#F97316', sort_order: 6, is_system: true, funnel_stage: 'thinking' },
    { name: 'Продаж',     color: '#22C55E', sort_order: 7, is_system: true, funnel_stage: 'sold' },
    { name: 'Програно',   color: '#DC2626', sort_order: 8, is_system: true, funnel_stage: 'not_interested' },
  ]
  const createdStatuses = []
  for (const s of statusData) {
    createdStatuses.push(await prisma.leadStatus.create({ data: s }))
  }
  const sMap = Object.fromEntries(createdStatuses.map(s => [s.name, s.id]))
  console.log('✅ Lead statuses created')

  // ── Lead Sources ──────────────────────────────────────────
  const sourceData = [
    { name: 'Реклама',           sort_order: 0 },
    { name: 'Розсилки',          sort_order: 1 },
    { name: 'Партнерка',         sort_order: 2 },
    { name: 'Рілси/Органіка',    sort_order: 3 },
    { name: 'Нетворкінг',        sort_order: 4 },
    { name: 'TikTok розсилки',   sort_order: 5 },
    { name: 'Inst Direct',       sort_order: 6 },
  ]
  const createdSources = []
  for (const s of sourceData) {
    createdSources.push(await prisma.leadSource.create({ data: s }))
  }
  const srcMap = Object.fromEntries(createdSources.map(s => [s.name, s.id]))
  console.log('✅ Lead sources created')

  // ── Lead Directions ───────────────────────────────────────
  const directionData = [
    { name: 'Будівництво Польща',  geo: 'Польща',  method: 'Реклама',    tool: 'Креос',        sort_order: 0 },
    { name: 'IT Аутсорс США',      geo: 'США',     method: 'Розсилки',   tool: 'Inst Direct',  sort_order: 1 },
    { name: 'E-commerce Україна',  geo: 'Україна', method: 'Органіка',   tool: 'TikTok',       sort_order: 2 },
    { name: 'HoReCa Польща',       geo: 'Польща',  method: 'Розсилки',   tool: 'LinkedIn',     sort_order: 3 },
  ]
  const createdDirections = []
  for (const d of directionData) {
    createdDirections.push(await prisma.leadDirection.create({ data: d }))
  }
  const dMap = Object.fromEntries(createdDirections.map(d => [d.name, d.id]))
  console.log('✅ Lead directions created')

  // ── Leads (with direction) ────────────────────────────────
  const leads = await Promise.all([
    prisma.lead.create({ data: { name: 'Петро Коваленко',    source_id: srcMap['Нетворкінг'],      status_id: sMap['Колл'],       direction_id: dMap['Будівництво Польща'], amount: 3500, comment: 'Корпоративний сайт',        owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'Марина Лисенко',     source_id: srcMap['Inst Direct'],     status_id: sMap['Продаж'],     direction_id: dMap['E-commerce Україна'], amount: 1800, comment: 'Лендінг косметика',          owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'Oleks Design Studio',source_id: srcMap['Нетворкінг'],      status_id: sMap['КП'],         direction_id: dMap['IT Аутсорс США'],     amount: 5200, comment: 'White-label розробка',        owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'Nova Logistics',     source_id: srcMap['Реклама'],         status_id: sMap['Написав'],    direction_id: dMap['Будівництво Польща'], amount: 4000,                                  owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'Grill House',        source_id: srcMap['Рілси/Органіка'],  status_id: sMap['Написав'],    direction_id: dMap['HoReCa Польща'],      amount: 1200, comment: 'Меню + бронювання',          owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'MindSpark Agency',   source_id: srcMap['Партнерка'],       status_id: sMap['Продаж'],     direction_id: dMap['IT Аутсорс США'],     amount: 7800, comment: 'Довгостроковий контракт',    owner_id: ops.id, telegram_username: 'mindspark_ceo' } }),
    prisma.lead.create({ data: { name: 'EcoShop Ukraine',    source_id: srcMap['Розсилки'],        status_id: sMap['Не цікаво'],  direction_id: dMap['E-commerce Україна'], amount: 2200, comment: 'Обрали іншого підрядника',   owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'Fit Academy',        source_id: srcMap['TikTok розсилки'], status_id: sMap['Цікаво'],     direction_id: dMap['HoReCa Польща'],      amount: 3100, comment: 'Фітнес-клуб',               owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'BuildPro Warsaw',    source_id: srcMap['Реклама'],         status_id: sMap['КП'],         direction_id: dMap['Будівництво Польща'], amount: 6200, comment: 'Ремонтна компанія',          owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'TechFlow Inc',       source_id: srcMap['Inst Direct'],     status_id: sMap['Думає'],      direction_id: dMap['IT Аутсорс США'],     amount: 9500, comment: 'SaaS стартап',               owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'Cafe Lviv',          source_id: srcMap['Розсилки'],        status_id: sMap['Колл'],       direction_id: dMap['HoReCa Польща'],      amount: 800,  comment: 'Ресторан',                   owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'ModaShop PL',        source_id: srcMap['Реклама'],         status_id: sMap['Цікаво'],     direction_id: dMap['E-commerce Україна'], amount: 2800, comment: 'Одяг онлайн',                owner_id: ops.id } }),
  ])
  console.log('✅ Leads created')

  // ── Finance records ──────────────────────────────────────
  const ago = (n) => new Date(now.getTime() - n * 86400000)

  await prisma.financeRecord.createMany({ data: [
    { type: 'INCOME',  project_id: p1.id,  amount: 2500, date: ago(25), category: 'Оплата проєкту',  description: 'AutoBrand — 50% передоплата',      created_by: ops.id },
    { type: 'INCOME',  project_id: p3.id,  amount: 1800, date: ago(18), category: 'Оплата проєкту',  description: 'KFC Landing — повна оплата',        created_by: ops.id },
    { type: 'EXPENSE',                     amount:   99, date: ago(20), category: 'Програмне забезп.', description: 'Figma — місячна підписка',          created_by: ops.id },
    { type: 'INCOME',  project_id: p5.id,  amount: 3200, date: ago(10), category: 'Оплата проєкту',  description: 'FashionStore — фінальна оплата',    created_by: ops.id },
    { type: 'EXPENSE',                     amount:  299, date: ago(15), category: 'Програмне забезп.', description: 'Webflow Business — місячна',       created_by: ops.id },
    { type: 'INCOME',  project_id: p2.id,  amount: 1500, date: ago(8),  category: 'Оплата проєкту',  description: 'TechBlog — 50% передоплата',        created_by: ops.id },
    { type: 'EXPENSE',                     amount:  450, date: ago(5),  category: 'Підрядник',        description: 'Дизайнер — AutoBrand',              created_by: ops.id },
    { type: 'INCOME',  project_id: p4.id,  amount: 2000, date: ago(3),  category: 'Оплата проєкту',  description: 'MedClinic — передоплата',           created_by: ops.id },
    { type: 'EXPENSE',                     amount:  120, date: ago(1),  category: 'Маркетинг',        description: 'Instagram реклама',                 created_by: ops.id },
    { type: 'INCOME',  lead_id: leads[5].id, amount: 7800, date: ago(30), category: 'Ретейнер',       description: 'MindSpark Agency — ретейнер',       created_by: ops.id },
  ]})
  console.log('✅ Finance records created')

  console.log('\n🎉 Seed complete!')
  console.log('Test accounts (password: password123):')
  console.log('  ops@agency.com      → OPERATIONS_SALES')
  console.log('  pm@agency.com       → PM')
  console.log('  webflow@agency.com  → DEV_WEBFLOW')
  console.log('  wordpress@agency.com → DEV_WORDPRESS')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
