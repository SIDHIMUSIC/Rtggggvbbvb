import jwt from "jsonwebtoken";

export async function POST(req) {
  const body = await req.json();
  const { username, password } = body;

  // ✅ Credentials .env.local se aate hain
  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || "1234";

  if (username === adminUser && password === adminPass) {
    const token = jwt.sign(
      { role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return Response.json({ success: true, token });
  }

  return Response.json({
    success: false,
    message: "Wrong username or password ❌",
  });
}
