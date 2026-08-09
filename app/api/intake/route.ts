import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { extendedStatusFor, intakeSchema, leadSchema } from "@/lib/domain";
import { buildDraft, extractWithFallback } from "@/lib/extraction";
import { errorResponse, clientIp } from "@/lib/http";
import { isRateLimited } from "@/lib/security";
import { getStore, statusEvent } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const ip = clientIp(request); if (isRateLimited(`intake:${ip}`)) return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
    const body = await request.json(); if (body.website) return NextResponse.json({ ok: true });
    const input = intakeSchema.parse(body); const workspaceId = process.env.PUBLIC_WORKSPACE_ID || process.env.OWNER_WORKSPACE_ID || "demo-workspace"; const idempotencyKey = (request.headers.get("x-idempotency-key") || createHash("sha256").update(`${input.email}:${input.request}`).digest("hex")).slice(0, 120); const fingerprint = createHash("sha256").update(`${input.email.toLowerCase()}:${input.request.toLowerCase().replace(/\s+/g, " ")}`).digest("hex"); const store = getStore(); const workspace = await store.getWorkspace(workspaceId); if (!workspace) return NextResponse.json({ error: "Workspace is unavailable" }, { status: 503 });
    const duplicate = await store.findByIdempotency(workspaceId, idempotencyKey) || await store.findRecentFingerprint(workspaceId, fingerprint); if (duplicate) return NextResponse.json({ leadId: duplicate.id, duplicate: true });
    const { extracted, provider, fallback } = await extractWithFallback(input, workspace.schema); const now = new Date().toISOString(); const extractionStatus = fallback ? "fallback" : "completed"; const draft = buildDraft(input, extracted); const lead = leadSchema.parse({ id: crypto.randomUUID(), workspaceId, name: input.name, email: input.email, phone: input.phone || "", request: input.request, consent: true, source: "website", extracted, draft, status: extendedStatusFor(extracted), idempotencyKey, fingerprint, createdAt: now, updatedAt: now, schema: workspace.schema, messages: [{ id: crypto.randomUUID(), direction: "inbound", body: input.request, channel: "website", createdAt: now, createdBy: "visitor" }], extractionRuns: [{ id: crypto.randomUUID(), provider, status: extractionStatus, confidence: extracted.confidence, createdAt: now }], drafts: [{ id: crypto.randomUUID(), version: 1, body: draft, status: "working", createdAt: now, createdBy: "system" }], deliveries: [], idempotencyKeys: [idempotencyKey], events: [statusEvent("submitted", "visitor"), statusEvent("classified", "system", `${provider}${fallback ? " fallback" : ""}`)], slaDueAt: new Date(Date.now() + workspace.schema.slaHours * 60 * 60 * 1000).toISOString() });
    await store.create(lead); return NextResponse.json({ leadId: lead.id, status: lead.status }, { status: 201 });
  } catch (error) { if (error instanceof Error && error.name === "ZodError") return NextResponse.json({ error: "Please complete the required fields and try again." }, { status: 400 }); return errorResponse(error); }
}
