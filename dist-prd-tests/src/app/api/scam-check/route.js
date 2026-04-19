"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.handleScamCheckRequest = handleScamCheckRequest;
const scam_store_1 = require("../../../lib/scam-store");
const scam_signals_1 = require("../../../lib/scam-signals");
const twilio_1 = require("../../../lib/twilio");
const logger_1 = require("../../../lib/logger");
const DEMO_USER_ID = "demo-user-001";
async function POST(request) {
    return handleScamCheckRequest(request);
}
async function handleScamCheckRequest(request, deps = {}) {
    let body;
    try {
        body = (await request.json());
    }
    catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { url, content, question, pageTitle, actions } = body;
    try {
        const signals = url ? (0, scam_signals_1.extractScamSignals)(url, content || "") : null;
        const signalContext = signals ? (0, scam_signals_1.signalsToPromptContext)(signals) : null;
        const orchestrateCopilot = deps.orchestrateCopilot ?? (await Promise.resolve().then(() => __importStar(require("../../../lib/orchestrator")))).orchestrateCopilot;
        const response = await orchestrateCopilot({
            mode: "scam_check",
            query: content || question,
            url,
            pageTitle,
            visibleText: content,
            pageSummary: signalContext ?? undefined,
        });
        const classification = response.riskLevel === "safe"
            ? "safe"
            : response.riskLevel === "risky"
                ? "risky"
                : "not-sure";
        const isRisky = classification === "risky";
        const blocked = isRisky && (actions?.blockOnRisky ?? false);
        void (async () => {
            try {
                const log = deps.logScamCheck ?? scam_store_1.logScamCheck;
                await log({
                    user_id: DEMO_USER_ID,
                    url: url ?? null,
                    classification,
                    explanation: response.explanation || "",
                    risk_signals: response.suspiciousSignals || [],
                });
            }
            catch (err) {
                logger_1.logger.error("scam-check", "logScamCheck failed", err);
            }
            if (isRisky && actions?.notifyPhone) {
                const siteLabel = url ? new URL(url).hostname : "a website";
                const message = `SafeStep Alert: A potentially risky site was detected (${siteLabel}). ` +
                    `The user has been warned and the action was ${blocked ? "blocked" : "flagged"}. ` +
                    `Reason: ${response.explanation?.slice(0, 200) ?? "suspicious signals detected."}`;
                try {
                    await (0, twilio_1.sendSms)(actions.notifyPhone, message);
                }
                catch (err) {
                    logger_1.logger.error("scam-check", "notifyPhone SMS failed", err);
                }
            }
        })();
        const result = {
            classification,
            explanation: response.explanation || "",
            suspicious_signals: response.suspiciousSignals || [],
            blocked,
        };
        return Response.json(result);
    }
    catch (err) {
        logger_1.logger.error("scam-check", "handler threw", err);
        return Response.json({
            classification: "not-sure",
            explanation: "I'm having trouble checking this right now. If the website is asking for personal information or money, please wait and ask a family member or friend first.",
            suspicious_signals: [],
            blocked: false,
        }, { status: 500 });
    }
}
