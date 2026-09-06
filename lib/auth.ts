import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "./supabase/admin";
import { createServerSupabaseClient } from "./supabase/server";

export interface ApplicationUser { id: string; email: string; }

function userEmail(user: User) {
  if (!user.email) throw new Error("AUTH_EMAIL_REQUIRED");
  return user.email.trim().toLowerCase();
}

/**
 * The service-role client is deliberately limited to this idempotent identity
 * bridge. Business reads/writes use the request-scoped user client in store.ts.
 */
export async function ensureApplicationUser(user: User): Promise<ApplicationUser> {
  const admin = createSupabaseAdminClient();
  const email = userEmail(user);
  const { data: existingIdentity, error: identityLookupError } = await admin
    .from("auth_identities")
    .select("app_user_id,email")
    .eq("provider", "supabase")
    .eq("subject", user.id)
    .maybeSingle();
  if (identityLookupError) throw identityLookupError;

  let appUserId = existingIdentity?.app_user_id;
  let shouldProvisionMembership = false;
  if (!appUserId) {
    const { data: appUser, error: appUserError } = await admin
      .from("app_users")
      .upsert({ email, display_name: typeof user.user_metadata?.name === "string" ? user.user_metadata.name.slice(0, 160) : null }, { onConflict: "email" })
      .select("id,email")
      .single();
    if (appUserError || !appUser) throw appUserError || new Error("APP_USER_PROVISIONING_FAILED");
    appUserId = appUser.id;
    shouldProvisionMembership = true;
    const { error: identityError } = await admin.from("auth_identities").insert({ app_user_id: appUserId, provider: "supabase", subject: user.id, email });
    if (identityError && identityError.code !== "23505") throw identityError;
  } else if (existingIdentity && existingIdentity.email !== email) {
    const { error: updateError } = await admin.from("auth_identities").update({ email }).eq("provider", "supabase").eq("subject", user.id);
    if (updateError) throw updateError;
  }

  const workspaceId = process.env.DEFAULT_WORKSPACE_ID || process.env.PUBLIC_WORKSPACE_ID;
  if (workspaceId && shouldProvisionMembership) {
    const configuredRole = process.env.DEFAULT_WORKSPACE_ROLE;
    const role = configuredRole === "owner" || configuredRole === "manager" || configuredRole === "operator" || configuredRole === "viewer" ? configuredRole : "viewer";
    const { error: membershipError } = await admin.from("workspace_memberships").upsert({ app_user_id: appUserId, workspace_id: workspaceId, role }, { onConflict: "workspace_id,app_user_id", ignoreDuplicates: true });
    if (membershipError) throw membershipError;
  }
  return { id: appUserId, email };
}

export async function getAuthenticatedUser() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function signOutCurrentUser() {
  const client = await createServerSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
