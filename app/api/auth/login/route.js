import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (
      username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign(
        { username, role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const response = NextResponse.json({ success: true });
      // ✅ Cookie mein save karo — localStorage pe depend mat karo
      response.cookies.set("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });
      return response;
    }

    return NextResponse.json(
      { success: false, message: "Wrong username or password ❌" },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
