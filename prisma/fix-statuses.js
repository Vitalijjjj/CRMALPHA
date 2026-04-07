/**
 * One-time script to set funnel_stage on existing lead statuses.
 * Safe to run — does NOT delete any leads or other data.
 * Run with: node prisma/fix-statuses.js
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const STATUS_STAGES = [
  { name: 'Новий',      funnel_stage: 'contacted' },
  { name: 'Написав',    funnel_stage: 'contacted' },
  { name: 'Колл',       funnel_stage: 'call' },
  { name: 'КП',         funnel_stage: 'proposal' },
  { name: 'Цікаво',     funnel_stage: 'interested' },
  { name: 'Не цікаво',  funnel_stage: 'not_interested' },
  { name: 'Думає',      funnel_stage: 'thinking' },
  { name: 'Продаж',     funnel_stage: 'sold' },
  { name: 'Програно',   funnel_stage: 'not_interested' },
]

const DIRECTIONS = [
  { name: 'Будівництво Польща', geo: 'PL', method: 'Cold outreach', tool: 'LinkedIn' },
  { name: 'IT Аутсорс США',     geo: 'US', method: 'Inbound',       tool: 'Website'  },
  { name: 'E-commerce Україна', geo: 'UA', method: 'Referral',      tool: 'Telegram' },
  { name: 'HoReCa Польща',      geo: 'PL', method: 'Cold outreach', tool: 'Email'    },
]

async function main() {
  console.log('Updating lead statuses funnel_stage...')
  for (const s of STATUS_STAGES) {
    const updated = await prisma.leadStatus.updateMany({
      where: { name: s.name },
      data:  { funnel_stage: s.funnel_stage },
    })
    console.log(`  ${s.name} → ${s.funnel_stage} (${updated.count} updated)`)
  }

  console.log('\nUpserting lead directions...')
  for (const d of DIRECTIONS) {
    await prisma.leadDirection.upsert({
      where:  { name: d.name },
      update: { geo: d.geo, method: d.method, tool: d.tool },
      create: { name: d.name, geo: d.geo, method: d.method, tool: d.tool },
    })
    console.log(`  ${d.name} ✓`)
  }

  console.log('\nDone. No leads were deleted.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
