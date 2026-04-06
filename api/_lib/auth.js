const { verifyAccess } = require('./jwt')

/**
 * Wraps a Vercel serverless handler with JWT authentication and optional role check.
 *
 * @param {Function} handler
 * @param {{ roles?: string[] }} options
 */
function withAuth(handler, { roles } = {}) {
  return async (req, res) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const token = authHeader.slice(7)
    let payload
    try {
      payload = verifyAccess(token)
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    if (roles && roles.length > 0 && !roles.includes(payload.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    req.user = payload
    return handler(req, res)
  }
}

const FULL_ACCESS = ['PM', 'OPERATIONS_SALES']
const DEV_ROLES = ['DEV_WEBFLOW', 'DEV_WORDPRESS']
const ALL_ROLES = [...FULL_ACCESS, ...DEV_ROLES]

module.exports = { withAuth, FULL_ACCESS, DEV_ROLES, ALL_ROLES }
