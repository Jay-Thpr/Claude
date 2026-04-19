# Testing SafeStep

## Run the tests

```bash
npm test
```

This compiles TypeScript and runs all test files with Node's built-in test runner. No Jest, no Vitest, no extra setup.

## What's covered

### `tests/proactive.test.ts` — new proactive system (42 tests)

| Group | What it tests |
|---|---|
| **intent-router** | Scam/appointment/memory keywords route to the right mode; explicit mode override; `shouldUseBrowserUse` for action verbs |
| **safety-rules** | Urgent payment text → `risky`; login pages → `uncertain`; safe news articles → `safe`; pressure phrase detection |
| **orient route** | Safe page → `autoOpen=false`; risky page → `autoOpen=true` + proactive tip; ongoing task on same hostname → continuation tip; disconnected calendar → no appointment-based auto-open; malformed body → safe default |
| **gcal/upcoming route** | Disconnected calendar → empty list; appointments >4 hours away filtered out; appointments within 4 hours all returned; network failure → graceful empty response |
| **task/start route** | Gemini throws → fallback 2-step plan; valid Gemini JSON → parsed plan; malformed Gemini response → fallback; missing intent/url → fallback |
| **task/step route** | "stop"/"no" → `done:true`; last step → `done:true` with "all done" announcement; mid-task → advances to next step with memory update; empty steps → `done:true`; out-of-bounds index clamped |

### `tests/orchestration.test.ts` — API routes (6 tests)

Chat route, copilot/respond, scam-check, memory read/write, task-flow advance.

### `tests/prd.test.ts` — core lib (3 tests)

Appointment reminders, staged task flow, memory summary.

### `tests/next-step.test.ts` — next-step route (2 tests)

Medicare appointments use hardcoded flow; non-Medicare uses generic orchestrator.

## How the tests work

All route tests use **dependency injection** — each route exports a `handle*Request(req, deps)` function alongside the Next.js `GET`/`POST` export. Tests pass fake implementations for external dependencies (Gemini, Google Calendar, Supabase) so no real credentials are needed and tests run offline.

```ts
// Example: inject a fake calendar snapshot
const res = await handleOrientRequest(req, {
  loadCalendarSnapshot: async () => ({ connected: false, appointments: [] }),
});
```

Pure functions (`routeIntent`, `assessRiskLevel`, `extractSuspiciousSignals`) are called directly — no mocking needed.

## Adding a test

1. Open (or create) a file in `tests/`.
2. Import `test` and `assert` from Node's built-in modules:
   ```ts
   import test from "node:test";
   import assert from "node:assert/strict";
   ```
3. Add the file to `tsconfig.prd-tests.json` → `include` array.
4. Add the compiled output path to the `test:prd` script in `package.json`.
