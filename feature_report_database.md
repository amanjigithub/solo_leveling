Feature & Technical Report — Database Implementation

Date: 2026-08-12T13:37:45.554+05:30
Prepared by: Assistant (AI assistant using Copilot CLI runtime in VS Code)

========================
User-provided section (original)
========================

"The biggest limitation of localStorage is that data is tied to one browser on one device. If the user opens the app on a different phone, their habits and XP are gone. With a backend, I would build user authentication — email and password login — and store all habit data in a database like PostgreSQL. I would build a REST API using FastAPI or Node.js with endpoints to create, read, update, and delete habits. I would also add a social feature — users could add friends and see each other's ranks on a leaderboard. This would turn it from a personal tool into a small community, which would make the motivation much stronger."

(Above is included verbatim so the user's original feature idea is preserved.)

========================
Assistant-provided section (technical report, FastAPI + PostgreSQL)
========================

1. Goal
- Replace localStorage persistence with a backend service + PostgreSQL so users can access their habits and XP across devices.
- Add secure email/password authentication and a social layer (friends + leaderboard).
- Provide a REST API for client apps and a migration path to import/merge existing localStorage data.

2. High-level architecture
- Client (web/mobile) -> HTTPS -> FastAPI backend -> PostgreSQL database
- Optional Redis for caching, rate-limiting, and session/refresh token storage
- Dockerized services for local dev and production packaging

3. Core data model (PostgreSQL)
- users
  - id: UUID PRIMARY KEY
  - email: TEXT UNIQUE NOT NULL
  - password_hash: TEXT NOT NULL
  - display_name: TEXT
  - total_xp: INTEGER DEFAULT 0
  - created_at: TIMESTAMP WITH TIME ZONE DEFAULT now()
  - last_seen: TIMESTAMP WITH TIME ZONE

- habits
  - id: UUID PRIMARY KEY
  - user_id: UUID REFERENCES users(id) ON DELETE CASCADE
  - title: TEXT NOT NULL
  - description: TEXT
  - xp_value: INTEGER DEFAULT 10
  - streak: INTEGER DEFAULT 0
  - created_at, updated_at: timestamps

- completions (habit activity)
  - id: UUID PRIMARY KEY
  - habit_id: UUID REFERENCES habits(id) ON DELETE CASCADE
  - user_id: UUID REFERENCES users(id)
  - completed_at: TIMESTAMP WITH TIME ZONE NOT NULL
  - xp_awarded: INTEGER

- friendships
  - id: UUID PRIMARY KEY
  - requester_id: UUID REFERENCES users(id)
  - receiver_id: UUID REFERENCES users(id)
  - status: TEXT CHECK (status IN ('pending','accepted','blocked')) DEFAULT 'pending'
  - created_at

- indexes: on users(email), completions(completed_at), habit.user_id, and any leaderboard aggregates

4. Example SQL DDL (conceptual)
- Provide a small SQL example (in repo if chosen to implement). Keep migrations using Alembic for FastAPI projects.

5. Authentication & security
- Passwords hashed with bcrypt or argon2 (use passlib in Python)
- JWT access tokens (short expiry, e.g., 15m) and refresh tokens (longer expiry, stored securely; consider rotating refresh tokens and storing a hashed token in DB or Redis)
- All endpoints validated with Pydantic models; use HTTPS only in production
- Rate-limit auth endpoints; implement account lockout/backoff on repeated failures
- CSRF not primary concern for mobile/native apps; for web, use secureSameSite cookies for refresh tokens if using cookie-based approach

6. REST API design (routes summary)
- Auth
  - POST /auth/register — {email, password, display_name}
  - POST /auth/login — {email, password} -> returns access_token + refresh_token
  - POST /auth/refresh — {refresh_token} -> new access_token
  - POST /auth/logout — invalidate refresh token

- Users
  - GET /users/me
  - PUT /users/me
  - GET /users/:id (public profile)

- Habits
  - POST /habits — create habit for authenticated user
  - GET /habits — list user's habits
  - GET /habits/:id
  - PUT /habits/:id
  - DELETE /habits/:id

- Completions / XP
  - POST /habits/:id/complete — add a completion, award XP, update streak & user.total_xp
  - GET /habits/:id/completions

- Friends & Social
  - POST /friends/request — {friend_email or friend_id}
  - POST /friends/:id/accept
  - DELETE /friends/:id
  - GET /friends — list friends
  - GET /leaderboard?limit=50&friendsOnly=true

7. LocalStorage migration strategy (client + server)
- On first login, client POST /sync/local-data with payload of local habits & completions
- Server-side merging strategies (choose one):
  - Prefer server: import only habits/completions missing on server
  - Merge by timestamp: accept newer records
  - Offer a UI conflict resolution flow for ambiguous duplicates
- Mark migrated local data as "synced" on client to avoid re-submissions

8. Leaderboard and social features
- Leaderboard calculated by summing users.total_xp; implement as cached or materialized view updated on completions
- Friends-only leaderboard: compute by joining friendships where status='accepted'
- Privacy opt-in: users can choose whether to appear on global leaderboard

9. Scalability & performance
- For expected small user base, single Postgres instance is fine
- Use Redis for caching leaderboard and recent queries
- Add background workers (Celery/RQ) for non-blocking tasks: email sending, heavy aggregation, sending friend notifications
- Apply pagination for endpoints returning lists

10. Testing & QA
- Unit tests for API endpoints and models (pytest)
- Integration tests with a test PostgreSQL instance (use testcontainers or a Docker Compose test setup)
- Security tests: password storage, JWT expiry, refresh token rotation

11. Deployment & infra
- Dockerfile for backend, docker-compose for local development (postgres + redis + backend)
- CI pipeline: run linters, unit tests, build image, push to registry
- Deploy to a managed provider (Railway/Render/Heroku) or cloud (AWS ECS, GKE)
- Use environment variables for secrets and database URLs; use manageable secret storage in production

12. Migration & rollout plan (minimal phased approach)
- Phase 0: Design and schema, add migrations, skeleton FastAPI app
- Phase 1: Auth + user model + basic habits CRUD + migration endpoint; manual testing
- Phase 2: Completions & XP logic + leaderboard read endpoints
- Phase 3: Friend requests + friends-only leaderboard
- Phase 4: Polish, tests, CI/CD, deploy, monitor

Estimated effort (rough)
- Phase 0–1: 2–4 days
- Phase 2–3: 3–5 days
- Phase 4 and hardening: 2–3 days
(Estimates assume one full-time developer familiar with FastAPI and Postgres.)

13. Security & privacy checklist
- Hash passwords (bcrypt/argon2)
- Use TLS/HTTPS in production
- Validate & sanitize inputs; limit upload sizes
- Rate-limit auth endpoints and sensitive APIs
- Store refresh tokens securely; revoke on logout
- Implement user privacy controls for social features

14. Risks & mitigation
- Data merge conflicts: provide conservative defaults and an opt-in client-side merge UI
- Increased complexity from social features: roll out friends/leaderboard later after core auth & sync
- Operational costs: use managed Postgres or start with small instance

15. Next actionable steps (recommended)
- Create a small FastAPI skeleton and add User + Auth endpoints with database migrations (Alembic)
- Add unit tests for registration/login and habits CRUD
- Implement a client-side local-data export/import to test migration flow
- Iterate on social features after basic persistence works cross-device

Appendix: Useful libraries & tools (FastAPI stack)
- FastAPI, Uvicorn, SQLAlchemy (or SQLModel), Alembic, Pydantic
- passlib (bcrypt/argon2), PyJWT or jose for JWT
- psycopg2-binary / asyncpg, Redis + aioredis
- pytest, pytest-asyncio, httpx for tests

If you want, the next step is to create the FastAPI skeleton and a database schema (migrations). Confirm if that is desired and whether to initialize the repository with a /backend/ folder and a Docker Compose development setup.

---

End of assistant-provided technical report.
