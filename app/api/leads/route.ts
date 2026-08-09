import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { requireOwner } from "@/lib/security";
import { getStore } from "@/lib/store";
import { extendedLeadStatuses } from "@/lib/domain";
export async function GET(request: Request) { try { const session = await requireOwner(); const url = new URL(request.url); const search = (url.searchParams.get("q") || "").toLowerCase(); const requestedStatus = url.searchParams.get("status"); const assigned = url.searchParams.get("assigned"); const leads = await getStore().list(session.workspaceId); const filtered = leads.filter((lead) => (!search || `${lead.name} ${lead.email} ${lead.request} ${lead.extracted.requestedService}`.toLowerCase().includes(search)) && (!requestedStatus || extendedLeadStatuses.includes(requestedStatus as typeof extendedLeadStatuses[number]) && lead.status === requestedStatus) && (!assigned || (assigned === "unassigned" ? !lead.assignedTo : lead.assignedTo === assigned))); return NextResponse.json({ leads: filtered, filters: { q: search, status: requestedStatus || "all", assigned: assigned || "all" } }); } catch (error) { return errorResponse(error); } }
