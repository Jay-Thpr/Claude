# SafeStep UI Redesign — Overlay Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-pane layout with a full-screen browser area and a floating overlay copilot panel triggered by a FAB in the lower-right corner.

**Architecture:** `page.tsx` owns the FAB toggle state and renders `BrowserTaskArea` full-screen with the overlay panel floating above it. `CopilotPanel` becomes pure panel content (no outer shell). All new layout/FAB/panel styles live in `globals.css`.

**Tech Stack:** Next.js 15, React, Tailwind v4, existing CSS custom properties

---

## File Map

| File | Change |
|------|--------|
| `src/app/globals.css` | Add: cream bg, amber/indigo tokens, FAB styles, overlay panel styles, slide animation |
| `src/app/page.tsx` | Rewrite: full-screen browser, FAB button, panel open/close state |
| `src/components/CopilotPanel.tsx` | Strip outer wrapper — becomes panel content only; update button colors |
| `src/components/BrowserTaskArea.tsx` | Remove fixed height/overflow constraints so it fills viewport |

---

### Task 1: Add new design tokens and overlay styles to globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add new color tokens inside the `@theme` block**

In `src/app/globals.css`, find the closing `}` of the `@theme { }` block and insert before it:

```css
  /* Extended palette for overlay redesign */
  --color-amber-500: #d97706;
  --color-amber-600: #b45309;
  --color-indigo-500: #4f46e5;
  --color-indigo-600: #4338ca;
  --color-fab: #1a7a6e;
  --color-fab-hover: #15685d;
  --color-canvas: #fbf8f4;
```

- [ ] **Step 2: Update the body background to warm cream**

Find:
```css
body {
  font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
  color: var(--color-text-primary);
  background-color: var(--color-surface-50);
```

Replace `background-color: var(--color-surface-50);` with:
```css
  background-color: var(--color-canvas);
```

- [ ] **Step 3: Replace `.app-layout` with `.app-shell` full-screen rule**

Find and replace the entire `.app-layout` block:
```css
.app-layout {
  display: grid;
  grid-template-columns: 1fr 420px;
  height: 100vh;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
}
```

With:
```css
.app-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--color-canvas);
}
```

- [ ] **Step 4: Add FAB styles**

After `.app-shell { }`, add:

```css
/* Floating Action Button */
.fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-fab);
  color: white;
  font-size: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  z-index: 100;
  transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
}

.fab:hover {
  background: var(--color-fab-hover);
  transform: scale(1.05);
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.22);
}

.fab:active {
  transform: scale(0.97);
}
```

- [ ] **Step 5: Add overlay panel styles**

After `.fab:active { }`, add:

```css
/* Overlay copilot panel */
.overlay-panel {
  position: fixed;
  bottom: 100px;
  right: 24px;
  width: 420px;
  max-height: 600px;
  background: rgba(251, 248, 244, 0.97);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.14);
  border: 1px solid var(--color-surface-200);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 99;
  transform-origin: bottom right;
  animation: panelSlideIn 0.25s ease-out forwards;
}

.overlay-panel-closing {
  animation: panelSlideOut 0.2s ease-in forwards;
}

@media (max-width: 480px) {
  .overlay-panel {
    width: calc(100vw - 16px);
    right: 8px;
    bottom: 88px;
  }
}
```

- [ ] **Step 6: Add slide animations**

After the overlay panel styles, add:

```css
@keyframes panelSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes panelSlideOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
}
```

- [ ] **Step 7: Remove the old `.copilot-panel` block and update `.browser-area`**

Find and delete the entire `.copilot-panel` block:
```css
/* Copilot panel — right side */
.copilot-panel {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(245, 243, 240, 0.98) 100%
  );
  backdrop-filter: blur(20px);
  border-left: 1px solid var(--color-surface-200);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

Find and replace `.browser-area { }`:
```css
/* Browser task area — left side */
.browser-area {
  background: var(--color-surface-100);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```
With:
```css
/* Browser task area — fills viewport */
.browser-area {
  width: 100%;
  height: 100%;
  background: var(--color-surface-100);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

- [ ] **Step 8: Add panel inner layout classes**

Add after `.browser-area { }`:

```css
/* Panel inner sections */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--color-surface-200);
  flex-shrink: 0;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.panel-section {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-surface-200);
}

.panel-section:last-child {
  border-bottom: none;
}
```

- [ ] **Step 9: Add amber and indigo action button variants**

Find `.action-btn-secondary { }` and add after it:

```css
.action-btn-amber {
  background: linear-gradient(135deg, #d97706, #b45309);
  color: white;
  border-color: transparent;
}

.action-btn-amber:hover {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.action-btn-indigo {
  background: linear-gradient(135deg, #4f46e5, #4338ca);
  color: white;
  border-color: transparent;
}

.action-btn-indigo:hover {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
}
```

- [ ] **Step 10: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add overlay panel, FAB, and warm companion tokens to globals.css"
```

---

### Task 2: Rewrite page.tsx with FAB and overlay panel

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Rewrite page.tsx**

Replace the entire file contents with:

```tsx
"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import CopilotPanel from "@/components/CopilotPanel";
import BrowserTaskArea from "@/components/BrowserTaskArea";
import CalendarNoticeBanner from "@/components/CalendarNoticeBanner";

export default function Home() {
  const [currentUrl, setCurrentUrl] = useState("");
  const [currentPageTitle, setCurrentPageTitle] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openPanel = () => {
    if (closing) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setClosing(false);
    }
    setPanelOpen(true);
  };

  const closePanel = () => {
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setPanelOpen(false);
      setClosing(false);
    }, 200);
  };

  const togglePanel = () => {
    if (panelOpen && !closing) {
      closePanel();
    } else {
      openPanel();
    }
  };

  return (
    <div className="app-shell">
      <Suspense fallback={null}>
        <CalendarNoticeBanner />
      </Suspense>

      {/* Full-screen browser area */}
      <BrowserTaskArea
        onUrlChange={setCurrentUrl}
        onPageTitleChange={setCurrentPageTitle}
      />

      {/* Overlay copilot panel */}
      {panelOpen && (
        <div className={`overlay-panel${closing ? " overlay-panel-closing" : ""}`}>
          <CopilotPanel
            currentUrl={currentUrl}
            currentPageTitle={currentPageTitle}
            onClose={closePanel}
          />
        </div>
      )}

      {/* Floating Action Button */}
      <button
        className="fab"
        onClick={togglePanel}
        aria-label={panelOpen ? "Close SafeStep" : "Open SafeStep"}
        title={panelOpen ? "Close SafeStep" : "Open SafeStep"}
      >
        {panelOpen && !closing ? "✕" : "🦮"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: replace two-pane layout with full-screen browser + FAB overlay"
```

---

### Task 3: Update CopilotPanel to be overlay-content only

**Files:**
- Modify: `src/components/CopilotPanel.tsx`

- [ ] **Step 1: Add `onClose` to props interface**

Find:
```tsx
interface CopilotPanelProps {
  currentUrl: string;
  currentPageTitle: string;
}
```

Replace with:
```tsx
interface CopilotPanelProps {
  currentUrl: string;
  currentPageTitle: string;
  onClose: () => void;
}
```

- [ ] **Step 2: Destructure `onClose` in the component signature**

Find:
```tsx
export default function CopilotPanel({
  currentUrl,
  currentPageTitle,
}: CopilotPanelProps) {
```

Replace with:
```tsx
export default function CopilotPanel({
  currentUrl,
  currentPageTitle,
  onClose,
}: CopilotPanelProps) {
```

- [ ] **Step 3: Replace the outer wrapper and header**

Find:
```tsx
  return (
    <div className="copilot-panel" id="copilot-panel">
      {/* Header */}
      <div className="p-6 border-b border-surface-200">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xl">
            🦮
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary leading-tight">
              SafeStep
            </h1>
            <p className="text-sm text-text-muted">
              Your browsing companion
            </p>
          </div>
        </div>
      </div>
```

Replace with:
```tsx
  return (
    <div className="flex flex-col h-full" id="copilot-panel">
      {/* Panel header */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className="text-xl">🦮</span>
          <span className="text-lg font-bold text-text-primary">SafeStep</span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-200 hover:text-text-primary transition-colors text-lg"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>
```

- [ ] **Step 4: Update calendar section wrapper**

Find:
```tsx
      {/* Calendar connection */}
      <div className="p-4 border-b border-surface-200 bg-surface-50">
```

Replace with:
```tsx
      {/* Calendar connection */}
      <div className="panel-section bg-surface-50">
```

- [ ] **Step 5: Update action buttons section wrapper**

Find:
```tsx
      {/* Action Buttons */}
      <div className="p-4 space-y-3 border-b border-surface-200">
```

Replace with:
```tsx
      {/* Action Buttons */}
      <div className="panel-section space-y-2">
```

- [ ] **Step 6: Update button colors — safety button to amber, appointments to indigo**

Find:
```tsx
        <button
          id="btn-scam-check"
          className="action-btn action-btn-secondary"
          onClick={handleScamCheck}
          disabled={isLoading}
        >
```

Replace with:
```tsx
        <button
          id="btn-scam-check"
          className="action-btn action-btn-amber"
          onClick={handleScamCheck}
          disabled={isLoading}
        >
```

Find:
```tsx
        <button
          id="btn-appointments"
          className="action-btn action-btn-secondary"
          onClick={handleAppointments}
          disabled={isLoading}
        >
```

Replace with:
```tsx
        <button
          id="btn-appointments"
          className="action-btn action-btn-indigo"
          onClick={handleAppointments}
          disabled={isLoading}
        >
```

- [ ] **Step 7: Update secondary actions section wrapper**

Find:
```tsx
        {/* Secondary actions */}
        <div className="flex gap-2">
```

Replace with:
```tsx
        {/* Secondary actions */}
        <div className="flex gap-2 pt-1">
```

- [ ] **Step 8: Update free-text input section wrapper**

Find:
```tsx
      {/* Free-text input */}
      <div className="p-4 border-b border-surface-200">
```

Replace with:
```tsx
      {/* Free-text input */}
      <div className="panel-section">
```

- [ ] **Step 9: Update responses section wrapper**

Find:
```tsx
      {/* Responses */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" id="responses-area">
```

Replace with:
```tsx
      {/* Responses */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3" id="responses-area">
```

- [ ] **Step 10: Commit**

```bash
git add src/components/CopilotPanel.tsx
git commit -m "feat: adapt CopilotPanel for overlay — add onClose, new header, updated button styles"
```

---

### Task 4: Update BrowserTaskArea to fill viewport

**Files:**
- Modify: `src/components/BrowserTaskArea.tsx`

- [ ] **Step 1: Remove fixed height from the outer wrapper**

Find:
```tsx
  return (
    <div className="browser-area" id="browser-task-area">
```

This already uses `.browser-area` which we updated in globals.css to `width: 100%; height: 100%`. No JSX change needed here — the class already picks up the new rules.

However, the component now needs to fill the `app-shell` properly. Verify the parent `app-shell` passes height through. In `page.tsx` the `BrowserTaskArea` is a direct child of `div.app-shell` which is `100vh`. The `.browser-area` CSS is now `width: 100%; height: 100%`. This is correct.

- [ ] **Step 2: Verify no inline styles or hardcoded heights conflict**

Search the file for any `style={{` or `h-screen` or `height:` strings:

```bash
grep -n "style\|h-screen\|height:" src/components/BrowserTaskArea.tsx
```

Expected output: no matches (the component uses only class names).

- [ ] **Step 3: Commit**

```bash
git add src/components/BrowserTaskArea.tsx
git commit -m "style: verify BrowserTaskArea fills viewport via updated browser-area CSS"
```

---

### Task 5: Visual QA

**Files:** None (verification only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:3000` in a browser.

- [ ] **Step 2: Check full-screen browser area**

- The browser task area should fill the entire viewport with no right panel visible
- Background should be warm cream (`#FBF8F4`), not cool gray

- [ ] **Step 3: Check FAB**

- Lower-right corner: teal circle with 🦮 emoji
- Hover: slightly larger, darker teal
- No layout shift on the browser area

- [ ] **Step 4: Open the panel**

- Click the FAB
- Panel slides up from bottom-right
- FAB icon changes to ✕
- Panel is 420px wide, rounded corners, frosted background

- [ ] **Step 5: Check panel interior**

- Header: 🦮 SafeStep wordmark left, ✕ button right
- Calendar section visible
- Three action buttons: teal (next step), amber (safety), indigo (appointments)
- Secondary row: "What was I doing?" + 🔄
- Text input with placeholder
- Empty state greeting below

- [ ] **Step 6: Close the panel**

- Click ✕ in panel header OR click FAB again
- Panel slides down and disappears
- FAB returns to 🦮

- [ ] **Step 7: Test action buttons**

- Click "What do I do next?" → loading spinner → response card appears
- Click "Is this safe?" → amber-bordered response card with classification
- Click "Appointments" → indigo-accented response card

- [ ] **Step 8: Check on narrow viewport (<=480px)**

- Panel should be full-width minus 16px margin
- FAB should remain accessible

- [ ] **Step 9: Commit any QA fixes**

```bash
git add -p
git commit -m "fix: visual QA adjustments from overlay redesign"
```
