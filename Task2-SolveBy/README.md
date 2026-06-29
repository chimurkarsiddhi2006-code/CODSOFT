# SolveBy Quiz

A mobile-first online quiz maker with a blue/white gradient theme, built with vanilla HTML/CSS/JS, Firebase Auth + Firestore, and the Open Trivia DB API.

## Run it
Just open `index.html` in a browser, or serve the folder with any static server:
```
npx serve .
```
(A static server is recommended over double-clicking the file, since Firebase's SDK and fetch calls work best over http/https.)

## Connect your Firebase project
Open `index.html` and replace the placeholder values in `firebaseConfig` (near the bottom of the file) with your own Firebase project's config:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

In the Firebase console:
1. Enable **Authentication → Email/Password**.
2. Create a **Firestore** database (start in test mode while developing).
3. Suggested Firestore collections (created automatically on first write):
   - `leaderboard` — quiz attempt scores (`userId`, `userName`, `category`, `difficulty`, `correctCount`, `totalCount`, `percentage`, `createdAt`)
   - `quizzes` — user-created quizzes (`title`, `questions[]`, `ownerId`, `ownerName`, `createdAt`)

If Firebase isn't configured (placeholder values left in place), the app automatically runs in **local/demo mode**: login/register works against an in-memory session, and scores/quizzes are saved to `localStorage` instead of Firestore — so you can try the whole app immediately without any setup.

## Features
- Home, Login, Register, Dashboard, Categories, Quiz, Results, Leaderboard, Create Quiz pages (single-page app, hash-free router)
- Firebase email/password authentication
- Firestore-backed leaderboard and custom-quiz storage (with local-storage fallback)
- Open Trivia DB integration: category browsing, difficulty + amount filters, search
- One question at a time, 30-second countdown timer with animated ring, progress bar
- Final score with percentage, ring chart, and achievement badge
- Full answer review with explanations after each quiz
- Quiz builder for creating and saving your own multiple-choice quizzes
- Fully responsive: bottom tab bar on mobile, top nav on tablet/desktop
