# 📚 Learn: Dungeon Focus Lock

> This document explains everything you need to understand *before* reading the code we wrote. It's deliberately written in plain English.

---

## 1. What Is a Browser API?

You already know what an API is (Application Programming Interface) — it's a way to ask something to do a task for you.

A **Browser API** is a built-in tool that the browser (Chrome, Safari, Firefox) gives to your JavaScript code. You don't install it — it's just there, baked into the browser.

Examples of browser APIs:
- `fetch()` — lets you make network requests
- `localStorage` — lets you save data locally
- `document.getElementById()` — lets you find HTML elements

The browser APIs we use in this feature:

| API | Method | What It Does |
|---|---|---|
| Fullscreen API | `element.requestFullscreen()` | Makes the page take over the entire screen |
| Screen Wake Lock API | `navigator.wakeLock.request('screen')` | Prevents the screen from turning off |
| Page Visibility API | `document.visibilityState` | Tells you if the user is looking at the page or not |

---

## 2. The Fullscreen API

### What It Is

By default, a webpage lives inside a browser window — there's an address bar, tabs, and window controls. The **Fullscreen API** lets your page escape all of that and take over the entire display, just like a video game or a movie.

### How It Works

```javascript
// Make the whole page go fullscreen
document.documentElement.requestFullscreen();

// Exit fullscreen (can also press Escape)
document.exitFullscreen();

// Check if we're currently fullscreen
if (document.fullscreenElement) {
  console.log("We are fullscreen!");
}
```

`document.documentElement` is the `<html>` element — the root of your entire page. When you request fullscreen on it, the whole page goes fullscreen.

### Permission Model

The browser only allows `requestFullscreen()` to be called **in response to a user gesture** — meaning inside a button click handler. You can't auto-fullscreen a page when it loads (that would be an attack vector). This is why we call it inside `enterDungeon()`, which is triggered by a button click.

### Mobile Behaviour

- **Chrome Android:** Works fully ✅
- **Safari iOS:** `requestFullscreen()` is limited — the page can go "standalone" mode (no browser chrome) but not true fullscreen. We handle this gracefully.

---

## 3. The Screen Wake Lock API

### What It Is

Phones and laptops turn their screens off after a period of inactivity to save battery. During a 25-minute focus session, you don't want your screen going dark.

The **Screen Wake Lock API** lets you tell the browser: "Keep the screen on — the user needs it."

### How It Works

```javascript
// Request a wake lock
let wakeLock = null;

async function keepScreenOn() {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    console.log("Screen will stay on!");
  } catch (err) {
    // User denied, or browser doesn't support it
    console.warn("Wake lock failed:", err.message);
  }
}

// Release it when you're done
async function releaseWakeLock() {
  if (wakeLock) {
    await wakeLock.release();
    wakeLock = null;
  }
}
```

Notice the `async`/`await` — browser APIs that require hardware access (screen, camera, microphone) are **asynchronous**. The browser needs a moment to ask the OS for permission.

### Important: Wake Lock Auto-Releases

If the user switches away from the tab, the browser automatically releases the wake lock (to save battery). This means you need to re-request it when the user comes back. We handle this in our code with the `visibilitychange` event.

---

## 4. The Page Visibility API

### What It Is

The **Page Visibility API** tells your JavaScript whether the user is currently looking at your tab or has switched away.

This is how focus apps detect cheating — if you switch to YouTube during a focus session, the `visibilitychange` event fires.

### How It Works

```javascript
// Check current state
console.log(document.visibilityState); // "visible" or "hidden"

// Listen for changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log("User switched away! Cheat detected.");
  } else {
    console.log("User came back.");
  }
});
```

`document.hidden` is `true` when the tab is not visible (user switched to another tab or minimized the browser).

---

## 5. React's useEffect and Cleanup

### Why This Matters

In React, `useEffect` runs code when a component mounts (appears on screen) or when its dependencies change. But event listeners and timers need to be **cleaned up** when the component unmounts (disappears) — otherwise you get memory leaks and bugs.

### The Cleanup Pattern

```javascript
useEffect(() => {
  // Setup: add event listener
  const handleVisibilityChange = () => {
    if (document.hidden) {
      console.log("Focus broken!");
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Cleanup: remove event listener when component unmounts
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []); // Empty array = only runs once when component mounts
```

The `return () => { ... }` function is the **cleanup function**. React calls it automatically when the component is removed from the screen.

**Without cleanup:** The event listener keeps running even after the dungeon is closed, potentially firing for wrong reasons.

**With cleanup:** The event listener stops exactly when the dungeon overlay closes.

---

## 6. The DungeonFocusOverlay Component

### What It Is

We extracted the dungeon focus lock UI into its own component: `DungeonFocusOverlay.jsx`.

Previously, all dungeon UI was inside `GameApp.jsx`. Now:
- `GameApp.jsx` — handles the overall game logic (quests, state, tabs)
- `DungeonFocusOverlay.jsx` — handles only the fullscreen focus lock experience

### Why Split It?

This is called **Separation of Concerns** — each piece of code does one thing and does it well. Benefits:
- Easier to debug (problem in the overlay? look in `DungeonFocusOverlay.jsx`)
- Easier to read (each file is smaller and focused)
- Easier to reuse (if you ever want focus lock somewhere else, it's a self-contained component)

---

## 7. Quick Reference: The Three APIs

```javascript
// 1. FULLSCREEN
await document.documentElement.requestFullscreen(); // Enter
await document.exitFullscreen();                    // Exit
Boolean(document.fullscreenElement)                 // Check

// 2. WAKE LOCK
const lock = await navigator.wakeLock.request('screen'); // Acquire
await lock.release();                                     // Release

// 3. PAGE VISIBILITY
document.hidden             // true = user switched away
document.visibilityState    // "visible" | "hidden"
document.addEventListener('visibilitychange', callback);
document.removeEventListener('visibilitychange', callback);
```

---

## Summary

| Concept | What You Learned |
|---|---|
| Browser API | A built-in tool the browser gives to your JS code |
| Fullscreen API | Makes your page take over the entire screen |
| Screen Wake Lock API | Prevents the screen from turning off |
| Page Visibility API | Detects when the user switches tabs/apps |
| `useEffect` cleanup | The `return () => {}` that removes listeners when component unmounts |
| Separation of Concerns | Each file/component does one focused job |
