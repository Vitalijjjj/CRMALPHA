// Run: node prisma/reset-passwords.js
try { require('dotenv').config({ path: require('path').join(__dirname,'../.env.local') }) } catch {}
try { require('dotenv').config({ path: require('path').join(__dirname,'../.env') }) } catch {}
const { PrismaClient } = require('@prisma/client')
const argon2 = require('argon2')

const prisma = new PrismaClient()
const HASH_OPTS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 }

const ACCOUNTS = [
  { email: 'ops@agency.com',       password: 'Ops$Alpha9Kx' },
  { email: 'pm@agency.com',        password: 'Pmgr$Zn4Qwe' },
  { email: 'webflow@agency.com',   password: 'Wflw$8rTpJv' },
  { email: 'wordpress@agency.com', password: 'Wprs$5mNcYb' },
]

async function main() {
  console.log('Updating passwords...\n')
  for (const acc of ACCOUNTS) {
    const hash = await argon2.hash(acc.password, HASH_OPTS)
    const user = await prisma.user.update({
      where: { email: acc.email },
      data: { password_hash: hash, updated_at: new Date() },
    })
    console.log(`✓  ${acc.email}  →  ${acc.password}   (role: ${user.role})`)
  }
  console.log('\nDone. All old sessions are now invalid.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
