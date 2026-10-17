import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Username atau password salah, atau akun dinonaktifkan." },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 }
      );
    }

    const sessionPayload = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role as "ADMIN" | "KASIR" | "PETUGAS_STOK",
    };

    const token = signToken(sessionPayload);

    // Write audit log
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "LOGIN",
      entity: "USER",
      entityId: user.id,
      details: { role: user.role },
    });

    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
      message: `Selamat datang, ${user.name}!`,
    });

    // Set secure HttpOnly cookie
    response.cookies.set("erytna_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (error: unknown) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server saat login." },
      { status: 500 }
    );
  }
}
