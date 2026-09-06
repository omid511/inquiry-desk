import { describe, expect, it } from "vitest";
import { getStore, InMemoryInquiryStore } from "../lib/store";

describe("server-side workspace boundary", () => {
  it("does not return a session for another workspace membership", async () => {
    const store = new InMemoryInquiryStore();
    await store.createSession({ token: "session-1", userId: "demo-owner", workspaceId: "demo-workspace", role: "owner", expiresAt: new Date(Date.now() + 10000).toISOString() });
    expect(await store.getSession("session-1")).toMatchObject({ workspaceId: "demo-workspace" });
    expect(await store.getMembership("demo-owner", "other-workspace")).toBeNull();
    expect(await store.get("other-workspace", "missing")).toBeNull();
  });

  it("keeps demo mode isolated even when Supabase variables are present", () => {
    const previous = { demo: process.env.DEMO_MODE, url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
    process.env.DEMO_MODE = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";
    try {
      expect(getStore()).toBeInstanceOf(InMemoryInquiryStore);
    } finally {
      if (previous.demo === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = previous.demo;
      if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
      if (previous.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previous.key;
    }
  });
});
