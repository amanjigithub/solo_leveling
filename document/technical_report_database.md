# 🗡️ Solo Leveling — Technical Report: Database & Backend Integration

> **Document Type:** Technical Report  
> **Project:** Solo Leveling Habit Tracker  
> **Current Stack:** React 18 + Vite + Zustand + Firebase Auth + Firestore  
> **Proposed Stack:** PostgreSQL + FastAPI (or Node.js/Express) + JWT Auth  
> **Prepared:** 2026-08-12

---

## 1. Current System Architecture

### 1.1 How the app works today

```
Browser (React + Vite)
│
├── Firebase Auth      ← User login (Google + fake-email hack)
├── Firestore          ← Dungeon timer state (dungeonStartedAt)
├── localStorage       ← Quests, XP, Level, Stats, Streaks
└── OpenRouter API     ← AI-generated quest names (key exposed in browser)
```

### 1.2 Key Files in the Current Codebase

| File | Purpose |
|---|---|
| [`firebase.js`](file:///Users/amansingh/sololeveling/src/firebase.js) | Firebase init — Auth + Firestore + `onSnapshot` |
| [`AuthPage.jsx`](file:///Users/amansingh/sololeveling/src/components/AuthPage.jsx) | Login/Signup UI — uses fake email hack (`username@hunter.shadow`) |
| [`useQuestStore.js`](file:///Users/amansingh/sololeveling/src/store/useQuestStore.js) | Zustand store — quest CRUD operations |
| [`useDungeonStore.js`](file:///Users/amansingh/sololeveling/src/store/useDungeonStore.js) | Zustand store — dungeon timer + boss state |
| [`docker-compose.yml`](file:///Users/amansingh/sololeveling/docker-compose.yml) | Docker setup — prod (Nginx) + dev (Vite HMR) |
| [`vite.config.js`](file:///Users/amansingh/sololeveling/vite.config.js) | Vite — PWA, chunk splitting, dev proxy for OpenRouter |
| [`functions/`](file:///Users/amansingh/sololeveling/functions/package.json) | Firebase Cloud Functions — Node 20, firebase-admin v12 |

### 1.3 Critical Problems Found in the Code

#### Problem 1 — The Fake Email Hack (AuthPage.jsx, Line 25)
```javascript
// CURRENT CODE — this is a hack
const getFakeEmail = (name) => `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@hunter.shadow`;
```
Firebase Auth requires an email format, but the app doesn't use real emails. It constructs a fake one from the username. This means:
- ❌ No real email = no password reset possible
- ❌ Two users with names `"Aman Singh"` and `"AmanSingh"` map to the same email → account collision
- ❌ Can't send notifications or verify real users

**Fix:** Real email/password auth in the new backend eliminates this entirely.

#### Problem 2 — OpenRouter API Key Exposed (vite.config.js, Line 96)
```javascript
// The proxy only hides the key in DEV. In production, the Vite dev server
// doesn't run — the browser calls OpenRouter directly with the key visible.
proxy: { '/api/openrouter': { target: 'https://openrouter.ai/api/v1' } }
```
**Fix:** Move AI calls to the backend API. Frontend calls `/api/ai/quests`. Backend holds the key securely.

#### Problem 3 — Dungeon Timer Split State
The dungeon timer persists `dungeonStartedAt` to Firestore but the dungeon boss/HP state lives in `useDungeonStore.js` (in memory). On hard refresh, the timer restores but boss HP does not sync. **Fix:** All dungeon state lives in PostgreSQL under the user's session row.

---

## 2. Proposed Architecture

### 2.1 New System Diagram

```
Browser (React + Vite + Zustand)
│
│  HTTPS requests with JWT token
│
▼
Backend API (FastAPI or Node.js/Express)
│
├── PostgreSQL Database ← All persistent data
├── bcrypt              ← Password hashing
├── JWT                 ← Session tokens
└── OpenRouter API      ← AI calls (key stays server-side)
```

### 2.2 Technology Choice: FastAPI vs Node.js/Express

| Factor | FastAPI (Python) | Node.js/Express |
|---|---|---|
| Language | Python | JavaScript (same as frontend) |
| Speed | Very fast (async) | Fast (async) |
| Learning | You write Python | Same language as your current code |
| Built-in docs | Auto-generates Swagger UI | Manual setup |
| Type safety | Built-in (Pydantic) | Manual |
| Your existing code | `functions/` already is Node 20 | Reuse skills from `functions/` |
| **Recommendation** | ✅ Good if you want Python | ✅ **Recommended** — reuse JS knowledge |

> **Recommendation: Node.js/Express** — your `functions/` directory already uses Node 20. You know JavaScript. Reusing the same language reduces the mental overhead of switching contexts.

---

## 3. PostgreSQL Database Schema

### 3.1 Table: `users`

Stores one row per registered user. Replaces Firebase Auth for identity.

```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(32) UNIQUE NOT NULL,      -- "ShadowKing", "AmanSingh"
    email       VARCHAR(255) UNIQUE NOT NULL,     -- real email for password reset
    password_hash VARCHAR(255) NOT NULL,          -- bcrypt hash — NEVER store plaintext
    rank_title  VARCHAR(32) DEFAULT 'E-Rank',     -- current hunter rank
    created_at  TIMESTAMPTZ DEFAULT now(),
    last_login  TIMESTAMPTZ
);
```

### 3.2 Table: `players`

Stores XP, level, and the 5 stat values (STR, AGI, INT, etc.) for each user.

```sql
CREATE TABLE players (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    xp          INTEGER DEFAULT 0,
    level       INTEGER DEFAULT 1,
    stat_str    INTEGER DEFAULT 5,               -- Strength
    stat_agi    INTEGER DEFAULT 5,               -- Agility
    stat_int    INTEGER DEFAULT 5,               -- Intelligence
    stat_per    INTEGER DEFAULT 5,               -- Perception
    stat_vit    INTEGER DEFAULT 5,               -- Vitality
    shadows_army INTEGER DEFAULT 0,             -- shadow count from dungeon defeats
    updated_at  TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 Table: `quests`

One row per habit/quest. Each quest belongs to a user via `user_id`.

```sql
CREATE TABLE quests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    category    VARCHAR(50),                     -- "fitness", "study", "work"
    xp_reward   INTEGER DEFAULT 100,
    done        BOOLEAN DEFAULT FALSE,
    streak      INTEGER DEFAULT 0,
    difficulty  VARCHAR(10) DEFAULT 'B',         -- S/A/B/C/D/E rank
    created_at  TIMESTAMPTZ DEFAULT now(),
    last_reset  DATE DEFAULT CURRENT_DATE        -- tracks daily reset
);

-- Index for fast lookup of all quests for a user
CREATE INDEX idx_quests_user_id ON quests(user_id);
```

### 3.4 Table: `dungeons`

Stores the current active dungeon and boss state per user. Only one active dungeon per user at a time.

```sql
CREATE TABLE dungeons (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    active          BOOLEAN DEFAULT FALSE,
    boss_name       VARCHAR(100),
    boss_emoji      VARCHAR(10),
    boss_hp         INTEGER DEFAULT 100,
    boss_hp_max     INTEGER DEFAULT 100,
    blocks_done     INTEGER DEFAULT 0,
    blocks_needed   INTEGER DEFAULT 4,
    started_at      TIMESTAMPTZ                   -- replaces dungeonStartedAt in Firestore
);
```

### 3.5 Table: `friendships`

Stores bidirectional friend relationships for the leaderboard.

```sql
CREATE TABLE friendships (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(10) DEFAULT 'pending',    -- 'pending' | 'accepted'
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(requester_id, addressee_id)             -- no duplicate friend requests
);
```

---

## 4. REST API Design

### 4.1 Authentication Endpoints

```
POST /api/auth/register
  Body:    { username, email, password }
  Returns: { token, user: { id, username, rank_title } }
  Notes:   Password hashed with bcrypt (12 rounds). Returns JWT.

POST /api/auth/login
  Body:    { email, password }
  Returns: { token, user: { id, username, rank_title } }
  Notes:   Verifies bcrypt hash. Returns a new JWT on success.
```

### 4.2 Player Endpoints

```
GET  /api/player
  Auth:    Required (JWT)
  Returns: { xp, level, rank_title, stats: { str, agi, int, per, vit } }

PATCH /api/player/xp
  Auth:    Required (JWT)
  Body:    { amount: 500 }
  Returns: { newXp, newLevel, leveledUp: true/false }
  Notes:   Server validates XP amount (prevents cheating via DevTools)
```

### 4.3 Quest Endpoints

```
GET /api/quests
  Auth:    Required (JWT)
  Returns: [ { id, title, category, xpReward, done, streak, difficulty } ]

POST /api/quests
  Auth:    Required (JWT)
  Body:    { title, category, xpReward, difficulty }
  Returns: { id, title, ... }

PATCH /api/quests/:id
  Auth:    Required (JWT)
  Body:    { done: true }
  Returns: { id, done, streak }

DELETE /api/quests/:id
  Auth:    Required (JWT)
  Returns: { success: true }
```

### 4.4 Dungeon Endpoints

```
GET /api/dungeon
  Auth:    Required (JWT)
  Returns: { active, bossName, bossHp, bossHpMax, blocksDone, blocksNeeded, startedAt }

POST /api/dungeon/start
  Auth:    Required (JWT)
  Body:    { bossName, bossEmoji, blocksNeeded }
  Returns: { dungeon, startedAt }

POST /api/dungeon/complete-block
  Auth:    Required (JWT)
  Returns: { defeated, xpEarned, dungeon }

POST /api/dungeon/retreat
  Auth:    Required (JWT)
  Returns: { success: true }
```

### 4.5 Social / Leaderboard Endpoints

```
GET /api/leaderboard
  Auth:    Required (JWT)
  Returns: [ { username, level, xp, rank_title, position } ]
  Notes:   Returns the logged-in user + all accepted friends, sorted by XP desc

POST /api/friends/add
  Auth:    Required (JWT)
  Body:    { username }
  Returns: { status: 'pending' }

GET /api/friends
  Auth:    Required (JWT)
  Returns: [ { username, status: 'pending'|'accepted' } ]

PATCH /api/friends/:id/accept
  Auth:    Required (JWT)
  Returns: { status: 'accepted' }
```

### 4.6 AI Quest Generation (Moved from Browser)

```
POST /api/ai/generate-quests
  Auth:    Required (JWT)
  Body:    { category, difficulty, count }
  Returns: [ { title, xpReward, difficulty } ]
  Notes:   Backend calls OpenRouter with the secret API key.
           Key is NEVER sent to the browser. Fixes the security hole.
```

---

## 5. JWT Authentication Flow

```
1. User POSTs to /api/auth/login with email + password
2. Server looks up user in PostgreSQL by email
3. Server compares submitted password against stored bcrypt hash
4. If match: server signs a JWT with { userId, username }
5. JWT is returned to frontend
6. Frontend stores JWT in memory (NOT localStorage — XSS safe)
7. Every subsequent API call includes: Authorization: Bearer <token>
8. Server middleware verifies the JWT signature on every request
9. If valid: req.userId is set → query only that user's data
10. If expired: 401 response → frontend redirects to login
```

**JWT Payload Structure:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "username": "ShadowKing",
  "iat": 1750000000,
  "exp": 1750086400
}
```

---

## 6. Frontend Changes Required

### 6.1 Replace localStorage calls with API calls

**Current code (useQuestStore.js — localStorage):**
```javascript
// Currently quests are stored in memory (Zustand) + synced to Firestore
setQuests: (quests) => set({ quests }),
```

**New code — API calls:**
```javascript
// Load quests from backend on app start
const loadQuests = async () => {
  const res = await fetch('/api/quests', {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  const quests = await res.json();
  useQuestStore.getState().setQuests(quests);
};
```

### 6.2 Replace the fake-email auth hack

**Current (AuthPage.jsx, Line 25 — the hack):**
```javascript
const getFakeEmail = (name) => `${name.toLowerCase().replace(...)}@hunter.shadow`;
await signInWithEmailAndPassword(auth, getFakeEmail(username), password);
```

**New — call the real API:**
```javascript
const res = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { token, user } = await res.json();
setToken(token); // store in memory
```

### 6.3 Remove Firebase (optional, Phase 2)

Once the backend is live, Firebase Auth and Firestore can be fully removed:
- Remove `src/firebase.js`
- Remove Firebase SDK from `package.json`
- Remove `firebase.json` and `.firebaserc`
- Remove Firebase chunk from `vite.config.js` (reduces bundle by ~120KB)

---

## 7. Docker & Deployment Updates

### 7.1 New docker-compose.yml (adds backend + database)

```yaml
version: "3.9"

services:

  # ── PostgreSQL Database ─────────────────────────────────
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: shadow
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: sololeveling
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shadow"]
      interval: 10s
      retries: 5

  # ── Backend API (Node.js/Express) ───────────────────────
  api:
    build: ./backend
    environment:
      DATABASE_URL: postgres://shadow:${DB_PASSWORD}@db:5432/sololeveling
      JWT_SECRET: ${JWT_SECRET}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
    ports:
      - "3001:3001"
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  # ── Frontend (Nginx serving Vite build) ─────────────────
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    ports:
      - "8080:80"
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
```

### 7.2 Nginx proxy — route `/api` to backend

Update `nginx.conf` to proxy API calls:
```nginx
location /api/ {
    proxy_pass http://api:3001/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```
This means the frontend only ever talks to `localhost` — no CORS issues.

---

## 8. Data Migration Plan

### 8.1 From localStorage → PostgreSQL

Users who have existing data in localStorage need a one-time migration:

```
1. On first login after upgrade, app reads localStorage data
2. Calls POST /api/migrate with the localStorage payload
3. Backend inserts the data into PostgreSQL under the user's account
4. Backend sets a flag: user.migrated = true
5. Frontend clears localStorage after successful migration
6. Never runs migration again (flag prevents double-migration)
```

### 8.2 From Firestore → PostgreSQL

The only Firestore data is `dungeonStartedAt`. Migration:
```
1. After login, read Firestore doc for the user
2. If dungeons.startedAt exists, call POST /api/dungeon/restore
3. Backend saves it to the dungeons table
4. Delete the Firestore document
```

---

## 9. Leaderboard SQL Query

This single query powers the leaderboard — it fetches the user + all their accepted friends, ranked by XP:

```sql
SELECT
    u.username,
    u.rank_title,
    p.level,
    p.xp,
    RANK() OVER (ORDER BY p.xp DESC) AS position
FROM players p
JOIN users u ON u.id = p.user_id
WHERE u.id = $1                                   -- the logged-in user
   OR u.id IN (
       SELECT
           CASE
               WHEN requester_id = $1 THEN addressee_id
               ELSE requester_id
           END
       FROM friendships
       WHERE (requester_id = $1 OR addressee_id = $1)
         AND status = 'accepted'
   )
ORDER BY p.xp DESC;
```

---

## 10. Environment Variables

New `.env` additions for the backend:

```env
# PostgreSQL
DB_PASSWORD=your_secure_password_here
DATABASE_URL=postgres://shadow:your_secure_password_here@localhost:5432/sololeveling

# JWT
JWT_SECRET=your_256_bit_secret_key_here
JWT_EXPIRES_IN=24h

# AI (moved from browser to backend)
OPENROUTER_API_KEY=sk-or-...

# Optional: Keep Firebase only during migration period
VITE_FIREBASE_API_KEY=...
```

---

## 11. Managed Database Options (No Server Required)

If you don't want to self-host PostgreSQL, these services offer a free PostgreSQL tier:

| Service | Free Tier | Notes |
|---|---|---|
| **Supabase** | 500MB, 2 projects | Also gives you a REST API auto-generated from schema |
| **Neon** | 0.5 CPU, 1GB storage | Serverless Postgres, branches like Git |
| **Railway** | $5/month credit | Easiest Docker deploy + Postgres in one click |
| **Render** | Free (sleeps after 15min) | Good for hobby projects |

> **Recommendation:** Start with **Supabase** — it also gives you a web UI to inspect your data, built-in auth (can replace Firebase Auth), and row-level security policies that map exactly to what your Firestore Security Rules currently do.

---

## 12. Implementation Order

```
Step 1:  Set up PostgreSQL (Docker or Supabase)
Step 2:  Run the DDL (CREATE TABLE statements above)
Step 3:  Create the Node.js backend project in /backend
Step 4:  Implement /api/auth/register and /api/auth/login
Step 5:  Test auth with Postman/Bruno
Step 6:  Implement /api/quests CRUD
Step 7:  Update useQuestStore.js to call the API
Step 8:  Implement /api/player and /api/dungeon
Step 9:  Implement /api/ai/generate-quests (move OpenRouter key to backend)
Step 10: Implement migration endpoint (/api/migrate)
Step 11: Implement /api/friends and /api/leaderboard
Step 12: Build leaderboard UI panel in React
Step 13: Update docker-compose.yml with db + api services
Step 14: Remove Firebase from the project
```

---

## 13. Summary

| Area | Current | Target |
|---|---|---|
| Auth | Firebase Auth (fake email hack) | Real email/password → JWT |
| Data storage | localStorage + Firestore | PostgreSQL |
| API | None (direct Firestore) | Node.js REST API |
| AI calls | Browser → OpenRouter (key exposed) | Backend → OpenRouter (key secure) |
| Dungeon timer | Split between Zustand + Firestore | Unified in PostgreSQL |
| Social | None | Friends + Leaderboard via SQL |
| Deployment | Docker (frontend only) | Docker (frontend + backend + DB) |
