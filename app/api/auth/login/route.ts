import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureApplicationUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createOwnerSession, isDemoMode, OWNER_COOKIE, sessionMaxAge, validOwnerPassword } from "@/lib/security";

const credentials = z.object({ email: z.string().trim().email().max(160), password: z.string().min(8).max(200) });

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (isDemoMode()) {
      if (typeof body.password !== "string" || !validOwnerPassword(body.password)) return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
      const session = await createOwnerSession();
      const response = NextResponse.json({ ok: true, workspaceId: session.workspaceId });
      response.cookies.set(OWNER_COOKIE, session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: sessionMaxAge, path: "/" });
      return response;
    }

    const parsed = credentials.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    const client = await createServerSupabaseClient();
    const action = body.mode === "sign-up" ? "sign-up" : "sign-in";
    const result = action === "sign-up"
      ? await client.auth.signUp({ email: parsed.data.email, password: parsed.data.password })
      : await client.auth.signInWithPassword(parsed.data);
    if (result.error || !result.data.user) return NextResponse.json({ error: "Authentication failed. Check your details and try again." }, { status: 401 });
    await ensureApplicationUser(result.data.user);
    if (!result.data.session) return NextResponse.json({ ok: true, confirmationRequired: true, message: "Check your email to confirm the account, then sign in." });
    return NextResponse.json({ ok: true, workspaceId: process.env.DEFAULT_WORKSPACE_ID || process.env.PUBLIC_WORKSPACE_ID || null });
  } catch (error) { return errorResponse(error); }
}
