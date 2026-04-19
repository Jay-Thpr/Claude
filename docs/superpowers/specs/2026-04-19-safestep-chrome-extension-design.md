# SafeStep Chrome Extension — Design Spec
Date: 2026-04-19

## Overview

A vanilla HTML/CSS/JS Chrome extension that adds a toolbar popup to SafeStep. The popup fetches upcoming appointment data from the existing Next.js backend (`localhost:3000/api/appointments`) and displays it in a senior-friendly UI. No build step. No content script. No DOM injection. Loads unpacked directly in Chrome.

## Scope

Single feature: **Appointments**. The extension is a thin UI client over the existing API — no new backend logic.

## File Structure

```
chrome-extension/
  manifest.json
  popup.html
  popup.js
  popup.css
  icon.png          (placeholder — any 128×128 PNG)
```

## manifest.json

- Manifest version 3
- Name: "SafeStep"
- Description: "Your senior-friendly browser copilot"
- Version: "1.0"
- Action: default popup → `popup.html`, default icon → `icon.png`
- Permissions: none required (fetch to localhost is allowed by default in MV3 popups)
- No content scripts, no background service worker

## API Contract

**Endpoint:** `GET http://localhost:3000/api/appointments`

**Response fields used by the extension:**

| Field | Type | Usage |
|---|---|---|
| `appointment.summary` | string | Appointment title |
| `appointment.whenLabel` | string | e.g. "tomorrow" |
| `appointment.timeLabel` | string | e.g. "2:00 PM" |
| `appointment.location` | string \| null | Location if present |
| `prep_advice` | string \| null | AI-generated prep note |
| `message` | string | Fallback display message |
| `source` | string | "demo", "google-calendar", "supabase" |

The API already falls back to demo data when calendar is disconnected — the extension needs no special handling for the unconnected state.

## popup.html

Static HTML shell with three states rendered by JS:

1. **Loading** — "Getting your appointments…" centered with a soft spinner
2. **Loaded** — appointment card showing summary, when/time, location (if present), prep advice (if present)
3. **Error** — "Could not load appointments. Make sure the app is running at localhost:3000."

## popup.js

On `DOMContentLoaded`:
1. Show loading state
2. `fetch('http://localhost:3000/api/appointments')`
3. On success: render appointment card from response fields
4. On failure: render error state

No caching. No auth headers. No retry logic.

## popup.css

Senior-friendly design constraints:
- Popup width: 380px, min-height: 400px
- Body font: system-ui, 18px base
- Headings: 22–26px
- Line height: 1.6
- Color palette: calm blue (#1a6fad) header, white background, dark gray text (#222)
- High contrast throughout (WCAG AA minimum)
- Large tap targets (buttons min 48px tall)
- No small text, no gray-on-gray, no jargon

## API Base Config

`const API_BASE = 'http://localhost:3000'` at the top of `popup.js`. Easy to swap for deployment.

## What This Does NOT Include

- Scam check button (placeholder only, no wiring)
- "What do I do next?" button (placeholder only)
- Content script / page context reading
- Background service worker
- Google Calendar OAuth (handled by the Next.js app)
- Publishing to Chrome Web Store

## Loading Into Chrome

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select the `chrome-extension/` folder

## Demo Flow

User clicks the SafeStep icon in the Chrome toolbar → popup opens → appointments load from the local Next.js backend → user sees their next appointment in large, readable text with prep advice.
