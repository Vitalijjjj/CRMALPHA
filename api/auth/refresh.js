const { verifyRefresh, signAccess, signRefresh, setRefreshCookie } = require('../_lib/jwt')

function parseCookies(req) {
  const raw = req.headers.cookie || ''
  return Object.fromEntries(raw.split(';').map(c => c.trim().split('=').map(decodeURIComponent)))
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cookies = parseCookies(req)
  const token = cookies['refresh_token']

  if (!token) {
    return res.status(401).json({ error: 'No refresh token' })
  }

  let payload
  try {
    payload = verifyRefresh(token)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' })
  }

  const newPayload = { sub: payload.sub, email: payload.email, role: payload.role }
  const accessToken = signAccess(newPayload)
  const refreshToken = signRefresh(newPayload)

  setRefreshCookie(res, refreshToken)

  return res.status(200).json({ accessToken })
}
