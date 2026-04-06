const jwt = require('jsonwebtoken')

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET

function signAccess(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' })
}

function signRefresh(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' })
}

function verifyAccess(token) {
  return jwt.verify(token, ACCESS_SECRET)
}

function verifyRefresh(token) {
  return jwt.verify(token, REFRESH_SECRET)
}

function setRefreshCookie(res, token) {
  const maxAge = 7 * 24 * 60 * 60 // 7 days in seconds
  res.setHeader('Set-Cookie', [
    `refresh_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Path=/api/auth`,
  ])
}

function clearRefreshCookie(res) {
  res.setHeader('Set-Cookie', [
    'refresh_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/api/auth',
  ])
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh, setRefreshCookie, clearRefreshCookie }
