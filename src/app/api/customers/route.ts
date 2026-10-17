import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        _count: { select: { sales: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ customers });
  } catch (error) {
    console.error("Failed to load customers:", error);
    return NextResponse.json({ error: "Gagal memuat pelanggan." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, type = "UMUM", notes } = body;

    if (!name) {
      return NextResponse.json({ error: "Nama pelanggan wajib diisi." }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        type: ["UMUM", "ECERAN", "GROSIR"].includes(type) ? type : "UMUM",
        notes: notes ? notes.trim() : null,
      },
    });

    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (error) {
    console.error("Failed to create customer:", error);
    return NextResponse.json({ error: "Gagal menyimpan pelanggan." }, { status: 500 });
  }
}
