import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: { select: { purchases: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ suppliers });
  } catch (error) {
    console.error("Failed to load suppliers:", error);
    return NextResponse.json({ error: "Gagal memuat data supplier." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role === "KASIR") {
      return NextResponse.json(
        { error: "Forbidden: Kasir tidak memiliki akses mengelola supplier." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, contactPerson, phone, address, notes } = body;

    if (!name) {
      return NextResponse.json({ error: "Nama supplier wajib diisi." }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        contactPerson: contactPerson ? contactPerson.trim() : null,
        phone: phone ? phone.trim() : null,
        address: address ? address.trim() : null,
        notes: notes ? notes.trim() : null,
      },
    });

    return NextResponse.json({ success: true, supplier }, { status: 201 });
  } catch (error) {
    console.error("Failed to create supplier:", error);
    return NextResponse.json({ error: "Gagal menyimpan supplier." }, { status: 500 });
  }
}
