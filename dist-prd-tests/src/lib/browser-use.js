"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBrowserTask = runBrowserTask;
exports.getBrowserStreamUrl = getBrowserStreamUrl;
exports.extractFromPage = extractFromPage;
const logger_1 = require("./logger");
const BACKEND_URL = process.env.BROWSER_USE_BACKEND_URL ?? "http://localhost:8000";
async function runBrowserTask(goal, context, options) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                task: goal,
                url: context?.url,
                page_title: context?.title,
                headless: options?.headless ?? true,
            }),
        });
        if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            try {
                const err = (await res.json());
                detail = err.detail ?? err.error ?? detail;
            }
            catch {
                detail = (await res.text().catch(() => detail));
            }
            logger_1.logger.error("browser-use", "runBrowserTask rejected", detail);
            return { success: false, error: detail };
        }
        const data = (await res.json());
        return { success: true, task_id: data.task_id };
    }
    catch (err) {
        logger_1.logger.error("browser-use", "runBrowserTask threw", err);
        return { success: false, error: "Cannot reach browser agent backend" };
    }
}
function getBrowserStreamUrl() {
    return `${BACKEND_URL}/api/stream`;
}
async function extractFromPage(task) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/extract`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task }),
        });
        if (!res.ok) {
            logger_1.logger.error("browser-use", "extractFromPage rejected", res.status);
            return null;
        }
        const data = (await res.json());
        return data.result ?? null;
    }
    catch (err) {
        logger_1.logger.error("browser-use", "extractFromPage threw", err);
        return null;
    }
}
