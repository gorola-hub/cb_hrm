# Design System & UI Specifications: Capital Bridge HRM

This document outlines the visual system, typography, color tokens, component guidelines, and page layout standards for **Capital Bridge HRM (CB HRM)**. The design system is intentionally aligned with **CB CRM** to provide a seamless, unified experience across the Capital Bridge platform.

---

## 1. Visual Foundation & Philosophy

- **Modern & Industrial:** Clean slate/zinc aesthetic matching high-velocity operations.
- **High Information Density with Visual Clarity:** Real-time data (clocks, break timers, roster counts) must be readable at a glance without clutter.
- **Optimistic State Feedback:** Live shift actions (Punch In, Take Break, Resume, Punch Out) update instantaneously with visual confirmation before network round-trips complete.
- **Theme-Aware:** Seamless dark and light modes powered by Tailwind CSS and `next-themes`.

---

## 2. Color Palette & Semantic Tokens

### 2.1 Base Theme Colors (Slate/Zinc Neutral System)

| Token Name | Light Mode Value | Dark Mode Value | Usage |
|---|---|---|---|
| `background` | `#FFFFFF` (`slate-50`) | `#090D16` / `#0B0F19` | Main page background |
| `card` | `#FFFFFF` | `#111827` (`slate-900`) | Metric cards, tables, modals |
| `border` | `#E2E8F0` (`slate-200`) | `#1F2937` (`slate-800`) | Component dividers and card borders |
| `text-primary` | `#0F172A` (`slate-900`) | `#F8FAFC` (`slate-50`) | Primary headings, titles, active text |
| `text-muted` | `#64748B` (`slate-500`) | `#94A3B8` (`slate-400`) | Subtitles, labels, secondary metadata |

---

### 2.2 Attendance Status Color Coding

Attendance statuses follow strict color coding across calendars, cards, and roster tables:

| Status Code | Status Name | Badge Colors (Light Mode) | Badge Colors (Dark Mode) | Visual Indicator |
|---|---|---|---|---|
| `IN_PROGRESS` | In Progress | `bg-blue-50 text-blue-700 border-blue-200` | `bg-blue-950/60 text-blue-400 border-blue-800` | Pulsing blue dot |
| `P` | Present (Full Day) | `bg-emerald-50 text-emerald-700 border-emerald-200` | `bg-emerald-950/60 text-emerald-400 border-emerald-800` | Solid emerald check |
| `HD` | Half Day | `bg-amber-50 text-amber-700 border-amber-200` | `bg-amber-950/60 text-amber-400 border-amber-800` | Amber half-circle |
| `A` | Absent | `bg-rose-50 text-rose-700 border-rose-200` | `bg-rose-950/60 text-rose-400 border-rose-800` | Rose alert dot |
| `LV` | Approved Leave | `bg-indigo-50 text-indigo-700 border-indigo-200` | `bg-indigo-950/60 text-indigo-400 border-indigo-800` | Indigo calendar icon |
| `WO` | Week Off | `bg-slate-100 text-slate-600 border-slate-200` | `bg-slate-800 text-slate-400 border-slate-700` | Muted neutral pill |
| `L` (Tag) | Late Arrival | `bg-orange-100 text-orange-800 border-orange-300` | `bg-orange-950/80 text-orange-400 border-orange-800` | Orange clock badge |

---

## 3. Typography & Numerical Formatting

- **Font Family:** `Inter`, system-ui, -apple-system, sans-serif.
- **Monospace Clocks:** All digital timers, clock displays, and durations must use `font-mono` with `tabular-nums` (`font-variant-numeric: tabular-nums`) to prevent text jitter as seconds count up.
- **Hierarchy:**
  - `text-3xl font-bold tracking-tight`: Main page titles and primary clock numerals.
  - `text-xl font-semibold`: Modal titles and section headers.
  - `text-sm font-medium`: Form labels, table column headers, and navigation links.
  - `text-xs text-muted-foreground`: Secondary timestamps and audit metadata.

---

## 4. Key Interactive Components

### 4.1 The Live Indian Standard Time (IST) Digital Clock
- Displayed prominently in the Employee Dashboard and Admin Live Roster.
- Renders:
  - 12-hour or 24-hour current IST time with blinking colon: `19:24:08 IST`
  - Current IST Date: `Tuesday, 24 November 2026`
  - Current Live Work Status: e.g., `OFFLINE`, `WORKING (04:12:30)`, or `ON BREAK (00:15:10)`
- Synchronized with server time on mount to eliminate local device clock discrepancies.

### 4.2 The Shift Action Hub (Dynamic Punch Card)
A central responsive card that morphs based on shift state:

```
+-------------------------------------------------------------------------------+
| LIVE ATTENDANCE HUB                                           [ SHIFT: 19:00 ]|
| Current Time: 19:10:45 IST                      Work Date: 2026-11-24         |
+-------------------------------------------------------------------------------+
| Status: WORKING                       Elapsed Work Time: 03h 42m 15s          |
| First Punch: 18:45 IST                Breaks Taken: 2 (35m total)             |
+-------------------------------------------------------------------------------+
|       [ TAKE BREAK ]                 |              [ PUNCH OUT ]             |
|   (Pauses work timer)                |       (Calculates hours & ends shift)  |
+-------------------------------------------------------------------------------+
```

- **When IDLE:** Displays a prominent primary button: `[ PUNCH IN ]`.
- **When WORKING:** Transforms into two buttons:
  - `[ TAKE BREAK ]` (Secondary / Outline, Coffee icon)
  - `[ PUNCH OUT ]` (Destructive / Red outline, Log-out icon)
- **When ON BREAK:** Transforms into:
  - `[ BACK FROM BREAK ]` (Primary Emerald, Play icon)
  - `[ PUNCH OUT ]` (Auto-closes open break and ends shift)

### 4.3 One-Click "[Open CRM]" Navigation Bridge
- Positioned in the global header top navigation bar.
- Button styling:
  - Subtle primary accent border (`border-primary/30 hover:border-primary`).
  - Lucide icon `ExternalLink` on the right.
  - Tooltip: *"Launch Capital Bridge CRM without re-entering password"*.
- Triggering this opens CRM in a new tab via `/api/auth/sso?token=...`.

### 4.4 Break Timeline Disclosure
In attendance rosters and day detail modals, breaks are presented as an expandable pill:
- Default view: `[ 45m (2 breaks) ▾ ]`
- Expanded inline drawer reveals:
  - Break 1: `21:15 IST – 21:35 IST (20 mins)`
  - Break 2: `00:10 IST – 00:35 IST (25 mins)`

### 4.5 Monthly Attendance Calendar Grid
- Standard 7-column grid (Monday through Sunday).
- Each date cell displays:
  - Day number (e.g., `24`)
  - Status Badge (`P`, `HD`, `A`, `LV`, `WO`)
  - Worked Hours: e.g., `8h 15m`
  - Late indicator dot if `isLate = true`
- Clicking any cell opens the **Day Detail Card** displaying full punch in/out timestamps, individual breaks, and regularization notes if edited.

---

## 5. Layout Architecture

### 5.1 Employee Layout (`/dashboard`, `/my-attendance`, `/my-leaves`)
- Clean topbar with company logo, Live IST time badge, `[Open CRM]` button, Theme Toggle, and User Profile menu.
- Focused single-column or 2-column layout emphasizing attendance status and rapid punch interactions.

### 5.2 Admin Layout (`/admin/attendance`, `/admin/leaves`, `/admin/shifts`)
- Global collapsible sidebar navigation:
  - **Live Command Center** (`/admin/attendance`)
  - **Leave Queue** (`/admin/leaves`) with pending counter badge
  - **Shift Master** (`/admin/shifts`)
  - **Reports & Export** (`/admin/reports`)
- Top metric cards row:
  - `[ On Shift Now: 14 ]`
  - `[ On Break: 3 ]`
  - `[ Late Today: 2 ]`
  - `[ On Leave: 1 ]`
  - `[ Offline: 5 ]`
- Full-width Excel-style data table below with sticky header, column sorting, and search filter.

