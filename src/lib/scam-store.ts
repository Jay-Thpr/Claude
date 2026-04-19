import { createServerSupabaseClient } from "./supabase-server";
import { logger } from "./logger";

export interface ScamCheckRecord {
  check_id?: string;
  user_id: string;
  url: string | null;
  classification: "safe" | "not-sure" | "risky";
  explanation: string;
  risk_signals: string[];
  created_at?: string;
}

export async function logScamCheck(record: ScamCheckRecord): Promise<void> {
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) return;

    const { error } = await supabase.from("scam_checks").insert({
      user_id: record.user_id,
      url: record.url,
      classification: record.classification,
      explanation: record.explanation,
      risk_signals: record.risk_signals,
      created_at: new Date().toISOString(),
    });

    if (error) {
      logger.error("scam-store", "logScamCheck failed", error);
    }
  } catch (err) {
    logger.error("scam-store", "logScamCheck threw", err);
  }
}

export async function getRecentScamChecks(
  userId: string,
  limit = 10
): Promise<ScamCheckRecord[]> {
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("scam_checks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error("scam-store", "getRecentScamChecks failed", error);
      return [];
    }

    return data ?? [];
  } catch (err) {
    logger.error("scam-store", "getRecentScamChecks threw", err);
    return [];
  }
}
