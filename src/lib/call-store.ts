import { createServerSupabaseClient } from "./supabase-server";
import { logger } from "./logger";

export type CallSessionStatus =
  | "queued"
  | "initiated"
  | "ringing"
  | "in-progress"
  | "completed"
  | "busy"
  | "no-answer"
  | "failed"
  | "canceled";

export interface CallSessionRecord {
  id?: string;
  user_id: string;
  provider_name: string;
  phone_number: string;
  patient_name: string;
  callback_number: string | null;
  call_goal: string;
  consent_confirmed: boolean;
  initiated_by: string;
  status: CallSessionStatus;
  twilio_call_sid?: string | null;
  appointment_context?: Record<string, unknown> | null;
  constraints?: string[] | null;
  disposition?: string | null;
  callback_requested?: boolean | null;
  appointment_confirmed?: boolean | null;
  voicemail_detected?: boolean | null;
  call_duration_seconds?: number | null;
  recording_url?: string | null;
  recording_sid?: string | null;
  transcript_excerpt?: string | null;
  outcome_summary?: string | null;
  status_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function createCallSession(
  record: Omit<CallSessionRecord, "created_at" | "updated_at">
): Promise<CallSessionRecord | null> {
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) return null;

    const payload = {
      ...record,
      callback_number: record.callback_number ?? null,
      appointment_context: record.appointment_context ?? null,
      constraints: record.constraints ?? [],
      disposition: record.disposition ?? null,
      callback_requested: record.callback_requested ?? null,
      appointment_confirmed: record.appointment_confirmed ?? null,
      voicemail_detected: record.voicemail_detected ?? null,
      call_duration_seconds: record.call_duration_seconds ?? null,
      recording_url: record.recording_url ?? null,
      recording_sid: record.recording_sid ?? null,
      transcript_excerpt: record.transcript_excerpt ?? null,
      outcome_summary: record.outcome_summary ?? null,
      status_message: record.status_message ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("call_sessions")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      logger.error("call-store", "createCallSession failed", error);
      return null;
    }

    return data as CallSessionRecord;
  } catch (err) {
    logger.error("call-store", "createCallSession threw", err);
    return null;
  }
}

export async function updateCallSession(
  id: string,
  patch: Partial<CallSessionRecord>
): Promise<void> {
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) return;

    const { error } = await supabase
      .from("call_sessions")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      logger.error("call-store", "updateCallSession failed", error);
    }
  } catch (err) {
    logger.error("call-store", "updateCallSession threw", err);
  }
}

export async function getCallSession(id: string): Promise<CallSessionRecord | null> {
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("call_sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      logger.error("call-store", "getCallSession failed", error);
      return null;
    }

    return data as CallSessionRecord;
  } catch (err) {
    logger.error("call-store", "getCallSession threw", err);
    return null;
  }
}
