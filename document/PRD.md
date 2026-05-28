# Product Requirements Document (PRD)
## Shadow System: Solo Leveling Habit Tracker

**Version:** 1.0
**Project Name:** Solo Leveling Habit Tracker
**Platform:** Web Application (Responsive)
**Date:** May 2026

---

## 1. Introduction
### 1.1 Objective
The Solo Leveling Habit Tracker ("Shadow System") aims to transform mundane daily tasks and habits into an engaging, gamified RPG experience. Inspired by the popular anime/manhwa *Solo Leveling*, the application motivates users to build consistent habits by rewarding them with XP, leveling up, and stat progression.

### 1.2 Target Audience
- Fans of *Solo Leveling* and RPG gaming mechanics.
- Individuals seeking motivation to build and maintain daily habits.
- Users looking for a sleek, dark-themed productivity tool with cross-device synchronization.

---

## 2. Product Vision
To create an immersive productivity tool where users feel like the "Player" of their own lives. By framing daily chores, fitness routines, and work tasks as "Quests," users will experience a tangible sense of progression and accomplishment as their virtual stats and levels grow.

---

## 3. Key Features

### 3.1 Gamified Habit Tracking (Quests)
- **Daily Quests:** Users can create, read, update, and delete (CRUD) daily tasks.
- **Quest Completion:** Marking a quest as complete grants Experience Points (XP).
- **Penalty System:** (Optional/Future) Uncompleted quests may result in negative consequences to simulate the "Penalty Zone" from the source material.

### 3.2 Dynamic Stats and Progression
- **Leveling System:** Accumulating sufficient XP increases the user's overall Level.
- **Stat Growth:** Consistent completion of habits contributes to core stats (e.g., Strength, Agility, Intelligence), which grow over time.
- **Real-time Updates:** XP and Level calculations must accurately reflect quest toggling (completion and undoing).

### 3.3 AI Generation Feature
- **AI Integration:** An "AI Generate" functionality to help users auto-generate habit ideas, quest descriptions, or personalized routines based on their goals.

### 3.4 Cross-Device Synchronization
- **Cloud Storage:** Player states (levels, stats, active quests) are persisted in the cloud, allowing seamless transitions between desktop and mobile browsers.
- **Real-time Sync:** Changes made on one device instantly reflect on another.

### 3.5 Authentication and Security
- **Google Authentication:** Secure and quick login using Google OAuth (via Firebase).
- **Code Security:** Frontend code obfuscation deployed in the build process to protect game logic and prevent tampering.

### 3.6 User Interface (UI) and Aesthetics
- **System Window UI:** A premium, sleek, dark-mode aesthetic mirroring the system interface seen in *Solo Leveling*.
- **Responsive Design:** Optimized for both desktop and mobile viewing.

---

## 4. User Flow
1. **Onboarding:** User arrives at the landing page and logs in via Google Auth.
2. **Dashboard:** User is presented with their current Level, Stats, and a list of Daily Quests.
3. **Quest Management:** User adds new habits/tasks for the day (manually or via AI Generation).
4. **Action:** User completes tasks in real life and marks them as done in the app.
5. **Reward:** The UI displays an XP gain animation, and if the threshold is met, a "Level Up" notification appears. Stats are recalculated.
6. **Persistence:** Data is saved to Firestore automatically.

---

## 5. Technical Specifications

### 5.1 Technology Stack
- **Frontend Core:** React.js 18, HTML5, CSS3 (Vanilla CSS preferred for custom UI, or specific framework if utilized).
- **Build Tool:** Vite (configured for base paths and obfuscation).
- **Backend & Database:** Firebase (Firestore NoSQL Database).
- **Authentication:** Firebase Auth (Google Provider) & `@react-oauth/google`.
- **Deployment & Hosting:** Netlify (configured via `netlify.toml` with continuous deployment from GitHub) and optionally GitHub Pages.

### 5.2 Key Dependencies
- `react`, `react-dom`
- `firebase` (v12+)
- `@react-oauth/google`, `jwt-decode`
- Development: `vite-plugin-javascript-obfuscator`, `gh-pages`

---

## 6. Non-Functional Requirements

### 6.1 Performance
- **Load Time:** The application must load quickly. Optimization is required to ensure obfuscation plugins do not severely impact initialization times.
- **Responsiveness:** Immediate UI feedback upon marking quests as complete, followed by background syncing to Firestore.

### 6.2 Security
- **Data Privacy:** User data is strictly isolated within Firestore using security rules tied to the authenticated user's UID.
- **Vulnerability Management:** Regular dependency audits are required to mitigate risks (e.g., historical patching of prototype pollution in `protobufjs`).

### 6.3 Reliability
- High availability provided by Firebase and Netlify.

---

## 7. Future Enhancements (Backlog)
- **Job/Class Change System:** Unlocking specific classes (e.g., Necromancer, Assassin) at higher levels.
- **Shadow Extraction:** A feature to review past completed habits and "extract" them into a streak or milestone system.
- **Social Leaderboards:** Comparing levels and stats with friends.
- **Push Notifications:** Reminders for daily quests before the day ends.
