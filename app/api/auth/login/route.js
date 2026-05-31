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

      return NextResponse.json({ success: true, token });
    }

    return NextResponse.json(
      { success: false, message: "Wrong username or password ❌" },
      { status: 401 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
