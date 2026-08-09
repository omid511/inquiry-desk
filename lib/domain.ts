import { z } from "zod";

export const leadStatuses = ["new", "extracting", "needs_info", "ready_for_review", "approved", "closed"] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export const extendedLeadStatuses = ["new", "extracting", "needs_info", "ready_for_review", "drafting", "approved", "rejected", "sending", "sent", "delivery_failed", "closed"] as const;
export type ExtendedLeadStatus = (typeof extendedLeadStatuses)[number];
export const memberRoles = ["owner", "manager", "operator", "viewer"] as const;
export type MemberRole = (typeof memberRoles)[number];
export const inquiryOutcomes = ["unresolved", "quoted", "booked", "not_a_fit", "no_response"] as const;
export type InquiryOutcome = (typeof inquiryOutcomes)[number];

export const urgencySchema = z.enum(["low", "normal", "high"]);
export type Urgency = z.infer<typeof urgencySchema>;

export const extractedInquirySchema = z.object({
  category: z.string().min(1).max(80),
  requestedService: z.string().max(120),
  timeWindow: z.string().max(120),
  location: z.string().max(120),
  urgency: urgencySchema,
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.enum(["requestedService", "timeWindow", "location"])).max(3),
});
export type ExtractedInquiry = z.infer<typeof extractedInquirySchema>;

export const requiredFieldSchema = z.enum(["requestedService", "timeWindow", "location"]);
export const inquirySchemaConfig = z.object({
  id: z.string().default("default-service-inquiry"),
  name: z.string().min(1).max(80).default("Service inquiry"),
  requiredFields: z.array(requiredFieldSchema).max(3).default(["requestedService", "timeWindow", "location"]),
  slaHours: z.number().int().min(1).max(720).default(48),
});
export type InquirySchemaConfig = z.infer<typeof inquirySchemaConfig>;

export const messageSchema = z.object({
  id: z.string(),
  direction: z.enum(["inbound", "outbound"]),
  body: z.string().min(1).max(4000),
  channel: z.enum(["website", "email", "internal"]),
  createdAt: z.string(),
  createdBy: z.string(),
});
export type InquiryMessage = z.infer<typeof messageSchema>;

export const extractionRunSchema = z.object({ id: z.string(), provider: z.string(), status: z.enum(["completed", "fallback", "failed"]), confidence: z.number().min(0).max(1), createdAt: z.string(), error: z.string().max(240).optional() });
export const draftSchema = z.object({ id: z.string(), version: z.number().int().positive(), body: z.string().max(4000), status: z.enum(["working", "approved", "rejected"]), createdAt: z.string(), createdBy: z.string() });
export const deliverySchema = z.object({ id: z.string(), idempotencyKey: z.string(), channel: z.literal("email"), recipient: z.string().email(), status: z.enum(["queued", "sending", "sent", "failed"]), attempts: z.number().int().nonnegative(), lastError: z.string().max(240).optional(), createdAt: z.string(), updatedAt: z.string() });
export const auditEventSchema = z.object({ id: z.string(), type: z.string(), at: z.string(), actor: z.string(), detail: z.string().max(240).optional() });
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const intakeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional().default(""),
  request: z.string().trim().min(20).max(4000),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
});
export type IntakeInput = z.infer<typeof intakeSchema>;

export const leadSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  request: z.string(),
  consent: z.boolean(),
  source: z.literal("website"),
  extracted: extractedInquirySchema,
  draft: z.string(),
  status: z.enum(extendedLeadStatuses),
  idempotencyKey: z.string(),
  fingerprint: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  events: z.array(z.object({
    id: z.string(),
    type: z.string(),
    at: z.string(),
    actor: z.string(),
    detail: z.string().max(240).optional(),
  })),
  schema: inquirySchemaConfig.default(inquirySchemaConfig.parse({})),
  messages: z.array(messageSchema).default([]),
  extractionRuns: z.array(extractionRunSchema).default([]),
  drafts: z.array(draftSchema).default([]),
  deliveries: z.array(deliverySchema).default([]),
  idempotencyKeys: z.array(z.string()).default([]),
  assignedTo: z.string().nullable().default(null),
  outcome: z.enum(inquiryOutcomes).default("unresolved"),
  slaDueAt: z.string(),
});
export type InquiryLead = z.infer<typeof leadSchema>;

export function statusLabel(status: LeadStatus | ExtendedLeadStatus) {
  return status.replaceAll("_", " ").replace(/(^| )\S/g, (letter) => letter.toUpperCase());
}

export function statusFor(extracted: ExtractedInquiry): LeadStatus {
  return extracted.missingFields.length > 0 ? "needs_info" : "ready_for_review";
}

export function extendedStatusFor(extracted: ExtractedInquiry): ExtendedLeadStatus {
  return extracted.missingFields.length > 0 ? "needs_info" : "ready_for_review";
}
