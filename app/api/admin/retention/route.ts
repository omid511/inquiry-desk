import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { requireRole } from "@/lib/security";
import { retentionCutoff, retentionDays } from "@/lib/privacy";
import { getStore } from "@/lib/store";
export async function POST() { try { const session = await requireRole(["owner"]); const deleted = await getStore().deleteBefore(session.workspaceId, retentionCutoff()); return NextResponse.json({ deleted, retentionDays: retentionDays(), cutoff: retentionCutoff() }); } catch (error) { return errorResponse(error); } }
