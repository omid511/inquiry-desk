import type { InquiryLead } from "./domain";

export interface DeliveryProvider { name: string; send(input: { to: string; subject: string; body: string; idempotencyKey: string }): Promise<{ accepted: boolean; providerId?: string; error?: string }>; }

export class MockEmailDelivery implements DeliveryProvider {
  name = "mock-email";
  async send() { return { accepted: true, providerId: `demo-${crypto.randomUUID()}` }; }
}

export class WebhookEmailDelivery implements DeliveryProvider {
  name = "email-webhook";
  async send(input: { to: string; subject: string; body: string; idempotencyKey: string }) {
    const endpoint = process.env.OUTBOUND_EMAIL_WEBHOOK_URL;
    if (!endpoint) throw new Error("OUTBOUND_EMAIL_WEBHOOK_URL is not configured");
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": input.idempotencyKey, authorization: `Bearer ${process.env.OUTBOUND_EMAIL_WEBHOOK_SECRET || ""}` }, body: JSON.stringify(input), signal: AbortSignal.timeout(8000) });
    if (!response.ok) return { accepted: false, error: `Delivery provider returned ${response.status}` };
    return { accepted: true, providerId: response.headers.get("x-provider-id") || undefined };
  }
}

export function createDeliveryProvider(): DeliveryProvider { return process.env.OUTBOUND_EMAIL_PROVIDER === "webhook" ? new WebhookEmailDelivery() : new MockEmailDelivery(); }
export function deliverySubject(lead: InquiryLead) { return `Follow-up on your ${lead.extracted.requestedService || "inquiry"}`; }
