import type { ExtendedLeadStatus } from "./domain";

const transitions: Record<ExtendedLeadStatus, ExtendedLeadStatus[]> = {
  new: ["extracting"],
  extracting: ["needs_info", "ready_for_review"],
  needs_info: ["drafting", "approved", "rejected"],
  ready_for_review: ["drafting", "approved", "rejected"],
  drafting: ["approved", "rejected"],
  approved: ["sending", "closed", "rejected"],
  rejected: ["drafting", "closed"],
  sending: ["sent", "delivery_failed"],
  sent: ["closed"],
  delivery_failed: ["sending", "closed"],
  closed: ["drafting"],
};

export function canTransition(from: ExtendedLeadStatus, to: ExtendedLeadStatus) {
  return transitions[from].includes(to);
}

export function assertTransition(from: ExtendedLeadStatus, to: ExtendedLeadStatus) {
  if (!canTransition(from, to)) throw new Error(`Invalid workflow transition: ${from} → ${to}`);
}
