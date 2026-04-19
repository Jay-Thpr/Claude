# SafeStep UI/UX Redesign — Warm Companion + Overlay Style

Date: 2026-04-19

## Summary

Replace the two-pane layout with a full-screen browser area and a floating overlay copilot. The copilot is accessed via a persistent FAB (floating action button) in the lower-right corner. Clicking the FAB expands a slide-up panel. The visual language shifts to a warm companion aesthetic.

## Layout

- **Browser task area** fills 100% of the viewport (full width, full height)
- A **64px circular FAB** sits fixed in the lower-right corner (`bottom: 24px, right: 24px`), always on top via `z-index`
- Clicking the FAB toggles an **overlay panel** anchored to the bottom-right
- The overlay does NOT cover the full screen — it floats above content like a chat widget

## FAB

- Size: 64px diameter circle
- Color: Deep teal `#1A7A6E`, white icon
- Icon: 🦮 (guide dog) or a shield+person SVG
- Shadow: `0 4px 20px rgba(0,0,0,0.15)`
- State: when panel is open, FAB icon becomes an X (close)
- Optional: soft pulse animation when the assistant has something new to say

## Overlay Panel

- Width: 420px
- Max height: 600px (scrollable inside)
- Anchored: `bottom: 100px, right: 24px` (sits above the FAB)
- Background: white with `rgba(251,248,244,0.96)` tint
- Border radius: 24px
- Shadow: `0 8px 40px rgba(0,0,0,0.12)`
- Animation: slides up from below on open, slides down on close
- Has a small drag handle or header bar at the top

## Panel Interior (top to bottom)

### 1. Header bar
- SafeStep wordmark + 🦮 icon left-aligned
- X close button right-aligned
- Thin separator below

### 2. Appointment strip
- Compact single-line or two-line strip
- Shows: "Next: Cardiology — Tomorrow at 2 PM" or "Connect Google Calendar"
- Tap to expand (not implemented in MVP but reserved)
- Connect button if not connected

### 3. Action buttons (3 stacked, full width)
- **What do I do next?** — teal gradient, largest, primary CTA
- **Is this safe?** — warm amber `#D97706` background, white text
- **Appointments** — soft indigo `#4F46E5` background, white text
- All buttons: `border-radius: 14px`, `padding: 14px 20px`, `font-size: 1.125rem`, `font-weight: 700`

### 4. Secondary actions (inline row)
- "What was I doing?" and "🔄 Repeat" — smaller, outlined style

### 5. Free-text input
- Pill-shaped input, placeholder: "Ask me anything..."
- Send button appears inline when text is present

### 6. Response area (scrollable)
- Cards: `border-radius: 16px`, white bg, left-border accent for scam classification
  - Safe: green left border + `#E8F5E9` bg
  - Not sure: amber left border + `#FFF8E1` bg
  - Risky: red left border + `#FFEBEE` bg
- Body text: `1.125rem`, line-height `1.8`
- Fade-slide-in animation on each new card

## Colors

| Token | Value | Use |
|-------|-------|-----|
| Background | `#FBF8F4` | App background |
| FAB / primary | `#1A7A6E` | FAB, next-step button |
| Amber | `#D97706` | Safety button |
| Indigo | `#4F46E5` | Appointments button |
| Panel bg | `rgba(251,248,244,0.96)` | Overlay panel |
| Text primary | `#1A1A1A` | Body text |
| Text secondary | `#4A4A4A` | Labels, subtitles |
| Safe | `#2D8A4E` | Green accent |
| Warning | `#D4880F` | Amber accent |
| Danger | `#C62828` | Red accent |

## Typography

- Font: Inter (existing)
- Base HTML font-size: 18px (existing, keep)
- Button text: `1.125rem`, `font-weight: 700`
- Response body: `1.125rem`, `line-height: 1.8`
- Panel header: `1.25rem`, `font-weight: 800`

## Animations

- FAB → panel: `transform: translateY(20px) scale(0.95)` → `translateY(0) scale(1)`, 250ms ease-out
- Panel → FAB: reverse, 200ms ease-in
- Response cards: existing `fadeSlideIn` keyframe

## What Does NOT Change

- All API routes (`/api/next-step`, `/api/scam-check`, `/api/appointments`, `/api/memory`, `/api/gcal/*`)
- All state logic in `CopilotPanel.tsx` and `BrowserTaskArea.tsx`
- Supabase integration
- Google Calendar OAuth flow
- Browser Use SSE streaming
- The design token names in globals.css (extend, don't replace)

## Files to Modify

- `src/app/globals.css` — add overlay/FAB/panel classes, update background, add slide animation
- `src/app/page.tsx` — remove two-pane grid, render BrowserTaskArea full-screen, add FAB+panel
- `src/components/CopilotPanel.tsx` — strip outer layout wrapper, expose as panel content only
- `src/components/BrowserTaskArea.tsx` — remove fixed height constraints, fill viewport
