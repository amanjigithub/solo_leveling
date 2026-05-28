# ⚙️ Learn: Servers, Backends & Firebase Cloud Functions

> **What we changed:** Added a Firebase Cloud Function to keep the OpenRouter API key secret  
> **Why:** Anyone who opened DevTools could see and steal your API key

---

## 1. What Is a "Server"?

A **server** is just a computer that runs code 24/7 and responds to requests from other computers (like your browser).

```
Your Browser (client)           Google's Servers (server)
      │                               │
      │── "Hey, give me quests" ──→   │
      │                               │  (runs code, calls OpenRouter)
      │← "Here are 3 quests" ─────── │
```

**The key thing:** Code that runs on a server is **private**. Users can't see it. This is where secrets (like API keys) should live.

**Code that runs in the browser is PUBLIC.** Anyone can open DevTools → Sources and read every line of your JavaScript. If your API key is there, it's exposed.

---

## 2. What Was the Problem?

Before this upgrade, your `utils.js` had this:

```js
// ❌ BAD — This runs in the BROWSER
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

// When the browser calls OpenRouter, it sends this key in the request header
// → Anyone in DevTools → Network → Request Headers can see: "Authorization: Bearer sk-or-v1-..."
```

**How easy was it to steal?**
1. Open your app
2. Press F12 (DevTools)
3. Click Network tab
4. Generate some quests
5. Click the OpenRouter request
6. See the Authorization header → API key stolen ✅

With that key, someone could generate millions of tokens on your bill.

---

## 3. What Is "Serverless"?

**Serverless** doesn't mean "no server." It means you don't manage the server yourself.

Traditional server setup:
```
You: rent a computer → install Linux → install Node → keep it running 24/7 → pay monthly
                                                           ↓
                                               (even when no one is using it)
```

**Serverless (what we use):**
```
You: write a function → upload it to Firebase → done
Firebase: runs it only when someone calls it → charges only for actual usage
          (idle = $0 cost)
```

Firebase Cloud Functions = serverless functions. Google manages the server for you.

---

## 4. Our New Architecture

```
                    ┌─────────────────────────────────────┐
  Your Browser      │         Google's Cloud              │
  ──────────────    │  ┌─────────────────┐               │
  React App         │  │ Your Cloud Func  │               │
                    │  │  (index.js)      │               │
  "Generate quests" │  │                 │               │
       ──────────── │──│→ callAI()       │               │
                    │  │                 │               │
                    │  │   reads secret  │               │
                    │  │   API key from  │               │
                    │  │   Firebase Vault│               │
                    │  │       ↓         │               │
                    │  │   calls OpenRouter              │
                    │  │       ↓         │               │
  "Here's the AI   │  │   returns text  │               │
   response"        │  └─────────────────┘               │
       ──────────── │◁──────────────────                 │
                    │                                     │
                    └─────────────────────────────────────┘
```

**The key (🔑) lives inside Google's secure vault. It never leaves their servers.**

---

## 5. What Is Firebase Secret Manager?

Firebase's **Secret Manager** is like a bank vault for sensitive data.

```js
// In our Cloud Function (functions/index.js):
const openRouterApiKey = defineSecret("OPENROUTER_API_KEY");

// Firebase reads this from its secure vault at runtime
// The value is NEVER visible in logs, code, or DevTools
const key = openRouterApiKey.value(); // ← only works INSIDE the function
```

To set the secret, you run ONE command:
```bash
firebase functions:secrets:set OPENROUTER_API_KEY
# Firebase asks: "Enter value:" (you paste your key, press Enter)
# Firebase encrypts and stores it — even you can't read it back in plain text
```

---

## 6. What Is an HTTP Callable Function?

Firebase has several types of Cloud Functions. We use **`onCall`** (Callable Functions).

### Regular HTTP endpoint (like a website):
```
URL: https://us-central1-your-project.cloudfunctions.net/callAI
Anyone can call this URL, even people NOT logged into your app!
```

### Callable Function (what we use):
```js
// Frontend — using Firebase SDK:
const callAI = httpsCallable(functions, 'callAI');
const result = await callAI({ messages, systemPrompt });
// Firebase SDK automatically includes the user's auth token
```

**The difference:**
- Callable functions automatically verify the user is logged in
- The auth token is checked by Firebase before your code even runs
- No random internet user can spam your function

---

## 7. What Is a "Function" in Computing?

You already know what a JavaScript function is:
```js
function add(a, b) { return a + b; }
add(2, 3) // → 5
```

A **Cloud Function** is the same idea but:
- It lives on a server instead of your browser
- It gets called via the internet (HTTP requests)
- It can access secrets, databases, and other server-only resources

```js
// Cloud Function — runs on Google's servers
exports.callAI = onCall(async (request) => {
    // request.data = what the browser sent us
    const { messages, systemPrompt } = request.data;
    
    // We can safely use the secret key here — we're on the server!
    const result = await callOpenRouter(openRouterApiKey.value(), messages, systemPrompt);
    
    return { text: result }; // send back to browser
});
```

---

## 8. Deployment Process

Deploying a Cloud Function means uploading your code to Google's servers:

```bash
# 1. Set the secret (one time only)
firebase functions:secrets:set OPENROUTER_API_KEY

# 2. Deploy the function
firebase deploy --only functions

# 3. Firebase:
#    - Bundles your code
#    - Uploads to Google Cloud
#    - Starts a serverless container
#    - Gives you a URL to call it
```

After deployment, your function runs at a URL like:
```
https://us-central1-shadow-system-d5f7f.cloudfunctions.net/callAI
```

But you never use this URL directly — the Firebase SDK (`httpsCallable`) handles calling it securely.

---

## 9. Summary of Changes

| What | Before | After |
|------|--------|-------|
| Where AI calls happen | In the browser ❌ | On Firebase servers ✅ |
| API key location | In `.env` → visible in DevTools ❌ | In Firebase Secret Manager ✅ |
| Who can call the AI | Anyone (no auth check) ❌ | Only logged-in users ✅ |
| Cost if key stolen | Attacker uses your key 💸 | Key never leaves the server ✅ |

---

## 10. Key Terms Glossary

| Term | Simple Meaning |
|------|---------------|
| **Server** | A computer that runs code and responds to requests 24/7 |
| **Client** | Your browser — code here is public and visible to anyone |
| **Serverless** | You write functions, cloud provider manages the servers |
| **Cloud Function** | A single function that runs on Google's servers when called |
| **API Key** | A password that gives access to a paid service (keep secret!) |
| **Secret Manager** | Firebase's encrypted vault for storing sensitive values |
| **`onCall`** | Firebase function type that auto-verifies user authentication |
| **`httpsCallable`** | Firebase SDK method to call Cloud Functions from the browser |
| **Deploy** | Upload your code to the cloud so it can run on real servers |
| **Middleware** | Code that sits between two systems (our function is middleware) |
