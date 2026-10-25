import "server-only";
import { createAdminClient } from "./supabase/admin";

export type FailureReason = "no_recipe" | "blocked" | "error";

/** Adds a link we couldn't read to the analysis queue. Never throws. */
export async function recordFailure(url: string, reason: FailureReason, message: string) {
  const supabase = createAdminClient();
  if (!supabase) return;
  const { error } = await supabase.rpc("record_extraction_failure", {
    page_url: url,
    failure_reason: reason,
    failure_message: message,
  });
  if (error) console.error("Recording extraction failure failed", error);
}
