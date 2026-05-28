# Feature Technical Document (FTD)
## Shadow System: Solo Leveling Habit Tracker

**Version:** 1.0  
**Project Name:** Shadow System — Solo Leveling Habit Tracker  
**Prepared By:** Engineering Team  
**Date:** May 2026  
**Live URL:** [sololevelinghabittracker.netlify.app](https://sololevelinghabittracker.netlify.app/)  
**Repository:** [github.com/amanjigithub/solo_leveling](https://github.com/amanjigithub/solo_leveling)

---

## Table of Contents

1. [Document Purpose](#1-document-purpose)
2. [Feature 1 — Dungeon Focus Lock](#2-feature-1--dungeon-focus-lock)
   - 2.1 Overview
   - 2.2 Problem Statement
   - 2.3 Web APIs Used
   - 2.4 Architecture & Data Flow
   - 2.5 State Design
   - 2.6 Implementation Details
   - 2.7 Cheat Detection Logic
   - 2.8 Platform Limitations
   - 2.9 Error Handling
   - 2.10 Testing Checklist
3. [Feature 2 — PWA (Progressive Web App)](#3-feature-2--pwa-progressive-web-app)
   - 3.1 Overview
   - 3.2 Problem Statement
   - 3.3 Architecture & Components
   - 3.4 Implementation Details
   - 3.5 Manifest Configuration
   - 3.6 Service Worker & Caching Strategy
   - 3.7 Install Flow by Platform
   - 3.8 Testing Checklist
4. [Shared Non-Functional Requirements](#4-shared-non-functional-requirements)
5. [Updated Dependency Table](#5-updated-dependency-table)
6. [Updated Project Structure](#6-updated-project-structure)

---

## 1. Document Purpose

This Feature Technical Document (FTD) covers the detailed technical design and implementation specification for two new features added to the Shadow System in **May 2026**:

| # | Feature | Status |
|---|---|---|
| 1 | **Dungeon Focus Lock** | ✅ Implemented |
| 2 | **PWA — Install as Phone App** | ✅ Implemented |

This document supplements the existing [TRD.md](./TRD.md) and [PRD.md](./PRD.md). It should be read alongside those documents for full system context.

---

## 2. Feature 1 — Dungeon Focus Lock

### 2.1 Overview

When a hunter opens a Dungeon Gate, the application enters a **fullscreen focus mode** that:
- Takes over the entire display (hides browser chrome)
- Keeps the phone screen on for the full 25-minute block
- Shows a locked cinematic dungeon UI with only two allowed actions
- Detects and penalizes the hunter for switching to another app
- Allows phone calls (OS always renders calls above the browser)

**Trigger:** `enterDungeon()` function call in `GameApp.jsx`  
**Exit:** `retreatDungeon()` or `completeFocusBlock()` when boss is defeated

---

### 2.2 Problem Statement

Before this feature, a hunter could open the dungeon gate and immediately switch to social media, games, or other distractions. The 25-minute focus block had no enforcement mechanism. The dungeon was purely cosmetic with no real focus accountability.

**Goal:** Make the dungeon feel like a real gate — once you step in, you are committed.

---

### 2.3 Web APIs Used

| API | Method | Purpose | Browser Support |
|---|---|---|---|
| **Fullscreen API** | `document.documentElement.requestFullscreen()` | Hides browser UI chrome (address bar, nav buttons) | Chrome, Firefox, Safari, Edge |
| **Screen Wake Lock API** | `navigator.wakeLock.request('screen')` | Prevents the phone screen from sleeping during a focus block | Chrome 84+, Edge 84+, Safari 16.4+ |
| **Page Visibility API** | `document.addEventListener('visibilitychange', ...)` | Detects when the hunter switches to another tab or app | All modern browsers |
| **Vibration API** | `navigator.vibrate(pattern)` | Haptic feedback on mobile for gate entry, block complete, and retreat | Android Chrome; not supported on iOS Safari |
| **Fullscreen Exit** | `document.exitFullscreen()` | Exits fullscreen mode when dungeon ends | All modern browsers |

---

### 2.4 Architecture & Data Flow

```
Hunter taps "OPEN GATE"
        │
        ▼
enterDungeon()
        ├── update() → sets dungeon.active = true in Firestore
        ├── startFocusBlock() → starts 25-min setInterval countdown
        └── enterFocusLock()
                ├── document.documentElement.requestFullscreen()
                ├── navigator.wakeLock.request('screen')
                ├── navigator.vibrate([100, 50, 100])
                └── setFocusLocked(true)
                        │
                        ▼
            Focus Lock Overlay renders
            (position: fixed, inset: 0, z-index: 9999)
                        │
             ┌──────────┴──────────┐
             │                     │
    Timer reaches 0         Hunter taps "CLOSE GATE"
             │                     │
    completeFocusBlock()     retreatDungeon()
             │                     │
             └──────────┬──────────┘
                        ▼
                  exitFocusLock()
                        ├── wakeLock.release()
                        ├── document.exitFullscreen()
                        ├── navigator.vibrate([200])
                        └── setFocusLocked(false)
```

---

### 2.5 State Design

Three new React state variables added to `GameApp.jsx`:

```js
const [focusLocked, setFocusLocked] = useState(false);
// Controls whether the Focus Lock Overlay renders

const [focusWarning, setFocusWarning] = useState(null);
// null | "warning" | "penalty"
// Controls the warning banner that appears when hunter switches app

const [focusBreaks, setFocusBreaks] = useState(0);
// Counts how many times the hunter has left the app during focus lock

const wakeLockRef = useRef(null);
// Holds the WakeLockSentinel object so it can be released on exit
```

---

### 2.6 Implementation Details

#### `enterFocusLock()` — `useCallback`

```js
const enterFocusLock = useCallback(async () => {
    // Step 1: Request fullscreen
    try {
        await document.documentElement.requestFullscreen();
    } catch (e) {
        console.warn("[FocusLock] Fullscreen not available:", e.message);
        // Gracefully degrades — overlay still shows, just without fullscreen
    }

    // Step 2: Acquire Screen Wake Lock
    try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch (e) {
        console.warn("[FocusLock] Wake Lock not available:", e.message);
        // Gracefully degrades — timer still runs, screen may sleep
    }

    // Step 3: Haptic entry pulse
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    setFocusLocked(true);
    setFocusBreaks(0);
    setFocusWarning(null);
}, []);
```

#### `exitFocusLock()` — `useCallback`

```js
const exitFocusLock = useCallback(() => {
    if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
    }
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
    if (navigator.vibrate) navigator.vibrate([200]);
    setFocusLocked(false);
    setFocusWarning(null);
}, []);
```

#### Focus Lock Overlay — JSX

Rendered when `focusLocked && state?.dungeon?.active` is `true`.

```
┌─────────────────────────────────────────┐
│  🔒 DUNGEON LOCKED — FOCUS MODE ACTIVE  │  ← Lock indicator (8px Orbitron)
│                                         │
│               👺                        │  ← Boss emoji (96px, floating animation)
│         GOBLIN SHAMAN                   │  ← Boss name (18px red glow)
│                                         │
│  BOSS HP    ████████░░░░  80%           │  ← HP bar (14px height, red fill)
│  Blocks: 1 / 3                          │
│                                         │
│         25:00                           │  ← Timer (80px bold, blue → red <60s)
│      FOCUS BLOCK ACTIVE                 │
│                                         │
│  [⚡ COMPLETE BLOCK]  [🚪 CLOSE GATE]   │  ← Only 2 allowed actions
│                                         │
│  INCOMING CALLS WILL APPEAR ABOVE...   │  ← Bottom notice (8px, dim)
└─────────────────────────────────────────┘
```

**Timer color logic:**
```js
color: dungeonTimer < 60 ? "#ff2244" : "#00a8ff"
animation: dungeonTimer < 60 ? "pulse 0.5s ease-in-out infinite" : "none"
```

---

### 2.7 Cheat Detection Logic

Uses the **Page Visibility API** via a `useEffect` that only activates when `focusLocked === true`:

```
Hunter switches app / minimizes browser
        │
        ▼
document.hidden === true → visibilitychange fires
        │
        ▼
focusBreaks counter increments
        │
    ┌───┴───┐
   = 1     ≥ 2
    │       │
    ▼       ▼
 Orange   Red penalty
 warning  banner +
 banner   System Log entry:
          "⚠ FOCUS BROKEN — The System
           has noted your weakness."
```

**Warning banner styles:**

| Type | Border Color | Background | Text |
|---|---|---|---|
| `"warning"` | `#ff9800` | `rgba(255,165,0,0.15)` | `⚠ FOCUS WARNING — RETURN TO THE DUNGEON, HUNTER` |
| `"penalty"` | `#ff2244` | `rgba(255,34,68,0.2)` | `⚠ FOCUS BROKEN (Nx) — THE SYSTEM HAS NOTED YOUR WEAKNESS` |

Banners auto-dismiss after 3500ms (warning) or 4000ms (penalty) via `setTimeout`.

#### Wake Lock Re-acquisition

When the OS temporarily releases the wake lock (e.g., a phone call happens), the lock is automatically re-acquired:

```js
useEffect(() => {
    if (!focusLocked) return;
    const handleWakeLockRelease = async () => {
        // Re-acquire after visibility returns
        if (!document.hidden) {
            wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
    };
    document.addEventListener("visibilitychange", handleWakeLockRelease);
    return () => document.removeEventListener("visibilitychange", handleWakeLockRelease);
}, [focusLocked]);
```

---

### 2.8 Platform Limitations

| Capability | Web App | Native App | Notes |
|---|---|---|---|
| Fullscreen (hide browser chrome) | ✅ | ✅ | Works on all modern mobile browsers |
| Keep screen on (no sleep) | ✅ | ✅ | Wake Lock API; not on iOS Safari < 16.4 |
| Block all other app access | ❌ | ✅ | Requires Android Device Admin / Kiosk mode |
| Block the phone Home button | ❌ | ✅ | OS restriction; not accessible from the web |
| Incoming phone calls visible | ✅ | ✅ | OS always renders call UI above any app |
| Haptic feedback | ✅ Android | ✅ | `navigator.vibrate()` not supported on iOS Safari |
| Cheat detection (tab switch) | ✅ | ✅ | Page Visibility API works on all platforms |

---

### 2.9 Error Handling

All Web API calls are wrapped in `try/catch` with graceful degradation:

| Failure Scenario | Behaviour |
|---|---|
| Fullscreen request rejected (e.g., user gesture required) | Warning logged; overlay still renders in normal mode |
| Wake Lock not supported (old Safari) | Warning logged; timer still runs, screen may sleep |
| Wake Lock released by OS mid-session | Auto-reacquired on `visibilitychange` when screen returns |
| `exitFullscreen()` when not in fullscreen | Error silently caught via `.catch(() => {})` |

---

### 2.10 Testing Checklist

- [ ] Open Dungeon Gate → app goes fullscreen on mobile
- [ ] Screen does not sleep during 25-minute block
- [ ] Only "Complete Block" and "Close Gate" buttons are visible
- [ ] Switch to another app → orange warning appears on return
- [ ] Switch a second time → red penalty appears + System Log entry added
- [ ] Receive a phone call → call screen appears above app; can pick up/reject
- [ ] Complete focus block → fullscreen exits, normal app returns
- [ ] Retreat dungeon → fullscreen exits, normal app returns
- [ ] Boss defeated → victory haptic fires on mobile
- [ ] Repeat wake lock test on Safari iOS 16.4+

---

## 3. Feature 2 — PWA (Progressive Web App)

### 3.1 Overview

Converts the Shadow System web app into an **installable Progressive Web App**. Once installed:
- Launches from the home screen like a native app
- Runs in standalone fullscreen mode (no browser chrome)
- Works offline using a cached Service Worker
- Has a custom branded icon and splash screen
- Lays the foundation for future **push notifications**

---

### 3.2 Problem Statement

Previously, the Shadow System could only be accessed through a browser — the hunter had to navigate to a URL each time. On mobile, the browser address bar took up space, and the app was not in the phone's app launcher. There was no offline capability; a bad network connection would show a blank page.

**Goal:** Make the app feel native — one tap from the home screen, fullscreen, works even without internet.

---

### 3.3 Architecture & Components

```
┌─────────────────────────────────────────────────────────┐
│                      PWA LAYER                           │
│                                                          │
│  ┌──────────────┐   ┌────────────────┐                  │
│  │  Web App     │   │  Service Worker │                  │
│  │  Manifest    │   │  (Workbox)      │                  │
│  │  (manifest   │   │                 │                  │
│  │  .webmanifest│   │  • Cache assets │                  │
│  │  )           │   │  • Offline page │                  │
│  └──────────────┘   │  • BG sync      │                  │
│                      └────────────────┘                  │
│                                                          │
│  ┌──────────────┐   ┌────────────────┐                  │
│  │  App Icons   │   │  Install Prompt │                  │
│  │  192×192     │   │  (browser UI)   │                  │
│  │  512×512     │   └────────────────┘                  │
│  └──────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```

**Plugin:** `vite-plugin-pwa` (wraps Google's Workbox library)  
**Auto-generates:** Service Worker file, `manifest.webmanifest`

---

### 3.4 Implementation Details

#### `vite.config.js` — VitePWA Plugin Configuration

```js
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  // Automatically installs new service worker when available
  // (no "New version available" prompt needed for this app)

  manifest: {
    name: 'Shadow System | Hunter Interface',
    short_name: 'Shadow System',
    description: 'Solo Leveling habit tracker — complete daily quests, level up, build your shadow army.',
    theme_color: '#00a8ff',      // Browser chrome tint color (Android)
    background_color: '#020408', // Splash screen background
    display: 'standalone',       // No browser chrome when launched from home screen
    orientation: 'portrait',
    scope: '/',
    start_url: '/',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  },

  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    // Cache all static assets

    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
      }
    ]
  }
})
```

---

### 3.5 Manifest Configuration

| Field | Value | Description |
|---|---|---|
| `name` | `Shadow System \| Hunter Interface` | Full app name (shown in install prompt) |
| `short_name` | `Shadow System` | Name shown under home screen icon |
| `theme_color` | `#00a8ff` | Android browser toolbar color when app is open |
| `background_color` | `#020408` | Splash screen background (matches app's dark theme) |
| `display` | `standalone` | Launches without browser chrome |
| `orientation` | `portrait` | App is optimized for portrait mode |
| `start_url` | `/` | URL opened when launched from home screen |
| `scope` | `/` | All paths within the app are within scope |
| `icons[0]` | `icon-192.png` | Required for Android install prompts |
| `icons[1]` | `icon-512.png` | Used for splash screens and high-res displays |

---

### 3.6 Service Worker & Caching Strategy

The Service Worker is auto-generated by Workbox and registered via `vite-plugin-pwa`.

| Asset Type | Strategy | Reason |
|---|---|---|
| JS, CSS, HTML, fonts | **CacheFirst** | Static assets; version changes on new build |
| Google Fonts CSS | **CacheFirst** (1 year TTL) | Rarely changes; speeds up load significantly |
| Google Fonts files | **CacheFirst** (1 year TTL) | Binary font files are immutable by URL |
| Firestore API calls | **NetworkFirst** (handled by Firebase SDK) | Data must be fresh; falls back to Firestore offline cache |
| OpenRouter AI API | **NetworkOnly** | AI responses must always come from the network |

**Offline Behaviour:**
- If the hunter opens the app with no internet, the cached shell (HTML, JS, CSS) loads instantly
- Player data is served from `localStorage` (already implemented via the dual-cache system)
- Firestore SDK has its own built-in offline persistence layer (enabled by default)
- AI features (quest generation, system chat) are disabled with an appropriate error message

---

### 3.7 Install Flow by Platform

#### Android (Chrome)
1. Open app in Chrome
2. Chrome auto-shows **"Add Shadow System to Home Screen"** banner after the hunter meets engagement criteria (2 visits)
3. Or: tap **⋮ menu → Add to Home Screen**
4. Icon appears on home screen
5. Tapping launches in **standalone mode** — no address bar, no browser buttons

#### iOS (Safari)
1. Open app in Safari
2. Tap the **Share button** (box with upward arrow)
3. Scroll and tap **"Add to Home Screen"**
4. Edit name if desired → tap **Add**
5. Icon appears on home screen
6. Tapping launches in **standalone mode** — no Safari chrome

> ⚠️ **iOS Note:** iOS Safari does not support the Web App Manifest install prompt programmatically. The hunter must manually follow the share sheet flow. Push notifications via Service Worker are not supported on iOS < 16.4.

#### Desktop (Chrome / Edge)
1. Visit the app in Chrome or Edge
2. An **install icon** (⊕) appears in the address bar
3. Click it → "Install Shadow System" dialog appears
4. App installs as a standalone desktop window with its own taskbar entry

---

### 3.8 Testing Checklist

- [ ] App has `manifest.webmanifest` in the build output (`dist/`)
- [ ] App has `sw.js` (Service Worker) in the build output
- [ ] Chrome DevTools → Application → Manifest shows all fields correctly
- [ ] Chrome DevTools → Application → Service Workers shows SW as "Activated and running"
- [ ] Android Chrome shows install banner on second visit
- [ ] App launches in standalone mode (no browser chrome) when installed
- [ ] Splash screen shows correct dark background on Android
- [ ] App loads with no internet (offline test in Chrome DevTools → Network → Offline)
- [ ] Player data loads from localStorage when offline
- [ ] AI features show a graceful error when offline
- [ ] iOS Safari: app installable via Share → Add to Home Screen
- [ ] Desktop Chrome: install button appears in address bar

---

## 4. Shared Non-Functional Requirements

| Requirement | Dungeon Focus Lock | PWA |
|---|---|---|
| **Performance** | Overlay renders at 60fps; no jank on entry/exit | Service Worker pre-caches assets at install; subsequent loads are instant |
| **Graceful Degradation** | All Web APIs wrapped in try/catch; feature still partially works on unsupported browsers | App works as normal website if PWA install is declined or unsupported |
| **Security** | No new API keys or auth surfaces introduced | Service Worker only caches public static assets; never caches Firestore auth tokens |
| **Accessibility** | Overlay has sufficient color contrast; buttons have clear labels | PWA manifest provides accessible `description` and `short_name` |
| **Mobile-first** | Designed primarily for portrait mobile use; tested on Android Chrome | Install flow primarily targets mobile; desktop install is a bonus |

---

## 5. Updated Dependency Table

### New Dev Dependencies (added May 2026)

| Package | Version | Purpose |
|---|---|---|
| `vite-plugin-pwa` | latest | Generates Service Worker and Web App Manifest via Workbox |

### Full Dev Dependencies (after update)

| Package | Version | Purpose |
|---|---|---|
| `vite` | ^5.4.2 | Build tool & dev server |
| `@vitejs/plugin-react` | ^4.3.1 | React JSX transform for Vite |
| `vite-plugin-pwa` | latest | PWA: Service Worker + manifest generation |
| `javascript-obfuscator` | ^5.4.1 | JS code obfuscation engine |
| `vite-plugin-javascript-obfuscator` | ^3.1.0 | Integrates obfuscator into Vite build |
| `gh-pages` | ^6.3.0 | GitHub Pages deployment helper |

---

## 6. Updated Project Structure

```
sololeveling/
├── index.html                  # Vite entry HTML
├── vite.config.js              # Vite + PWA + obfuscator configuration  ← UPDATED
├── netlify.toml                # Netlify SPA redirect rules
├── package.json                # Dependencies & scripts  ← UPDATED (vite-plugin-pwa added)
├── public/
│   ├── icon-192.png            # PWA app icon (192×192)  ← NEW
│   └── icon-512.png            # PWA app icon (512×512)  ← NEW
├── document/
│   ├── PRD.md                  # Product Requirements Document
│   ├── TRD.md                  # Technical Requirements Document
│   ├── features.md             # Feature overview & user-facing docs
│   └── feature_technical.md   # This document  ← NEW
└── src/
    ├── main.jsx                # ReactDOM entry point
    ├── App.jsx                 # Root component — auth state gating
    ├── firebase.js             # Firebase init
    ├── constants.js            # Game constants
    ├── utils.js                # AI call, password utils
    ├── components/
    │   ├── AuthPage.jsx        # Login / registration UI
    │   └── GameApp.jsx         # Core game engine  ← UPDATED
    │                           #   + enterFocusLock(), exitFocusLock()
    │                           #   + Focus Lock Overlay JSX
    │                           #   + Cheat detection useEffect
    │                           #   + Wake Lock re-acquisition useEffect
    └── styles/
        └── main.css
```
