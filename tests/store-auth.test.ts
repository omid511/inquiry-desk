import { describe, expect, it } from "vitest";
import { InMemoryInquiryStore } from "../lib/store";

describe("server-side workspace boundary", () => {
  it("does not return a session for another workspace membership", async () => {
    const store = new InMemoryInquiryStore();
    await store.createSession({ token: "session-1", userId: "demo-owner", workspaceId: "demo-workspace", role: "owner", expiresAt: new Date(Date.now() + 10000).toISOString() });
    expect(await store.getSession("session-1")).toMatchObject({ workspaceId: "demo-workspace" });
    expect(await store.getMembership("demo-owner", "other-workspace")).toBeNull();
    expect(await store.get("other-workspace", "missing")).toBeNull();
  });
});
