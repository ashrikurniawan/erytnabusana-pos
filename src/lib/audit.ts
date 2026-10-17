import prisma from "./prisma";

export interface LogAuditParams {
  userId?: string | null;
  userName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown> | string | null;
  ipAddress?: string | null;
}

export async function logAudit({
  userId,
  userName,
  action,
  entity,
  entityId,
  details,
  ipAddress,
}: LogAuditParams) {
  try {
    const detailsString =
      typeof details === "object" && details !== null
        ? JSON.stringify(details)
        : details || null;

    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        userName: userName || null,
        action,
        entity,
        entityId: entityId || null,
        details: detailsString,
        ipAddress: ipAddress || null,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
