import { type SupabaseClient } from "@supabase/supabase-js";
import { inquirySchemaConfig, leadSchema, type InquiryLead, type InquirySchemaConfig, type MemberRole } from "./domain";
import { createServerSupabaseClient } from "./supabase/server";

export interface Workspace { id: string; name: string; schema: InquirySchemaConfig; createdAt: string; }
export interface Membership { userId: string; workspaceId: string; role: MemberRole; email: string; }
export interface UserSession { token: string; userId: string; workspaceId: string; role: MemberRole; expiresAt: string; }

export interface InquiryStore {
  list(workspaceId: string): Promise<InquiryLead[]>;
  get(workspaceId: string, id: string): Promise<InquiryLead | null>;
  create(lead: InquiryLead): Promise<InquiryLead>;
  save(lead: InquiryLead): Promise<InquiryLead>;
  findByIdempotency(workspaceId: string, key: string): Promise<InquiryLead | null>;
  findRecentFingerprint(workspaceId: string, fingerprint: string): Promise<InquiryLead | null>;
  getWorkspace(workspaceId: string): Promise<Workspace | null>;
  getMembership(userId: string, workspaceId: string): Promise<Membership | null>;
  createSession(session: UserSession): Promise<void>;
  getSession(token: string): Promise<UserSession | null>;
  deleteBefore(workspaceId: string, cutoff: string): Promise<number>;
}

export class InMemoryInquiryStore implements InquiryStore {
  private leads = new Map<string, InquiryLead>();
  private sessions = new Map<string, UserSession>();
  private workspace: Workspace = { id: process.env.DEFAULT_WORKSPACE_ID || process.env.OWNER_WORKSPACE_ID || "demo-workspace", name: "Demo service desk", schema: inquirySchemaConfig.parse({}), createdAt: new Date().toISOString() };
  private membership: Membership = { userId: process.env.OWNER_USER_ID || "demo-owner", workspaceId: process.env.DEFAULT_WORKSPACE_ID || process.env.OWNER_WORKSPACE_ID || "demo-workspace", role: "owner", email: "owner@example.com" };
  async list(workspaceId: string) { return [...this.leads.values()].filter((lead) => lead.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  async get(workspaceId: string, id: string) { const lead = this.leads.get(id); return lead?.workspaceId === workspaceId ? lead : null; }
  async create(lead: InquiryLead) { this.leads.set(lead.id, lead); return lead; }
  async save(lead: InquiryLead) { this.leads.set(lead.id, lead); return lead; }
  async findByIdempotency(workspaceId: string, key: string) { return [...this.leads.values()].find((lead) => lead.workspaceId === workspaceId && lead.idempotencyKey === key) || null; }
  async findRecentFingerprint(workspaceId: string, fingerprint: string) { const cutoff = Date.now() - 10 * 60 * 1000; return [...this.leads.values()].find((lead) => lead.workspaceId === workspaceId && lead.fingerprint === fingerprint && Date.parse(lead.createdAt) > cutoff) || null; }
  async getWorkspace(workspaceId: string) { return workspaceId === this.workspace.id ? this.workspace : null; }
  async getMembership(userId: string, workspaceId: string) { return userId === this.membership.userId && workspaceId === this.membership.workspaceId ? this.membership : null; }
  async createSession(session: UserSession) { this.sessions.set(session.token, session); }
  async getSession(token: string) { const session = this.sessions.get(token); if (!session || Date.parse(session.expiresAt) < Date.now()) return null; return session; }
  async deleteBefore(workspaceId: string, cutoff: string) { let count = 0; for (const [id, lead] of this.leads) if (lead.workspaceId === workspaceId && lead.createdAt < cutoff) { this.leads.delete(id); count += 1; } return count; }
}

class SupabaseInquiryStore implements InquiryStore {
  constructor(private readonly clientPromise: Promise<SupabaseClient>) {}

  private row(lead: InquiryLead) {
    return {
      id: lead.id,
      workspace_id: lead.workspaceId,
      assigned_to: lead.assignedTo,
      status: lead.status,
      priority: lead.extracted.urgency,
      idempotency_key: lead.idempotencyKey,
      fingerprint: lead.fingerprint,
      created_at: lead.createdAt,
      updated_at: lead.updatedAt,
      payload: lead,
    };
  }

  private async syncEvents(client: SupabaseClient, lead: InquiryLead) {
    if (!lead.events.length) return;
    const { error } = await client.from("inquiry_events").upsert(lead.events.map((event) => ({
      id: event.id,
      workspace_id: lead.workspaceId,
      inquiry_id: lead.id,
      action: event.type,
      actor: event.actor,
      detail: event.detail,
      metadata: {},
      created_at: event.at,
    })), { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
  }

  async list(workspaceId: string) {
    const client = await this.clientPromise;
    const { data, error } = await client.from("inquiries").select("payload").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200);
    if (error) throw error;
    return (data || []).map((row) => leadSchema.parse(row.payload));
  }

  async get(workspaceId: string, id: string) {
    const client = await this.clientPromise;
    const { data, error } = await client.from("inquiries").select("payload").eq("workspace_id", workspaceId).eq("id", id).limit(1).maybeSingle();
    if (error) throw error;
    return data ? leadSchema.parse(data.payload) : null;
  }

  async create(lead: InquiryLead) {
    const client = await this.clientPromise;
    const { error } = await client.from("inquiries").insert(this.row(lead));
    if (error) throw error;
    await this.syncEvents(client, lead);
    return lead;
  }

  async save(lead: InquiryLead) {
    const client = await this.clientPromise;
    const { error } = await client.from("inquiries").upsert(this.row(lead), { onConflict: "id" });
    if (error) throw error;
    await this.syncEvents(client, lead);
    return lead;
  }

  async findByIdempotency(workspaceId: string, key: string) {
    const client = await this.clientPromise;
    const { data, error } = await client.from("inquiries").select("payload").eq("workspace_id", workspaceId).eq("idempotency_key", key).limit(1).maybeSingle();
    if (error) throw error;
    return data ? leadSchema.parse(data.payload) : null;
  }

  async findRecentFingerprint(workspaceId: string, fingerprint: string) {
    const client = await this.clientPromise;
    const { data, error } = await client.from("inquiries").select("payload").eq("workspace_id", workspaceId).eq("fingerprint", fingerprint).gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data ? leadSchema.parse(data.payload) : null;
  }

  async getWorkspace(workspaceId: string) {
    const client = await this.clientPromise;
    const { data, error } = await client.from("workspaces").select("id,name,schema,created_at").eq("id", workspaceId).limit(1).maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, name: data.name, schema: inquirySchemaConfig.parse(data.schema), createdAt: data.created_at } : null;
  }

  async getMembership(userId: string, workspaceId: string) {
    const client = await this.clientPromise;
    const { data, error } = await client.from("workspace_memberships").select("app_user_id,workspace_id,role").eq("app_user_id", userId).eq("workspace_id", workspaceId).limit(1).maybeSingle();
    if (error) throw error;
    return data ? { userId: data.app_user_id, workspaceId: data.workspace_id, role: data.role as MemberRole, email: "" } : null;
  }

  async createSession() { throw new Error("PERSISTED_SESSION_UNSUPPORTED"); }
  async getSession(token: string): Promise<UserSession | null> { void token; throw new Error("PERSISTED_SESSION_UNSUPPORTED"); }

  async deleteBefore(workspaceId: string, cutoff: string) {
    const client = await this.clientPromise;
    const { data, error } = await client.from("inquiries").delete().eq("workspace_id", workspaceId).lt("created_at", cutoff).select("id");
    if (error) throw error;
    return data?.length || 0;
  }
}

const globalForStore = globalThis as typeof globalThis & { inquiryStore?: InquiryStore };
export function getStore(): InquiryStore {
  // Demo mode wins even if deployment variables happen to be present. This is
  // the hard boundary that prevents recruiter/demo writes reaching production.
  if (process.env.DEMO_MODE === "true") {
    if (!globalForStore.inquiryStore) globalForStore.inquiryStore = new InMemoryInquiryStore();
    return globalForStore.inquiryStore;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) throw new Error("PERSISTENCE_NOT_CONFIGURED");
  return new SupabaseInquiryStore(createServerSupabaseClient());
}

export function statusEvent(type: string, actor: string, detail?: string) { return { id: crypto.randomUUID(), type, at: new Date().toISOString(), actor, ...(detail ? { detail } : {}) }; }
