import jwt from "jsonwebtoken";

export function requireAuth(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}
