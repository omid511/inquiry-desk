import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { requireRole } from "@/lib/security";
import { getStore, statusEvent } from "@/lib/store";
const assignmentSchema = z.object({ assignee: z.string().trim().max(120).nullable() });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const session = await requireRole(["owner", "manager", "operator"]); const body = assignmentSchema.parse(await request.json()); const store = getStore(); const lead = await store.get(session.workspaceId, (await params).id); if (!lead) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 }); const updated = { ...lead, assignedTo: body.assignee || null, updatedAt: new Date().toISOString(), events: [...lead.events, statusEvent("assignment_changed", session.userId, body.assignee ? `Assigned to ${body.assignee}` : "Unassigned")] }; await store.save(updated); return NextResponse.json({ lead: updated }); } catch (error) { if (error instanceof Error && error.name === "ZodError") return NextResponse.json({ error: "Invalid assignment" }, { status: 400 }); return errorResponse(error); } }
