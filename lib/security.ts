import { cookies } from "next/headers";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { getStore, type UserSession } from "./store";

const OWNER_COOKIE = "inquiry_owner_session";
const sessionMaxAge = 60 * 60 * 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function isDemoMode() { return process.env.DEMO_MODE === "true"; }

export function isRateLimited(key: string, limit = 8) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) { attempts.set(key, { count: 1, resetAt: now + 60_000 }); return false; }
  current.count += 1;
  return current.count > limit;
}

export async function getOperatorSession(): Promise<UserSession | null> {
  const value = (await cookies()).get(OWNER_COOKIE)?.value;
  if (!value) return null;
  const session = await getStore().getSession(value);
  if (!session || !(await getStore().getMembership(session.userId, session.workspaceId))) return null;
  return session;
}

export async function requireOwner() {
  const session = await getOperatorSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireRole(roles: UserSession["role"][]) {
  const session = await requireOwner();
  if (!roles.includes(session.role)) throw new Error("FORBIDDEN");
  return session;
}

export function validOwnerPassword(password: string) {
  const expected = process.env.OWNER_ACCESS_TOKEN || (isDemoMode() ? "demo" : "");
  if (!expected || password.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(createHash("sha256").update(password).digest()), Buffer.from(createHash("sha256").update(expected).digest()));
}

export async function createOwnerSession() {
  const session: UserSession = { token: randomUUID(), userId: process.env.OWNER_USER_ID || "demo-owner", workspaceId: process.env.OWNER_WORKSPACE_ID || "demo-workspace", role: "owner", expiresAt: new Date(Date.now() + sessionMaxAge * 1000).toISOString() };
  await getStore().createSession(session);
  return session;
}

export { OWNER_COOKIE, sessionMaxAge };
