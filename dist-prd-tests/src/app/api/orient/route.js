"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleOrientRequest = handleOrientRequest;
exports.POST = POST;
const headers_1 = require("next/headers");
const safety_rules_1 = require("../../../lib/safety-rules");
const gcal_1 = require("../../../lib/gcal");
const SAFE_DEFAULT = {
    safetyTone: "safe",
    safetyExplanation: "This page looks safe.",
    proactiveTip: null,
    autoOpen: false,
    suggestedActions: ["I'm fine", "Help me with something"],
    bullets: [],
};
function isRelatedUrl(taskUrl, currentUrl) {
    if (!taskUrl)
        return false;
    try {
        const taskHost = new URL(taskUrl).hostname;
        const currentHost = new URL(currentUrl).hostname;
        return taskHost === currentHost;
    }
    catch {
        return false;
    }
}
function appointmentWithinMinutes(whenLabel, timeLabel, minutes) {
    if (!whenLabel || !timeLabel)
        return false;
    try {
        const isToday = whenLabel.toLowerCase() === "today";
        if (!isToday)
            return false;
        // Parse time like "2:30 PM"
        const now = new Date();
        const [timePart, meridiem] = timeLabel.split(" ");
        const [hourStr, minuteStr] = timePart.split(":");
        let hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr || "0", 10);
        if (meridiem?.toUpperCase() === "PM" && hour !== 12)
            hour += 12;
        if (meridiem?.toUpperCase() === "AM" && hour === 12)
            hour = 0;
        const apptTime = new Date(now);
        apptTime.setHours(hour, minute, 0, 0);
        const diffMs = apptTime.getTime() - now.getTime();
        const diffMinutes = diffMs / (1000 * 60);
        return diffMinutes >= 0 && diffMinutes <= minutes;
    }
    catch {
        return false;
    }
}
async function handleOrientRequest(request, deps = {}) {
    let body;
    try {
        body = (await request.json());
    }
    catch {
        return Response.json(SAFE_DEFAULT);
    }
    const { url, pageTitle, pageText, taskMemory } = body;
    try {
        // 1. Safety signals
        const textToCheck = [url, pageTitle, pageText].filter(Boolean).join(" ");
        const suspiciousSignals = (0, safety_rules_1.extractSuspiciousSignals)(textToCheck);
        const riskLevel = (0, safety_rules_1.assessRiskLevel)(textToCheck);
        const safetyTone = riskLevel === "risky" ? "risky" : riskLevel === "uncertain" ? "uncertain" : "safe";
        let safetyExplanation = "This page looks safe.";
        if (riskLevel === "risky") {
            safetyExplanation =
                "This page has some warning signs. Please be careful before entering any personal information.";
        }
        else if (riskLevel === "uncertain") {
            safetyExplanation =
                "This page is asking for information. Make sure you recognize this website before continuing.";
        }
        // 2. Calendar snapshot
        let snapshot;
        try {
            if (deps.loadCalendarSnapshot) {
                snapshot = await deps.loadCalendarSnapshot();
            }
            else {
                const cookieStore = await (0, headers_1.cookies)();
                snapshot = await (0, gcal_1.loadCalendarSnapshot)(cookieStore);
            }
        }
        catch {
            snapshot = null;
        }
        const nextAppt = snapshot?.connected ? snapshot.nextAppointment : null;
        const apptSoon = nextAppt !== null && nextAppt !== undefined &&
            appointmentWithinMinutes(nextAppt.whenLabel, nextAppt.timeLabel, 120);
        // 3. Task memory — was the user in the middle of something on this domain?
        const hasOngoingTask = taskMemory?.currentTask != null &&
            taskMemory.currentTask.trim() !== "" &&
            isRelatedUrl(taskMemory.currentUrl, url);
        // 4. autoOpen logic
        const autoOpen = riskLevel === "risky" || apptSoon || hasOngoingTask;
        // 5. Build proactiveTip
        let proactiveTip = null;
        if (riskLevel === "risky") {
            const signalList = suspiciousSignals.slice(0, 2).join(", ");
            proactiveTip = `This page may not be safe${signalList ? ` (noticed: ${signalList})` : ""}. Would you like help checking it?`;
        }
        else if (apptSoon && nextAppt) {
            const timePart = nextAppt.timeLabel ? ` at ${nextAppt.timeLabel}` : "";
            const minutesAway = (() => {
                try {
                    const now = new Date();
                    const [timePt, mer] = (nextAppt.timeLabel ?? "").split(" ");
                    const [h, m] = timePt.split(":");
                    let hour = parseInt(h, 10);
                    const minute = parseInt(m || "0", 10);
                    if (mer?.toUpperCase() === "PM" && hour !== 12)
                        hour += 12;
                    if (mer?.toUpperCase() === "AM" && hour === 12)
                        hour = 0;
                    const apptDate = new Date(now);
                    apptDate.setHours(hour, minute, 0, 0);
                    return Math.round((apptDate.getTime() - now.getTime()) / 60000);
                }
                catch {
                    return null;
                }
            })();
            const timeHint = minutesAway !== null && minutesAway > 0
                ? `in ${minutesAway} minute${minutesAway === 1 ? "" : "s"}`
                : `today${timePart}`;
            proactiveTip = `Your appointment "${nextAppt.summary}" is ${timeHint}. Would you like help preparing?`;
        }
        else if (hasOngoingTask && taskMemory?.currentTask) {
            proactiveTip = `You were working on "${taskMemory.currentTask}" here. Would you like to continue where you left off?`;
        }
        // 6. suggestedActions
        let suggestedActions;
        if (riskLevel === "risky") {
            suggestedActions = ["Yes, check this page", "Leave this page", "I'm fine"];
        }
        else if (apptSoon) {
            suggestedActions = ["Yes, help me prepare", "Remind me later", "I'm fine"];
        }
        else if (hasOngoingTask) {
            suggestedActions = ["Yes, continue task", "Start something new", "I'm fine"];
        }
        else {
            suggestedActions = ["I need help", "I'm fine"];
        }
        // 7. bullets — surface suspicious signals as readable notes
        const bullets = suspiciousSignals.map((s) => `Noticed: "${s}" on this page`);
        const result = {
            safetyTone,
            safetyExplanation,
            proactiveTip,
            autoOpen,
            suggestedActions,
            bullets,
        };
        return Response.json(result);
    }
    catch {
        return Response.json(SAFE_DEFAULT);
    }
}
async function POST(request) {
    return handleOrientRequest(request);
}
