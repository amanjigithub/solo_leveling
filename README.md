# 🗡️ Shadow System — Solo Leveling Habit Tracker

<div align="center">

  <h3>Awaken your potential. Turn your real life into an RPG.</h3>
  <p>A gamified daily habit tracker inspired by the anime/manhwa <em>Solo Leveling</em>.<br/>Complete quests, rank up, defeat dungeon bosses, and build your Shadow Army.</p>

  [![Live Demo](https://img.shields.io/badge/Live%20Demo-sololevelinghabittracker.netlify.app-00a8ff?style=for-the-badge&logo=netlify)](https://sololevelinghabittracker.netlify.app/)
  [![React](https://img.shields.io/badge/React-18.3-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
  [![Firebase](https://img.shields.io/badge/Firebase-12.x-ffca28?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
  [![Vite](https://img.shields.io/badge/Vite-5.4-646cff?style=for-the-badge&logo=vite)](https://vitejs.dev/)
  [![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=for-the-badge&logo=pwa)](https://sololevelinghabittracker.netlify.app/)

</div>

---

## 🌟 Features

### ⚔️ Core Gameplay
- **Daily Quest System** — Complete real-life habits (Exercise, Study, Sleep) to earn XP and level up
- **5 RPG Stats** — STR · INT · VIT · AGI · SEN — each tied to a quest category
- **Rank Progression** — Advance from E-Rank → D → C → B → A → S → National Level
- **Quest Streaks** — Maintain daily streaks; quests reset at midnight automatically
- **Undo Completion** — Un-complete a quest and XP rolls back perfectly

### 🏰 Dungeon Focus Mode
- **Boss Battles** — Open a dungeon gate and face a boss matched to your rank
- **25-Min Focus Blocks** — Pomodoro-style timer deals damage to the boss per block
- **Timer Persistence** — Active timer survives page refreshes (saved to localStorage + Firestore)
- **Focus Lock** — Fullscreen mode + Screen Wake Lock keeps you on task
- **Cheat Detection** — Tab switching triggers an in-game warning + system log entry
- **Haptic Feedback** — Vibration patterns on block complete & boss defeat (Android)

### 👥 Shadow Army
- **Shadow Extraction** — Complete any quest for 7 consecutive days to extract a Shadow soldier
- **Shadow Leveling** — Shadows level up as your streak grows
- **Army Display** — View your full shadow roster with level and origin quest

### 🤖 AI System (Claude)
- **Motivational Chat** — Ask the AI for advice; responds as the Solo Leveling System
- **Personalized Quest Generation** — Describe your background ("I'm a B.Tech student") and AI creates tailored quests
- **4 Quick Presets** — HOW DO I RANK UP · MOTIVATE ME · WHAT QUESTS · ANALYZE MY STATS
- **Solo Leveling Theme** — All responses use `[SYSTEM]` / `[ALERT]` tags with lore-accurate tone

### 🔐 Authentication
- **Username + Password Login** — Custom auth with streak and progress tracking
- **Hunter's Oath** — Registration requires agreeing to the oath
- **Password Strength Meter** — Real-time strength indicator with requirement checklist
- **Session Persistence** — Stay logged in across browser sessions

### 📱 PWA — Installable App
- **Install on Phone** — Add to Home Screen on iOS (Safari) or Android (Chrome)
- **Offline Support** — Service Worker caches the app; works without internet
- **Full-Screen Mode** — No browser bar when launched from home screen
- **Daily Notifications** — Push notification at midnight when quests reset
- **Dark Status Bar** — Seamlessly themed on iOS

### 📊 System Log
- **Full Activity Trail** — Every action (quest complete, rank up, dungeon entry) is timestamped
- **Colour-Coded Entries** — Info · Complete · AI · System · Shadow event types
- **Persistent** — Log saved to Firestore across sessions

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 18.3 | UI library — components, hooks, state |
| **Vite** | 5.4 | Build tool & dev server |
| **Framer Motion** | 12.x | Animations — boss entry, panel transitions, timer pulse |
| **Vanilla CSS** | — | All styling — no Tailwind/Bootstrap |

### State Management
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Zustand** | 5.0 | Dungeon timer & focus session state |
| **TanStack Query** | 5.x | Server state caching |

### Backend & Database
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Firebase Auth** | 12.x | User authentication |
| **Cloud Firestore** | 12.x | Real-time NoSQL database — player data, quests, dungeon state |

### AI
| Technology | Purpose |
|-----------|---------|
| **OpenRouter API** | Routes requests to Claude AI model |
| **Claude** | Quest generation & motivational chat responses |

### PWA
| Technology | Purpose |
|-----------|---------|
| **vite-plugin-pwa** | Generates Service Worker + Web Manifest |
| **Workbox** | Offline caching & precache strategy |
| **Web APIs** | Wake Lock · Vibration · Notifications · Fullscreen |

### Auth & Security
| Technology | Purpose |
|-----------|---------|
| **@react-oauth/google** | Google OAuth integration |
| **jwt-decode** | JWT token decoding |

### Deployment
| Technology | Purpose |
|-----------|---------|
| **Netlify** | Hosting + auto-deploy from GitHub `main` |
| **GitHub** | Version control |

---

## 🚀 Live Demo

> **[https://sololevelinghabittracker.netlify.app/](https://sololevelinghabittracker.netlify.app/)**

**Test account:** `QAv4Test` / `Hunter@99x`

---

## 💻 Running Locally

### 1. Clone the repository
```bash
git clone https://github.com/amanjigithub/solo_leveling.git
cd solo_leveling
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env` file in the root with your Firebase + OpenRouter keys:
```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_OPENROUTER_API_KEY=your_openrouter_key
```

### 4. Firebase setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project — enable **Authentication** (Email/Password) and **Firestore Database**
3. Add `localhost` to Authorized Domains in Firebase Auth settings

### 5. Start the dev server
```bash
npm run dev
```
App runs at `http://localhost:5173`

---

## 📦 Build & Deploy

```bash
npm run build      # Production build → dist/
```

Netlify auto-deploys on every push to `main` via GitHub integration.

---

## 🏗️ Project Architecture

```
src/
├── components/
│   ├── AuthPage.jsx          # Login / Register UI
│   ├── GameApp.jsx           # Main app controller (Firestore sync, state)
│   └── DungeonFocusOverlay.jsx  # Focus timer + boss battle UI
├── store/
│   ├── useDungeonStore.js    # Zustand — dungeon timer & focus state
│   ├── usePlayerStore.js     # Zustand — player data
│   └── useQuestStore.js      # Zustand — quest list
├── styles/
│   └── main.css              # All CSS — responsive at 900 / 600 / 400px
├── constants.js              # Ranks, dungeons, default state
├── firebase.js               # Firebase init & exports
├── utils.js                  # AI call helper, themed error messages
└── main.jsx                  # App entry point
```

**Key design decisions:**
- **Zustand for timer state** — dungeon ticks every second; isolating it in a store prevents entire-app re-renders
- **Firestore `onSnapshot()`** — real-time listener syncs data across devices instantly without polling
- **Debounced saves** — Firestore writes debounced 500ms to avoid write spam while typing
- **localStorage cache** — state shown instantly on load before Firestore responds (zero loading flash)
- **Lazy loading** — `GameApp` and `AuthPage` loaded as separate chunks via `React.lazy()`

---

## 📱 Install as App (PWA)

**iPhone / iOS:**
1. Open Safari → go to the live URL
2. Tap **Share** → **Add to Home Screen**
3. Tap **Add** — the app icon appears on your home screen

**Android:**
1. Open Chrome → go to the live URL
2. Tap **⋮ Menu** → **Install app**
3. Tap **Install**

Once installed: full-screen, offline-capable, push notifications enabled.

---

## 🎨 Design System

| Element | Value |
|---------|-------|
| Background | `#020408` (near-black) |
| Primary accent | `#00a8ff` (cyan blue) |
| Danger | `#ff2244` (red) |
| Gold | `#ffd700` |
| Font — Display | Orbitron (monospace, futuristic) |
| Font — Body | Rajdhani (clean, readable) |
| Shape language | `clip-path` polygon cuts (cyberpunk aesthetic) |

---

*ARISE.*
