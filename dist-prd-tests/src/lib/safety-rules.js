"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSuspiciousSignals = extractSuspiciousSignals;
exports.assessRiskLevel = assessRiskLevel;
exports.buildMemorySummary = buildMemorySummary;
exports.fallbackSafetyResponse = fallbackSafetyResponse;
const RISKY_PATTERNS = [
    { pattern: /act now/i },
    { pattern: /urgent/i },
    { pattern: /suspend/i },
    { pattern: /password/i },
    { pattern: /gift card/i },
    { pattern: /wire transfer/i },
    { pattern: /medicare number/i, allowOnGovernmentSite: true },
    { pattern: /credit card/i },
    { pattern: /debit card/i },
    { pattern: /verify your account/i },
    { pattern: /final notice/i },
    { pattern: /download/i },
];
const UNCERTAIN_PATTERNS = [
    /billing/i,
    /payment/i,
    /account/i,
    /login/i,
    /sign in/i,
    /update/i,
];
function isGovernmentUrl(url) {
    if (!url) {
        return false;
    }
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return hostname.endsWith(".gov");
    }
    catch {
        return false;
    }
}
function extractSuspiciousSignals(text, url) {
    const normalized = text.trim();
    const signals = new Set();
    const isGovernmentSite = isGovernmentUrl(url);
    if (!normalized) {
        return [];
    }
    for (const { pattern, allowOnGovernmentSite } of RISKY_PATTERNS) {
        if (isGovernmentSite && !allowOnGovernmentSite) {
            continue;
        }
        if (pattern.test(normalized)) {
            signals.add(pattern.source.replace(/\\/g, ""));
        }
    }
    for (const pattern of UNCERTAIN_PATTERNS) {
        if (pattern.test(normalized)) {
            signals.add(pattern.source.replace(/\\/g, ""));
        }
    }
    return Array.from(signals);
}
function assessRiskLevel(text, url) {
    const isGovernmentSite = isGovernmentUrl(url);
    if (isGovernmentSite) {
        return UNCERTAIN_PATTERNS.some((pattern) => pattern.test(text)) ? "uncertain" : "safe";
    }
    const riskyHits = RISKY_PATTERNS.filter(({ pattern, allowOnGovernmentSite }) => pattern.test(text) && !allowOnGovernmentSite).length;
    if (riskyHits >= 2) {
        return "risky";
    }
    if (riskyHits === 1) {
        return "uncertain";
    }
    if (UNCERTAIN_PATTERNS.some((pattern) => pattern.test(text))) {
        return "uncertain";
    }
    return "safe";
}
function buildMemorySummary(taskMemory, appointment) {
    const parts = [
        taskMemory?.currentTask ? `Current task: ${taskMemory.currentTask}` : null,
        taskMemory?.taskGoal ? `Task goal: ${taskMemory.taskGoal}` : null,
        taskMemory?.lastStep ? `Last step: ${taskMemory.lastStep}` : null,
        taskMemory?.currentStageTitle ? `Current stage: ${taskMemory.currentStageTitle}` : null,
        taskMemory?.nextStageTitle ? `Next stage: ${taskMemory.nextStageTitle}` : null,
        appointment?.summary ? `Next appointment: ${appointment.summary}` : null,
    ].filter(Boolean);
    return parts.join(". ");
}
function fallbackSafetyResponse(text, mode, url) {
    const riskLevel = assessRiskLevel(text, url);
    const suspiciousSignals = extractSuspiciousSignals(text, url);
    if (mode === "scam_check") {
        return {
            mode,
            summary: riskLevel === "risky"
                ? "This page has a few serious warning signs."
                : "I found a few signs worth checking carefully.",
            nextStep: riskLevel === "risky"
                ? "Do not enter personal information yet. Ask someone you trust to review it with you."
                : "Pause before sharing anything and compare the page with the official website you expect.",
            explanation: riskLevel === "risky"
                ? "The page is asking for sensitive information too quickly. It is safer to stop and verify it through a known phone number or official portal."
                : "The page has some warning signs, so it is safer to pause and verify the source before typing personal details.",
            riskLevel,
            suspiciousSignals,
        };
    }
    return {
        mode,
        summary: "I can help you stay oriented and safe.",
        nextStep: "Check the page details and only continue if it matches the official site you expect.",
        explanation: "I am keeping the language simple and the next step small on purpose. If anything asks for money, passwords, or a rushed decision, pause and verify it first.",
        riskLevel,
        suspiciousSignals,
    };
}
