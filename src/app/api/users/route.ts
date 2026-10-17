import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Hanya Admin yang dapat melihat daftar pengguna." }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Failed to load users:", error);
    return NextResponse.json({ error: "Gagal memuat pengguna." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Hanya Admin yang dapat menambah pengguna." }, { status: 403 });
    }

    const body = await request.json();
    const { username, name, email, password, role } = body;

    if (!username || !name || !password || !role) {
      return NextResponse.json({ error: "Username, nama lengkap, password, dan role wajib diisi." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { username: username.trim() },
    });
    if (existing) {
      return NextResponse.json({ error: `Username "${username}" sudah digunakan.` }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const createdUser = await prisma.user.create({
      data: {
        username: username.trim(),
        name: name.trim(),
        email: email ? email.trim() : null,
        passwordHash,
        role: ["ADMIN", "KASIR", "PETUGAS_STOK"].includes(role) ? role : "KASIR",
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    await logAudit({
      userId: sessionUser.id,
      userName: sessionUser.name,
      action: "CREATE_USER",
      entity: "USER",
      entityId: createdUser.id,
      details: { username: createdUser.username, role: createdUser.role },
    });

    return NextResponse.json({ success: true, user: createdUser }, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json({ error: "Gagal membuat pengguna baru." }, { status: 500 });
  }
}
