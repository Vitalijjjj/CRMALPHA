const { Redis } = require('@upstash/redis')

let redis = null

function getRedis() {
  if (!redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return null // Redis not configured — rate limiting disabled
    }
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return redis
}

const DAILY_LIMIT = 20
const TTL = 60 * 60 * 24 // 24 hours in seconds

/**
 * Check and increment rate limit for a user.
 * Returns { allowed: true, remaining } or { allowed: false, remaining: 0 }
 */
async function checkRateLimit(userId) {
  const r = getRedis()

  // If Redis is not configured, allow all requests
  if (!r) return { allowed: true, remaining: DAILY_LIMIT, limited: false }

  const key = `ai_ratelimit:${userId}:${todayKey()}`

  try {
    const count = await r.incr(key)

    // Set TTL only on first request of the day
    if (count === 1) {
      await r.expire(key, TTL)
    }

    const remaining = Math.max(0, DAILY_LIMIT - count)
    return { allowed: count <= DAILY_LIMIT, remaining, count }
  } catch (err) {
    // If Redis fails, allow the request rather than blocking users
    console.error('Rate limit check failed:', err.message)
    return { allowed: true, remaining: DAILY_LIMIT }
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
}

module.exports = { checkRateLimit, DAILY_LIMIT }
