"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logScamCheck = logScamCheck;
exports.getRecentScamChecks = getRecentScamChecks;
const supabase_server_1 = require("./supabase-server");
const logger_1 = require("./logger");
async function logScamCheck(record) {
    try {
        const supabase = (0, supabase_server_1.createServerSupabaseClient)();
        if (!supabase)
            return;
        const { error } = await supabase.from("scam_checks").insert({
            user_id: record.user_id,
            url: record.url,
            classification: record.classification,
            explanation: record.explanation,
            risk_signals: record.risk_signals,
            created_at: new Date().toISOString(),
        });
        if (error) {
            logger_1.logger.error("scam-store", "logScamCheck failed", error);
        }
    }
    catch (err) {
        logger_1.logger.error("scam-store", "logScamCheck threw", err);
    }
}
async function getRecentScamChecks(userId, limit = 10) {
    try {
        const supabase = (0, supabase_server_1.createServerSupabaseClient)();
        if (!supabase)
            return [];
        const { data, error } = await supabase
            .from("scam_checks")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);
        if (error) {
            logger_1.logger.error("scam-store", "getRecentScamChecks failed", error);
            return [];
        }
        return data ?? [];
    }
    catch (err) {
        logger_1.logger.error("scam-store", "getRecentScamChecks threw", err);
        return [];
    }
}
