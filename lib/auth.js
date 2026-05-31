import jwt from 'jsonwebtoken'

export function requireAuth(request) {
  try {
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) return null
    const match = cookieHeader.match(/token=([^;]+)/)
    if (!match) return null
    const token = match[1]
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return null
  }
}
