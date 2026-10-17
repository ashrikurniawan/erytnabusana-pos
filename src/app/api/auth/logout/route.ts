import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const user = await getSessionUser();
  if (user) {
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "LOGOUT",
      entity: "USER",
      entityId: user.id,
    });
  }

  const response = NextResponse.json({ success: true, message: "Berhasil logout." });
  response.cookies.delete("erytna_token");
  return response;
}
