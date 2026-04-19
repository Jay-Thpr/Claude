"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeGoogleIdentity = normalizeGoogleIdentity;
exports.loadGoogleIdentityFromCookies = loadGoogleIdentityFromCookies;
exports.resolveGoogleAccount = resolveGoogleAccount;
const gcal_1 = require("./gcal");
function normalizeEmail(email) {
    const trimmed = email?.trim().toLowerCase() || "";
    return trimmed || null;
}
function normalizeGoogleIdentity(profile) {
    const email = normalizeEmail(profile?.email);
    if (!email) {
        return null;
    }
    return {
        userId: email,
        email,
        name: profile?.name?.trim() || undefined,
        connected: true,
    };
}
async function loadGoogleIdentityFromCookies(cookieStore) {
    try {
        const profile = (0, gcal_1.parseCookieValue)(cookieStore.get(gcal_1.GCAL_COOKIE_NAMES.profile)?.value);
        if (profile) {
            return normalizeGoogleIdentity(profile);
        }
        const snapshot = await (0, gcal_1.loadCalendarSnapshot)(cookieStore);
        return normalizeGoogleIdentity(snapshot.profile);
    }
    catch {
        return null;
    }
}
function resolveGoogleAccount(identity, fallback) {
    const email = normalizeEmail(identity?.email || fallback?.email) || undefined;
    const name = identity?.name?.trim() || fallback?.name?.trim() || undefined;
    return {
        userId: identity?.userId || email || null,
        email,
        name,
        connected: Boolean(identity?.connected),
    };
}
