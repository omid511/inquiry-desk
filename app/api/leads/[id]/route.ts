import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { requireOwner } from "@/lib/security";
import { getStore } from "@/lib/store";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const session = await requireOwner(); const lead = await getStore().get(session.workspaceId, (await params).id); if (!lead) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 }); return NextResponse.json({ lead }); } catch (error) { return errorResponse(error); } }
