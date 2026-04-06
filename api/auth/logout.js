const { clearRefreshCookie } = require('../_lib/jwt')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  clearRefreshCookie(res)

  return res.status(200).json({ message: 'Logged out' })
}
