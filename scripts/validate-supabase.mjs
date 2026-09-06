import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url);
const migrations = join(root.pathname, "supabase", "migrations");
const names = (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort();
if (!names.length) throw new Error("No Supabase migrations found");
const sql = (await Promise.all(names.map((name) => readFile(join(migrations, name), "utf8")))).join("\n").toLowerCase();
for (const required of ["app_users", "auth_identities", "workspaces", "workspace_memberships", "inquiries", "inquiry_events", "enable row level security", "inquiries_select_member", "inquiries_insert_operator", "inquiries_update_operator", "inquiries_delete_manager", "inquiry_events_select_member", "inquiry_events_insert_operator", "inquiry_events_update_denied", "inquiry_events_delete_denied"]) {
  if (!sql.includes(required)) throw new Error(`Migration contract missing: ${required}`);
}
if (sql.includes("supabase_service_role_key") || sql.includes("service_role")) throw new Error("Migration contains a server secret reference");
console.log(`Validated ${names.length} Supabase migration(s)`);
