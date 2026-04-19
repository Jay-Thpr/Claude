"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasSupabaseConfig = hasSupabaseConfig;
exports.createServerSupabaseClient = createServerSupabaseClient;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
function hasSupabaseConfig() {
    return Boolean(supabaseUrl && supabaseServiceKey);
}
/**
 * Server-side Supabase client for use in API routes.
 * Prefers the service role key so protected tables can be queried securely.
 */
function createServerSupabaseClient() {
    if (!hasSupabaseConfig()) {
        return null;
    }
    return (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
}
