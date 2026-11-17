# Step 1: Set Up Firebase for the Database

This guide explains how to connect the Solo Leveling React application to Firebase. It is written as a learning guide, so it explains not only what to do, but also why each step is necessary.

## What We Are Building

The application uses two Firebase services:

1. **Firebase Authentication** identifies the person using the app.
2. **Cloud Firestore** stores that user's game data.

The data flow is:

```text
User opens the app
        |
        v
Firebase Authentication checks the user's identity
        |
        v
Firebase gives the user a unique uid
        |
        v
Firestore reads and writes hunters/{uid}
```

The `uid` is the connection between an authenticated user and that user's database document.

## Important Security Idea

The Firebase configuration used by a web app is placed in browser code. Therefore, it should not be treated like a password.

For example, the Firebase API key helps the application identify the Firebase project, but it does not decide whether a user can read or write data.

The real protection comes from:

- Firebase Authentication, which identifies the user.
- Firestore Security Rules, which check whether that user may access a document.
- Firebase Secret Manager, which stores private backend keys such as the OpenRouter key.

Never put a private server key in a `VITE_*` variable. Vite sends `VITE_*` variables to browser code during the build.

## Step 1: Create a Firebase Project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Sign in with your Google account.
3. Select **Add project**.
4. Give the project a name, for example `shadow-system`.
5. Google Analytics is optional for this project. You can disable it while learning.
6. Finish project creation.

A Firebase project is the cloud container for Authentication, Firestore, Functions, hosting, and other services.

## Step 2: Register the Web Application

Firebase needs to know which web application will connect to the project.

1. Open the new project in Firebase Console.
2. On the project overview page, select the **Web** icon (`</>`).
3. Enter an app nickname, such as `shadow-system-web`.
4. Firebase Hosting is optional here. Do not enable it unless you plan to deploy with Firebase Hosting.
5. Select **Register app**.
6. Firebase displays a configuration object containing values such as `apiKey`, `authDomain`, and `projectId`.

Copy those values. They belong in the local `.env` file, not in `.env.example`.

### What was implemented in this project

The project now reads those Firebase values from `import.meta.env` in `src/firebase.js`. This is the application-side half of registration. Firebase Console supplies the project identity, and Vite injects the values when it starts or builds the app.

The actual Firebase Console registration cannot be performed by the React code. You must create or select the Firebase project and copy its web-app values into `.env`. Once that is done, the code can initialize Firebase automatically.

## Step 2A: Implement Real Email Authentication

Authentication is the next part of the database foundation. A database record needs a reliable owner. In this app, Firebase Authentication creates that owner identity and returns a unique `uid`.

The important distinction is:

```text
email + password  ->  Firebase Authentication  ->  uid
uid               ->  hunters/{uid}             ->  Firestore data
```

The project previously generated a fake email from the hunter name, such as `name@hunter.shadow`. That caused collisions and made password reset impossible. The implementation now uses a real email field for email/password accounts:

- Login calls `signInWithEmailAndPassword(auth, email, password)`.
- Signup calls `createUserWithEmailAndPassword(auth, email, password)`.
- Signup then calls `updateProfile` to save the hunter name as `displayName`.
- The database still uses the Firebase `uid`, not the email or hunter name, as the document ID.

This separation is important. An email can change, and a hunter name is a display label. The Firebase UID is the stable identity used to own database data.

### What to do in Firebase Console

1. Open **Build > Authentication**.
2. Select **Get started**.
3. Open **Sign-in method**.
4. Enable **Email/Password**.
5. Save the provider.
6. Leave **Email link** disabled unless you specifically want passwordless login.

The code cannot enable a Firebase provider for you. Provider configuration belongs to the Firebase project and is intentionally controlled in the Console.

### How signup works in the code

The signup sequence is:

```text
User enters email, hunter name, and password
        |
        v
The form validates the values
        |
        v
Firebase creates the account and hashes the password
        |
        v
Firebase returns user.uid
        |
        v
The app saves hunter name as user.displayName
        |
        v
onAuthStateChanged sends the user to GameApp
```

The password is sent to Firebase Authentication over HTTPS. The application does not write the password to Firestore or localStorage.

### How login works in the code

When a user logs in, the app sends the email and password to Firebase. Firebase verifies them and restores the authenticated session. `App.jsx` listens with `onAuthStateChanged`, so the application does not need to manually copy a password or store a custom login flag.

When Firebase reports a user, `App.jsx` creates this small session object:

```javascript
{
    uid: user.uid,
    username: user.displayName || user.email.split("@")[0]
}
```

`GameApp` uses `session.uid` when reading and writing Firestore. This is how authentication and database ownership connect.

### Test Step 2

After filling `.env` and enabling Email/Password:

1. Restart the Vite server.
2. Open the app at `http://localhost:5173`.
3. Select **REGISTER**.
4. Enter a real email address that you control.
5. Enter a hunter name and password.
6. Accept the Hunter's Oath.
7. Register the account.
8. In Firebase Console, open **Authentication > Users**.
9. Confirm that the new email account exists and has a generated UID.

Then log out and log in again using the same real email and password.

## Step 3: Create the Local Environment File

The repository includes `.env.example` as a template. From the project root, create your private local file:

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder values:

```env
VITE_FIREBASE_API_KEY=your_real_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_real_sender_id
VITE_FIREBASE_APP_ID=your_real_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_real_measurement_id
```

### What Step 3 means

Step 3 creates the bridge between your computer and the Firebase project. The Firebase Console contains the cloud project. The `.env` file tells this local Vite development server which project to use.

There are three different things involved:

```text
Firebase Console       = cloud configuration
.env                   = local values for this project
src/firebase.js        = JavaScript code that reads those values
```

The `.env` file is plain text made of `NAME=value` pairs. For example:

```env
VITE_FIREBASE_PROJECT_ID=shadow-system-d5f7f
```

The name is on the left. The value is on the right. Do not add a semicolon at the end.

### Implementing Step 3 on macOS

Run these commands from the project root, the directory containing `package.json`:

```bash
pwd
cp .env.example .env
```

If `.env` already exists, do not run the copy command again unless you have backed up your current values. Copying the template over the real file would replace your Firebase configuration with placeholders.

Open the file in VS Code:

```bash
code .env
```

Paste the values from **Firebase Console > Project settings > Your apps > SDK setup and configuration**. Keep the variable names exactly as written. Only replace the values.

### How the value travels through the app

The complete path is:

```text
.env
        |
        | Vite reads VITE_* values when it starts
        v
import.meta.env.VITE_FIREBASE_PROJECT_ID
        |
        | src/firebase.js builds firebaseConfig
        v
initializeApp(firebaseConfig)
        |
        v
Firebase Auth and Firestore connect to your project
```

Vite performs this replacement at development-server startup and at build time. It is not a runtime database lookup. That is why changing `.env` requires restarting `npm run dev`.

### Required values and optional values

The application requires these six values before it will initialize Firebase:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

`VITE_FIREBASE_MEASUREMENT_ID` is optional for the current Firebase initialization because Analytics is not initialized in `src/firebase.js`.

The OpenRouter variables are separate from Firebase. `VITE_OPENROUTER_MODEL` selects the AI model. `VITE_OPENROUTER_API_KEY` is currently used by the development AI path, but because it begins with `VITE_`, it is included in browser JavaScript. It must not contain a valuable production secret. The project already includes a Firebase Cloud Function intended to keep the production AI secret on the server; that migration is a later step.

### Safely check whether `.env` is filled in

Never paste the output of `cat .env` into chat or commit it. To check only whether values are present, run:

```bash
awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{if ($2 == "" || $2 ~ /your_|YOUR_/) print $1 ": missing-or-placeholder"; else print $1 ": present"}' .env
```

This prints variable names and status, not the secret values.

### How the project detects a missing configuration

`src/firebase.js` builds a `firebaseConfig` object from `import.meta.env`. It then checks the required keys with `isFirebaseConfigured`.

If any required value is missing, Firebase is not initialized. This is deliberate: attempting to call Authentication or Firestore with an incomplete configuration would create a less understandable runtime error.

`App.jsx` reads `isFirebaseConfigured`. When it is `false`, the app displays the Firebase setup message. When it is `true`, the app starts `onAuthStateChanged` and waits for Firebase to report the current login state.

### Step 3 test procedure

1. Confirm `.env` exists beside `package.json`.
2. Confirm the six Firebase values are present.
3. Stop the development server if it is running.
4. Start it again with `npm run dev`.
5. Open the printed local URL.
6. Confirm the app does not display `SYSTEM OFFLINE: FIREBASE KEYS MISSING`.
7. Open the browser Developer Tools console. There should be no Firebase configuration error.
8. Register or log in with the Step 2 email flow.

This tests the local configuration path. It does not yet prove that Firestore Rules are correct; that requires an authenticated read or write and is covered by the later Firestore steps.

### Why the `VITE_` prefix matters

Vite only exposes variables beginning with `VITE_` to frontend code. The application reads them with `import.meta.env`.

For example:

```javascript
import.meta.env.VITE_FIREBASE_PROJECT_ID
```

During `npm run build`, Vite replaces that expression with the configured value.

### Why `.env` is ignored by Git

The `.gitignore` file contains:

```text
.env
.env.local
.env.production
```

This prevents local configuration from being committed accidentally. The `.env.example` file is safe to commit because it contains placeholders only.

## Step 4: Understand `src/firebase.js`

The Firebase client setup is in `src/firebase.js`.

The configuration object reads the environment variables:

```javascript
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
```

Then the application checks that all required values exist:

```javascript
const REQUIRED_KEYS = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
];
```

If a value is missing, `isFirebaseConfigured` becomes `false`. `App.jsx` then shows the Firebase configuration error screen instead of trying to use an incomplete connection.

When the values are valid, the application creates three important objects:

```javascript
app = initializeApp(firebaseConfig);
auth = getAuth(app);
db = getFirestore(app);
```

Their purposes are:

- `app`: the connection to the Firebase project.
- `auth`: the Firebase Authentication service.
- `db`: the Cloud Firestore database service.

## Step 5: Enable Authentication

In Firebase Console:

1. Open **Build > Authentication**.
2. Select **Get started**.
3. Open the **Sign-in method** tab.
4. Enable **Email/Password**.
5. Enable **Google** if you want the Google login button to work.
6. Save each provider.

The current `AuthPage.jsx` uses:

```javascript
createUserWithEmailAndPassword(auth, email, password)
signInWithEmailAndPassword(auth, email, password)
signInWithPopup(auth, googleProvider)
```

Firebase stores the password securely. The application does not store the password in Firestore.

### Current profile behavior

The email/password screen asks for both a real email address and a hunter name. Firebase uses the email and password for authentication. The hunter name is saved separately as `displayName`, which is the name shown inside the game.

Google login supplies its own real Google identity. The app uses the Google display name when one is available.

## Step 6: Add Authorized Domains

Firebase Authentication only accepts requests from approved domains.

1. Open **Authentication > Settings**.
2. Find **Authorized domains**.
3. Confirm that `localhost` exists for local development.
4. Add the production domain when you deploy, for example:

```text
sololevelinghabittracker.netlify.app
```

Without this step, Google login or authentication may fail even when the code is correct.

## Step 7: Create the Firestore Database

In Firebase Console:

1. Open **Build > Firestore Database**.
2. Select **Create database**.
3. Choose a region close to your users.
4. Start in test mode only while learning locally.
5. Create the database.

Test mode is temporary and permissive. Before production, replace it with proper rules. Do not leave an unrestricted database public.

## Step 8: Understand the Current Firestore Data Shape

The current application stores one document per authenticated user:

```text
hunters/{uid}
```

Example:

```text
hunters
└── abc123-user-uid
    ├── player
    ├── quests
    ├── dungeon
    ├── shadows
    ├── systemLog
    └── lastQuestReset
```

This is a Firestore document containing nested JavaScript objects and arrays. It is not a collection of separate quest documents yet.

The code opens this document with:

```javascript
const docRef = doc(db, "hunters", uid);
```

The first argument, `hunters`, is the collection name. The second argument, `uid`, is the document ID.

## Step 9: Read Data in Real Time

`GameApp.jsx` uses `onSnapshot`:

```javascript
const unsubscribe = onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
        const loaded = snap.data();
        setState(loaded);
    }
});
```

`onSnapshot` does two jobs:

1. It loads the document immediately.
2. It keeps listening for changes.

If the same user changes data in another browser, Firestore can send the new document to this browser automatically.

The listener returns an unsubscribe function. React calls it when the component is removed:

```javascript
return () => unsubscribe();
```

This cleanup is important because it closes the live listener after logout or navigation.

## Step 10: Write Data

The app writes the complete user state with:

```javascript
await setDoc(doc(db, "hunters", session.uid), state);
```

`setDoc` creates the document if it does not exist. If it already exists, it replaces the stored document with the new state.

Before writing to Firestore, the app saves to `localStorage`. It also delays the Firestore write by 500 milliseconds. This is called debouncing. It reduces unnecessary writes when several updates happen close together.

The current save sequence is:

```text
User completes a quest
        |
        v
React state changes
        |
        v
localStorage is updated immediately
        |
        v
Firestore write waits 500 ms
        |
        v
hunters/{uid} is updated
```

## Step 11: Add Firestore Security Rules Before Production

A basic rule should ensure that a signed-in user can access only their own document:

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /hunters/{userId} {
      allow read, write: if request.auth != null
                        && request.auth.uid == userId;
    }
  }
}
```

The rule means:

- `request.auth != null`: the caller must be logged in.
- `request.auth.uid == userId`: the caller's Firebase UID must match the document ID.

This prevents one logged-in user from reading or changing another user's data.

Rules are enforced by Firebase. They are more important than hiding the Firebase configuration values.

## Step 12: Run the Application

Install dependencies if necessary:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the URL printed by Vite, normally:

```text
http://localhost:5173
```

If `.env` is missing or a variable is blank, the application displays:

```text
SYSTEM OFFLINE: FIREBASE KEYS MISSING
```

After changing `.env`, stop and restart Vite. Environment variables are read when Vite starts.

## Step 13: Verify Steps 1-3

Use this checklist:

- [ ] Firebase project exists.
- [ ] Web app is registered in Firebase.
- [ ] `.env` exists in the project root.
- [ ] `.env` contains the six required Firebase values.
- [ ] `.env.example` contains placeholders only.
- [ ] `.env` is not printed, uploaded, or committed.
- [ ] `.env` is not committed to Git.
- [ ] Email/Password authentication is enabled.
- [ ] Google authentication is enabled if needed.
- [ ] `localhost` is an authorized domain.
- [ ] Firestore Database is created.
- [ ] `npm run build` succeeds.
- [ ] The app opens without the Firebase offline message.
- [ ] A test account can register or log in.
- [ ] A `hunters/{uid}` document appears in Firestore after entering the app.

## Common Problems

### The app says Firebase keys are missing

Check the following:

1. The file is named exactly `.env`.
2. It is in the project root, beside `package.json`.
3. Every variable starts with `VITE_`.
4. There are no accidental quotes or spaces around values.
5. Vite was restarted after editing `.env`.

### Login fails

Check that:

- Email/Password is enabled in Authentication.
- Google is enabled if using Google login.
- The current domain is in Authorized domains.
- The Firebase project in `.env` is the project where Authentication was enabled.

### Firestore permission denied

This normally means the Firestore rules rejected the request. Confirm that:

- The user is authenticated.
- The document ID is the same as `session.uid`.
- The rules allow `request.auth.uid == userId`.

### The document does not appear

The document is created when the app has a valid authenticated session and `GameApp` saves state. Check the browser console and the Firestore Rules simulator for errors.

## What Steps 1-3 Do Not Implement Yet

Steps 1-3 establish the Firebase connection, local configuration, and cloud service entry points. They do not yet:

- Split quests into their own collection.
- Move all game calculations to a trusted backend.
- Add a PostgreSQL database.
- Add friend relationships or a leaderboard.
- Add password reset or email verification UI.

Those are later architecture improvements. For now, the application has a working foundation: an authenticated user, a UID, and a Firestore document associated with that UID.
