import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inquirySchemaConfig, leadSchema, type InquiryLead, type InquirySchemaConfig, type MemberRole } from "./domain";

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
  private workspace: Workspace = { id: process.env.OWNER_WORKSPACE_ID || "demo-workspace", name: "Demo service desk", schema: inquirySchemaConfig.parse({}), createdAt: new Date().toISOString() };
  private membership: Membership = { userId: process.env.OWNER_USER_ID || "demo-owner", workspaceId: process.env.OWNER_WORKSPACE_ID || "demo-workspace", role: "owner", email: "owner@example.com" };
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
  constructor(private client: SupabaseClient) {}
  private row(lead: InquiryLead) { return { id: lead.id, workspace_id: lead.workspaceId, status: lead.status, created_at: lead.createdAt, updated_at: lead.updatedAt, payload: lead }; }
  private async syncRelated(lead: InquiryLead) {
    const workspace = { id: lead.workspaceId, name: "Inquiry workspace", schema: lead.schema, created_at: lead.createdAt };
    const membership = { user_id: process.env.OWNER_USER_ID || "demo-owner", workspace_id: lead.workspaceId, role: "owner", email: "owner@example.com" };
    const { error: workspaceError } = await this.client.from("workspaces").upsert(workspace); if (workspaceError) throw workspaceError;
    const { error: membershipError } = await this.client.from("memberships").upsert(membership, { onConflict: "user_id,workspace_id" }); if (membershipError) throw membershipError;
    const { error: messageError } = await this.client.from("inquiry_messages").upsert(lead.messages.map((message) => ({ lead_id: lead.id, ...message, created_at: message.createdAt, created_by: message.createdBy })), { onConflict: "id", ignoreDuplicates: true }); if (messageError) throw messageError;
    const { error: extractionError } = await this.client.from("extraction_runs").upsert(lead.extractionRuns.map((run) => ({ id: run.id, lead_id: lead.id, provider: run.provider, status: run.status, confidence: run.confidence, created_at: run.createdAt, error: run.error })), { onConflict: "id", ignoreDuplicates: true }); if (extractionError) throw extractionError;
    const { error: draftError } = await this.client.from("inquiry_drafts").upsert(lead.drafts.map((draft) => ({ id: draft.id, lead_id: lead.id, version: draft.version, body: draft.body, status: draft.status, created_at: draft.createdAt, created_by: draft.createdBy })), { onConflict: "id", ignoreDuplicates: true }); if (draftError) throw draftError;
    const { error: deliveryError } = await this.client.from("delivery_attempts").upsert(lead.deliveries.map((delivery) => ({ id: delivery.id, lead_id: lead.id, idempotency_key: delivery.idempotencyKey, channel: delivery.channel, recipient: delivery.recipient, status: delivery.status, attempts: delivery.attempts, last_error: delivery.lastError, created_at: delivery.createdAt, updated_at: delivery.updatedAt })), { onConflict: "id" }); if (deliveryError) throw deliveryError;
    const { error: idempotencyError } = await this.client.from("idempotency_keys").upsert(lead.idempotencyKeys.map((key) => ({ key, lead_id: lead.id, workspace_id: lead.workspaceId })), { onConflict: "key", ignoreDuplicates: true }); if (idempotencyError) throw idempotencyError;
    const { error: eventError } = await this.client.from("audit_events").upsert(lead.events.map((event) => ({ id: event.id, lead_id: lead.id, type: event.type, actor: event.actor, detail: event.detail, created_at: event.at })), { onConflict: "id", ignoreDuplicates: true }); if (eventError) throw eventError;
  }
  async list(workspaceId: string) { const { data, error } = await this.client.from("inquiry_leads").select("payload").eq("workspace_id", workspaceId).order("created_at", { ascending: false }); if (error) throw error; return (data || []).map((row) => leadSchema.parse(row.payload)); }
  async get(workspaceId: string, id: string) { const { data, error } = await this.client.from("inquiry_leads").select("payload").eq("workspace_id", workspaceId).eq("id", id).maybeSingle(); if (error) throw error; return data ? leadSchema.parse(data.payload) : null; }
  async create(lead: InquiryLead) { const { error } = await this.client.from("inquiry_leads").insert(this.row(lead)); if (error) throw error; await this.syncRelated(lead); return lead; }
  async save(lead: InquiryLead) { const { error } = await this.client.from("inquiry_leads").upsert(this.row(lead)); if (error) throw error; await this.syncRelated(lead); return lead; }
  async findByIdempotency(workspaceId: string, key: string) { const { data, error } = await this.client.from("inquiry_leads").select("payload").eq("workspace_id", workspaceId).contains("payload", { idempotencyKey: key }).maybeSingle(); if (error) throw error; return data ? leadSchema.parse(data.payload) : null; }
  async findRecentFingerprint(workspaceId: string, fingerprint: string) { const { data, error } = await this.client.from("inquiry_leads").select("payload").eq("workspace_id", workspaceId).contains("payload", { fingerprint }).gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()).maybeSingle(); if (error) throw error; return data ? leadSchema.parse(data.payload) : null; }
  async getWorkspace(workspaceId: string) { const { data, error } = await this.client.from("workspaces").select("id,name,schema,created_at").eq("id", workspaceId).maybeSingle(); if (error) throw error; return data ? { id: data.id, name: data.name, schema: inquirySchemaConfig.parse(data.schema), createdAt: data.created_at } : null; }
  async getMembership(userId: string, workspaceId: string) { const { data, error } = await this.client.from("memberships").select("user_id,workspace_id,role,email").eq("user_id", userId).eq("workspace_id", workspaceId).maybeSingle(); if (error) throw error; return data ? { userId: data.user_id, workspaceId: data.workspace_id, role: data.role, email: data.email } : null; }
  async createSession(session: UserSession) { const { error } = await this.client.from("sessions").insert({ token: session.token, user_id: session.userId, workspace_id: session.workspaceId, role: session.role, expires_at: session.expiresAt }); if (error) throw error; }
  async getSession(token: string) { const { data, error } = await this.client.from("sessions").select("token,user_id,workspace_id,role,expires_at").eq("token", token).gt("expires_at", new Date().toISOString()).maybeSingle(); if (error) throw error; return data ? { token: data.token, userId: data.user_id, workspaceId: data.workspace_id, role: data.role, expiresAt: data.expires_at } : null; }
  async deleteBefore(workspaceId: string, cutoff: string) { const { data, error } = await this.client.from("inquiry_leads").delete().eq("workspace_id", workspaceId).lt("created_at", cutoff).select("id"); if (error) throw error; return data?.length || 0; }
}

const globalForStore = globalThis as typeof globalThis & { inquiryStore?: InquiryStore };
export function getStore(): InquiryStore {
  if (globalForStore.inquiryStore) return globalForStore.inquiryStore;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) globalForStore.inquiryStore = new SupabaseInquiryStore(createClient(url, key, { auth: { persistSession: false } }));
  else if (process.env.DEMO_MODE === "true") globalForStore.inquiryStore = new InMemoryInquiryStore();
  else throw new Error("PERSISTENCE_NOT_CONFIGURED");
  return globalForStore.inquiryStore;
}

export function statusEvent(type: string, actor: string, detail?: string) { return { id: crypto.randomUUID(), type, at: new Date().toISOString(), actor, ...(detail ? { detail } : {}) }; }
