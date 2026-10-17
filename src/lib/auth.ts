import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import prisma from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "erytnabusana_pos_super_secret_session_key_2026_dev";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: "ADMIN" | "KASIR" | "PETUGAS_STOK";
}

// Simple base64url encoding
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return Buffer.from(str, "base64").toString("utf-8");
}

// Secure HMAC SHA-256 JWT implementation using Node's crypto
import crypto from "crypto";

export function signToken(payload: SessionUser, expiresInHours = 24): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInHours * 3600;

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify({ ...payload, iat: now, exp }));

  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${signature}`;
}

export function verifyToken(token: string): SessionUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const data = `${header}.${payload}`;

    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(data)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    if (signature !== expectedSignature) {
      return null;
    }

    const decodedPayload = JSON.parse(base64UrlDecode(payload));
    const now = Math.floor(Date.now() / 1000);

    if (decodedPayload.exp && decodedPayload.exp < now) {
      return null;
    }

    return {
      id: decodedPayload.id,
      username: decodedPayload.username,
      name: decodedPayload.name,
      role: decodedPayload.role,
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("erytna_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireUser(allowedRoles?: string[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Sesi Anda telah berakhir atau belum login.");
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new Error(`FORBIDDEN: Anda tidak memiliki hak akses (${user.role}).`);
  }
  return user;
}
