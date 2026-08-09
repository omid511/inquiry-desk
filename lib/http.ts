import { NextResponse } from "next/server";

export function errorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "You do not have access to this action" }, { status: 403 });
  if (error instanceof Error && error.message === "PERSISTENCE_NOT_CONFIGURED") return NextResponse.json({ error: "Persistence is not configured. Enable demo mode or connect Supabase." }, { status: 503 });
  console.error("inquiry-desk request failed", error instanceof Error ? error.message : "unknown error");
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export function clientIp(request: Request) { return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"; }
