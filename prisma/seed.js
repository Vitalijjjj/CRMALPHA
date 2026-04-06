const { PrismaClient } = require('@prisma/client')
const argon2 = require('argon2')

const prisma = new PrismaClient()

const HASH_OPTS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 }

async function main() {
  console.log('🌱 Seeding database...')

  // Wipe existing data in correct order
  await prisma.financeRecord.deleteMany()
  await prisma.lead.deleteMany()
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

  // ── Leads ────────────────────────────────────────────────
  const leads = await Promise.all([
    prisma.lead.create({ data: { name: 'Петро Коваленко',    source: 'Реферал',         status: 'CONTACTED', amount: 3500, comment: 'Корпоративний сайт',         owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'Марина Лисенко',     source: 'Instagram',       status: 'WON',       amount: 1800, comment: 'Лендінг косметика',           owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'Oleks Design Studio',source: 'Upwork',          status: 'PROPOSAL',  amount: 5200, comment: 'White-label розробка',         owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'Nova Logistics',     source: 'Сайт',            status: 'NEW',       amount: 4000,                                          owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'Grill House',        source: 'Реферал',         status: 'CONTACTED', amount: 1200, comment: 'Меню + бронювання',            owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'MindSpark Agency',   source: 'Партнер',         status: 'WON',       amount: 7800, comment: 'Довгостроковий контракт',      owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'EcoShop Ukraine',    source: 'Холодний контакт',status: 'LOST',      amount: 2200, comment: 'Обрали іншого підрядника',     owner_id: ops.id } }),
    prisma.lead.create({ data: { name: 'Fit Academy',        source: 'Instagram',       status: 'PROPOSAL',  amount: 3100, comment: 'Фітнес-клуб',                  owner_id: ops.id } }),
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
