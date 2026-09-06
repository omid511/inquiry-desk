import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "supabase.exe" : "supabase";
const available = spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
if (!available) {
  console.warn("Supabase CLI is unavailable; migration contract validation still ran, database/RLS tests were not executed.");
  process.exit(0);
}
for (const args of [["db", "reset", "--local", "--no-seed"], ["test", "db"]]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
