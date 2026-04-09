# 🗡️ Shadow System: Solo Leveling Habit Tracker

<div align="center">
  <h3>Awaken your potential. Turn your real life into a role-playing game.</h3>
  <p>A gamified habit tracker inspired by the anime/manhwa <em>Solo Leveling</em>. Level up by completing daily quests, track your habits, and watch your stats grow.</p>
</div>

---

## 🌟 Features

- **Gamified Habit Tracking**: Turn your mundane daily tasks into RPG quests. Complete them to earn XP and level up.
- **Dynamic Stats Progression**: Your stats grow as you consistently complete your habits.
- **Google Authentication**: Securely log in using your Google account to keep your progress saved across devices.
- **Cross-Device Sync (Firebase)**: Your stats and habits are stored in real-time in the cloud.
- **Sleek Aesthetic**: A premium dark-mode UI inspired directly by the system windows in Solo Leveling.

## 🛠️ Tech Stack

- **Frontend**: React.js 18 + Vite (for blazing fast development)
- **Authentication**: Firebase Authentication (Google OAuth)
- **Database**: Cloud Firestore (NoSQL for player stats & quests)
- **Deployment**: Netlify

## 🚀 Live Demo

The application is deployed and live at:  
👉 **[sololevelinghabittracker.netlify.app](https://sololevelinghabittracker.netlify.app/)**

## 💻 Running Locally

To run this project on your local machine, follow these steps:

### 1. Clone the repository
```bash
git clone https://github.com/amanjigithub/solo_leveling.git
cd solo_leveling
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Firebase Configuration
Since the app uses Firebase, you'll need the environment setup.
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project and enable Authentication (Google) and Firestore Database.
3. Replace the `firebaseConfig` variables in `src/firebase.js` with your own project's configuration keys. Remember to add `localhost` to your Authorized Domains in Firebase Auth settings.

### 4. Start the development server
```bash
npm run dev
```

Your app will be running at `http://localhost:5173`.

## 📦 Deployment

This project is configured for continuous deployment on **Netlify**.
Whenever code is pushed to the `testing` (or `main`) branch, Netlify automatically triggers a build via the instructions in `netlify.toml`.

To build the project manually for production:
```bash
npm run build
```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

*Arise.*
