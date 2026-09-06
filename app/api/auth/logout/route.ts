import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { isDemoMode, OWNER_COOKIE } from "@/lib/security";
import { signOutCurrentUser } from "@/lib/auth";

export async function POST() {
  try {
    if (isDemoMode()) {
      const response = NextResponse.json({ ok: true });
      response.cookies.delete(OWNER_COOKIE);
      return response;
    }
    await signOutCurrentUser();
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
