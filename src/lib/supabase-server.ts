import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Server-side Supabase client for use in API routes.
 * For hackathon MVP, uses the same anon key. In production,
 * you'd use a service role key here.
 */
export function createServerSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}
