"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
function log(level, module, message, data) {
    const entry = `[${level.toUpperCase()}] [${module}] ${message}`;
    if (data !== undefined) {
        console[level](entry, data);
    }
    else {
        console[level](entry);
    }
}
exports.logger = {
    info: (module, message, data) => log("info", module, message, data),
    warn: (module, message, data) => log("warn", module, message, data),
    error: (module, message, data) => log("error", module, message, data),
};
