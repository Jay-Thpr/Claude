"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractScamSignals = extractScamSignals;
exports.signalsToPromptContext = signalsToPromptContext;
const SUSPICIOUS_TLDS = new Set([
    "xyz", "click", "top", "loan", "work", "gq", "ml", "cf", "ga", "tk",
    "pw", "cc", "biz", "info", "live", "online", "site", "website", "store",
]);
const URGENCY_PATTERNS = [
    "act now", "urgent", "immediately", "account will be", "account has been",
    "suspended", "verify now", "verify your", "click here now", "limited time",
    "expires today", "expires soon", "call now", "you have been selected",
    "won a prize", "final notice", "last chance", "respond immediately",
    "your package", "confirm your identity",
];
const SENSITIVE_PATTERNS = [
    "social security", "ssn", "credit card", "debit card", "gift card",
    "wire transfer", "bank account", "routing number", "medicare number",
    "medicaid", "password", "pin number", "date of birth", "mother's maiden",
];
// Known brands and their expected domain keywords
const BRAND_DOMAINS = {
    medicare: ["medicare.gov"],
    "social security": ["ssa.gov"],
    cvs: ["cvs.com"],
    walgreens: ["walgreens.com"],
    "cvs pharmacy": ["cvs.com"],
    "united healthcare": ["uhc.com", "unitedhealthcare.com"],
    aetna: ["aetna.com"],
    humana: ["humana.com"],
    "bank of america": ["bankofamerica.com"],
    chase: ["chase.com"],
    wells: ["wellsfargo.com"],
};
function extractDomain(url) {
    try {
        return new URL(url).hostname.toLowerCase();
    }
    catch {
        return null;
    }
}
function extractTld(domain) {
    const parts = domain.split(".");
    return parts[parts.length - 1];
}
function detectBrandMismatch(domain, text) {
    const lowerText = text.toLowerCase();
    for (const [brand, trustedDomains] of Object.entries(BRAND_DOMAINS)) {
        if (lowerText.includes(brand)) {
            const domainMatchesAny = trustedDomains.some((d) => domain.includes(d));
            if (!domainMatchesAny) {
                return { mismatch: true, brand };
            }
        }
    }
    return { mismatch: false, brand: null };
}
function extractScamSignals(url, text = "") {
    const domain = extractDomain(url);
    const lowerText = text.toLowerCase();
    const isHttps = url.startsWith("https://");
    const tld = domain ? extractTld(domain) : "";
    const hasSuspiciousTld = SUSPICIOUS_TLDS.has(tld);
    const urgencyMatches = URGENCY_PATTERNS.filter((p) => lowerText.includes(p));
    const hasUrgencyLanguage = urgencyMatches.length > 0;
    const sensitiveMatches = SENSITIVE_PATTERNS.filter((p) => lowerText.includes(p));
    const hasSensitiveDataRequest = sensitiveMatches.length > 0;
    const { mismatch: hasDomainMismatch, brand: suspectedBrand } = domain
        ? detectBrandMismatch(domain, text)
        : { mismatch: false, brand: null };
    const signalCount = [
        !isHttps,
        hasSuspiciousTld,
        hasUrgencyLanguage,
        hasSensitiveDataRequest,
        hasDomainMismatch,
    ].filter(Boolean).length;
    return {
        isHttps,
        hasSuspiciousTld,
        tld,
        hasUrgencyLanguage,
        urgencyMatches,
        hasSensitiveDataRequest,
        sensitiveMatches,
        hasDomainMismatch,
        suspectedBrand,
        domain,
        signalCount,
    };
}
function signalsToPromptContext(signals) {
    const lines = ["Pre-analysis signals:"];
    lines.push(`- HTTPS: ${signals.isHttps ? "yes" : "NO (insecure connection)"}`);
    if (signals.hasSuspiciousTld)
        lines.push(`- Suspicious TLD: .${signals.tld}`);
    if (signals.hasUrgencyLanguage)
        lines.push(`- Urgency language detected: "${signals.urgencyMatches.slice(0, 3).join('", "')}"`);
    if (signals.hasSensitiveDataRequest)
        lines.push(`- Sensitive data requested: "${signals.sensitiveMatches.slice(0, 3).join('", "')}"`);
    if (signals.hasDomainMismatch)
        lines.push(`- Domain mismatch: page mentions "${signals.suspectedBrand}" but domain is ${signals.domain}`);
    if (signals.signalCount === 0)
        lines.push("- No obvious heuristic signals detected");
    return lines.join("\n");
}
